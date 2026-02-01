require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const passport = require('./config/passport');
const config = require('./config/config');
const { testConnection, syncDatabase } = require('./config/database');
const { RoomModel, ParticipantModel, TranslationLogModel, UserModel, CreditUsageLog } = require('./models');
const translateService = require('./services/translateServiceFree');
const roomController = require('./controllers/roomController');
const { validateUserData } = require('./middleware/validation');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { apiLimiter, roomCreationLimiter, translationLimiter } = require('./middleware/rateLimiter');

// Import routes
const roomRoutes = require('./routes/roomRoutes');
const translationRoutes = require('./routes/translationRoutes');
const speechRoutes = require('./routes/speechRoutes');
const authRoutes = require('./routes/authRoutes');
const creditRoutes = require('./routes/creditRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, config.socketio);

// Track translation requests per socket for rate limiting
const translationCounts = new Map();

// Track active translation sessions for credit deduction
const activeSessions = new Map(); // socketId -> { userId, roomId, sessionLog, intervalId }

// ✅ FIXED: Periodic cleanup to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  
  // Clean up old translation counts (older than 5 minutes)
  for (const [socketId, data] of translationCounts.entries()) {
    if (now > data.resetTime + 300000) { // 5 minutes old
      translationCounts.delete(socketId);
      console.log('🧹 Cleaned up old translation count for:', socketId);
    }
  }
  
  // Clean up orphaned sessions (older than 1 hour)
  for (const [socketId, session] of activeSessions.entries()) {
    if (session.sessionLog && session.sessionLog.createdAt) {
      const sessionAge = now - new Date(session.sessionLog.createdAt).getTime();
      if (sessionAge > 3600000) { // 1 hour old
        console.log('🧹 Cleaning up orphaned session for:', socketId);
        clearInterval(session.intervalId);
        activeSessions.delete(socketId);
      }
    }
  }
  
  console.log(`🧹 Memory cleanup: ${translationCounts.size} translation counts, ${activeSessions.size} active sessions`);
}, 300000); // Every 5 minutes

// Trust proxy for Render deployment (required for rate limiting)
app.set('trust proxy', 1);

// Middleware
app.use(cors(config.cors));
app.use(express.json());

// Session configuration for passport
app.use(session({
  secret: process.env.JWT_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// Serve static files from public folder (for old room page)
app.use(express.static(path.join(__dirname, '../frontend/react-landing/public')));

// Check if React build exists
const distPath = path.join(__dirname, '../frontend/react-landing/dist');
const fs = require('fs');

// Rate limiting
app.use('/api/', apiLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: 'connected'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/translate', translationRoutes);
app.use('/api/speech', speechRoutes);
app.use('/api/credits', creditRoutes);
app.use('/api/payments', paymentRoutes);

// IMPORTANT: Handle /room/:roomCode BEFORE serving static files
app.get('/room/:roomCode', (req, res) => {
  const { roomCode } = req.params;
  console.log(`📍 Room access: ${roomCode} - redirecting to prejoin`);
  
  // If React build exists, serve it
  if (fs.existsSync(distPath)) {
    console.log("distPath:", distPath);
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    // Redirect to prejoin with room code
    res.redirect(`/prejoin?room=${roomCode}`);
  }
});

// Serve React build if it exists
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Serve React app for all other routes (except room.html)
if (fs.existsSync(distPath)) {
  app.get('*', (req, res) => {
    // Don't intercept room.html - it's served from public folder
    if (req.path === '/room.html' || req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path.startsWith('/config.js')) {
      return;
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // Show build required message
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io') || req.path === '/room.html') {
      return;
    }
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Build Required</title>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            background: white;
            padding: 3rem;
            border-radius: 1rem;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 600px;
          }
          h1 { color: #333; margin-bottom: 1rem; text-align: center; }
          p { color: #666; line-height: 1.6; margin-bottom: 1rem; }
          code {
            background: #f5f5f5;
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            display: block;
            margin: 1rem 0;
            font-family: monospace;
            color: #e74c3c;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🏗️ Build Required</h1>
          <p>Please build the React app first:</p>
          <code>Double-click: BUILD.bat</code>
          <p>Then restart the server:</p>
          <code>Double-click: START.bat</code>
        </div>
      </body>
      </html>
    `);
  });
}

// WebSocket signaling for WebRTC
io.on('connection', (socket) => {
  console.log('👤 User connected:', socket.id);

  // Join room
  socket.on('join-room', async ({ roomCode, userName, language, speakingLanguage }) => {
    try {
      // ✅ FIXED: Validate and sanitize all inputs
      
      // Validate room code
      if (!roomCode || typeof roomCode !== 'string' || roomCode.length < 3 || roomCode.length > 50) {
        socket.emit('error', { message: 'Invalid room code' });
        return;
      }
      
      // Sanitize room code (alphanumeric, dash, underscore only)
      const sanitizedRoomCode = roomCode.replace(/[^a-zA-Z0-9-_]/g, '');
      if (sanitizedRoomCode !== roomCode) {
        socket.emit('error', { message: 'Room code contains invalid characters' });
        return;
      }
      
      // Validate user name
      if (!userName || typeof userName !== 'string' || userName.length < 1 || userName.length > 100) {
        socket.emit('error', { message: 'Invalid user name' });
        return;
      }
      
      // Sanitize user name (remove HTML/scripts)
      const sanitizedUserName = userName.replace(/[<>]/g, '').trim();
      if (!sanitizedUserName) {
        socket.emit('error', { message: 'User name cannot be empty' });
        return;
      }
      
      // Validate languages
      if (!language || typeof language !== 'string' || language.length > 10) {
        socket.emit('error', { message: 'Invalid language' });
        return;
      }
      
      if (!speakingLanguage || typeof speakingLanguage !== 'string' || speakingLanguage.length > 10) {
        socket.emit('error', { message: 'Invalid speaking language' });
        return;
      }
      
      // Validate user data
      const validation = validateUserData({ userName: sanitizedUserName, language, speakingLanguage });
      if (!validation.valid) {
        socket.emit('error', { message: validation.message });
        return;
      }

      socket.join(sanitizedRoomCode);
      
      // Get or create room in database
      let room = await RoomModel.findByRoomCode(sanitizedRoomCode);
      if (!room) {
        room = await RoomModel.create({
          roomCode: sanitizedRoomCode,
          createdBy: 'user',
          active: true
        });
      }
      
      // Update room activity
      await room.updateActivity();
      
      // Add participant to database
      const participant = await ParticipantModel.create({
        socketId: socket.id,
        userName: sanitizedUserName,
        language,
        speakingLanguage,
        roomId: room.id,
        active: true
      });
      
      // Update participant count
      await room.incrementParticipants();
      
      console.log(`✅ ${sanitizedUserName} joined room ${sanitizedRoomCode}`);
      console.log(`   Speaking: ${speakingLanguage}, Wants: ${language}`);
      
      // Notify others in the room
      socket.to(sanitizedRoomCode).emit('user-joined', {
        userId: socket.id,
        userName: sanitizedUserName,
        language,
        speakingLanguage
      });

      // Send existing users to the new user
      const existingParticipants = await ParticipantModel.findByRoomId(room.id);
      const existingUsers = existingParticipants
        .filter(p => p.socketId !== socket.id)
        .map(p => ({
          userId: p.socketId,
          userName: p.userName,
          language: p.language,
          speakingLanguage: p.speakingLanguage
        }));
      
      socket.emit('existing-users', existingUsers);
      
      // Send room info
      socket.emit('room-joined', {
        roomCode: sanitizedRoomCode,
        participantCount: existingParticipants.length
      });
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // WebRTC signaling
  socket.on('offer', ({ offer, to, roomCode }) => {
    socket.to(to).emit('offer', { offer, from: socket.id });
  });

  socket.on('answer', ({ answer, to }) => {
    socket.to(to).emit('answer', { answer, from: socket.id });
  });

  socket.on('ice-candidate', ({ candidate, to }) => {
    socket.to(to).emit('ice-candidate', { candidate, from: socket.id });
  });

  // Translation session management (Credit System)
  socket.on('translation-started', async ({ roomCode, userId }) => {
    try {
      console.log(`💳 Translation started for socket: ${socket.id}`);
      
      // Find participant to get user info
      const participant = await ParticipantModel.findBySocketId(socket.id);
      if (!participant) {
        console.log(`❌ Participant not found for socket: ${socket.id}`);
        socket.emit('translation-error', { message: 'User not found' });
        return;
      }

      // Get user from database (if authenticated)
      let user = null;
      if (userId) {
        user = await UserModel.findByPk(userId);
      }

      // Check if user has credits (skip for guests)
      if (user) {
        if (user.credits <= 0) {
          console.log(`❌ User ${userId} has no credits`);
          socket.emit('insufficient-credits', {
            message: 'You have run out of credits',
            credits: 0
          });
          return;
        }

        console.log(`✅ User ${userId} has ${user.credits} credits`);
      }

      // Create credit usage log
      const sessionLog = await CreditUsageLog.create({
        userId: user ? user.id : null,
        roomId: participant.roomId,
        roomCode: roomCode,
        startTime: new Date(),
        translationActive: true,
        creditsUsed: 0
      });

      // Start credit deduction timer (every minute)
      const intervalId = setInterval(async () => {
        try {
          if (!user) return; // Skip for guests

          // Reload user to get latest credits
          await user.reload();

          if (user.credits <= 0) {
            console.log(`⚠️ User ${user.id} ran out of credits during session`);
            
            // Stop the session
            clearInterval(intervalId);
            activeSessions.delete(socket.id);
            
            // End the log
            await sessionLog.endSession();
            
            // Notify frontend
            socket.emit('credits-depleted', {
              message: 'You have run out of credits',
              credits: 0
            });
            
            return;
          }

          // Deduct 1 credit
          await user.deductCredits(1);
          await user.reload();

          // Update session log
          sessionLog.creditsUsed += 1;
          await sessionLog.save();

          console.log(`💳 Deducted 1 credit from user ${user.id}. Remaining: ${user.credits}`);

          // Send credit update to frontend
          socket.emit('credit-update', {
            credits: user.credits,
            used: sessionLog.creditsUsed
          });

          // Warn if credits are low
          if (user.credits <= 10 && user.credits > 0) {
            socket.emit('low-credits-warning', {
              message: `You have ${user.credits} credits remaining`,
              credits: user.credits
            });
          }
        } catch (error) {
          console.error('Error in credit deduction interval:', error);
        }
      }, 60000); // Every 60 seconds (1 minute)

      // Store active session
      activeSessions.set(socket.id, {
        userId: user ? user.id : null,
        roomId: participant.roomId,
        sessionLog,
        intervalId
      });

      // Send confirmation to frontend
      socket.emit('translation-session-started', {
        credits: user ? user.credits : null,
        message: 'Translation started'
      });

      console.log(`✅ Translation session started for socket: ${socket.id}`);
    } catch (error) {
      console.error('Error starting translation session:', error);
      socket.emit('translation-error', { message: 'Failed to start translation' });
    }
  });

  socket.on('translation-stopped', async () => {
    try {
      console.log(`⏹️ Translation stopped for socket: ${socket.id}`);
      
      const session = activeSessions.get(socket.id);
      if (!session) {
        console.log(`   No active session found`);
        return;
      }

      // Stop the interval
      clearInterval(session.intervalId);

      // End the session log
      const creditsUsed = await session.sessionLog.endSession();

      // Remove from active sessions
      activeSessions.delete(socket.id);

      // Get final user credits
      let finalCredits = null;
      if (session.userId) {
        const user = await UserModel.findByPk(session.userId);
        if (user) {
          finalCredits = user.credits;
        }
      }

      // Send confirmation to frontend
      socket.emit('translation-session-ended', {
        creditsUsed,
        credits: finalCredits,
        message: 'Translation stopped'
      });

      console.log(`✅ Translation session ended. Credits used: ${creditsUsed}`);
    } catch (error) {
      console.error('Error stopping translation session:', error);
    }
  });

  // Real-time transcription and translation
  socket.on('transcription', async ({ roomCode, text, language }) => {
    try {
      // Rate limiting for translations (20 per minute)
      const socketId = socket.id;
      const now = Date.now();
      
      if (!translationCounts.has(socketId)) {
        translationCounts.set(socketId, { count: 0, resetTime: now + 60000 });
      }
      
      const userLimit = translationCounts.get(socketId);
      
      // Reset if time window passed
      if (now > userLimit.resetTime) {
        userLimit.count = 0;
        userLimit.resetTime = now + 60000;
      }
      
      // Check limit (20 per minute)
      if (userLimit.count >= 20) {
        console.log(`⚠️ Translation rate limit exceeded for socket: ${socketId}`);
        socket.emit('error', {
          message: 'Translation rate limit exceeded. Please slow down.',
          retryAfter: Math.ceil((userLimit.resetTime - now) / 1000) + ' seconds'
        });
        return;
      }
      
      // Increment count
      userLimit.count++;
      
      const room = await RoomModel.findByRoomCode(roomCode);
      if (!room) {
        console.log(`❌ Room not found: ${roomCode}`);
        return;
      }

      console.log(`\n========================================`);
      console.log(`📝 Transcription from ${socket.id}:`);
      console.log(`   Text: "${text}"`);
      console.log(`   Language: ${language}`);
      console.log(`========================================\n`);

      // Get all participants in the room
      const participants = await ParticipantModel.findByRoomId(room.id);
      
      // Broadcast to all other participants
      for (const participant of participants) {
        if (participant.socketId !== socket.id) {
          console.log(`👤 Participant ${participant.socketId} wants: ${participant.language}`);
          
          // Translate if different language
          if (participant.language !== language) {
            try {
              console.log(`🔄 Translating: "${text}"`);
              console.log(`   From: ${language} → To: ${participant.language}`);
              
              const startTime = Date.now();
              const translation = await translateService.translate(
                text,
                participant.language,
                language
              );
              const translationTime = Date.now() - startTime;
              
              console.log(`✅ Translation: "${translation}"`);
              console.log(`   Time: ${translationTime}ms\n`);
              
              // Log translation to database (optional)
              await TranslationLogModel.create({
                roomId: room.id,
                originalText: text,
                translatedText: translation,
                sourceLanguage: language,
                targetLanguage: participant.language,
                fromSocketId: socket.id,
                toSocketId: participant.socketId,
                translationTime
              });
              
              io.to(participant.socketId).emit('translated-text', {
                original: text,
                translated: translation,
                from: socket.id,
                fromLanguage: language,
                toLanguage: participant.language
              });
            } catch (error) {
              console.error('❌ Translation error:', error.message);
              // Send original if translation fails
              io.to(participant.socketId).emit('translated-text', {
                original: text,
                translated: text,
                from: socket.id,
                fromLanguage: language,
                toLanguage: participant.language
              });
            }
          } else {
            // Same language, send original
            console.log(`➡️ Same language, sending original\n`);
            io.to(participant.socketId).emit('translated-text', {
              original: text,
              translated: text,
              from: socket.id,
              fromLanguage: language,
              toLanguage: participant.language
            });
          }
        }
      }
      
      // Update room activity
      await room.updateActivity();
    } catch (error) {
      console.error('Error handling transcription:', error);
    }
  });

  // Disconnect
  socket.on('disconnect', async () => {
    console.log('👋 User disconnected:', socket.id);
    
    // Clean up rate limiting data
    translationCounts.delete(socket.id);
    
    // ✅ FIXED: Always clean up session, even if endSession fails
    const session = activeSessions.get(socket.id);
    if (session) {
      console.log(`   Stopping active translation session`);
      try {
        clearInterval(session.intervalId);
        await session.sessionLog.endSession();
      } catch (error) {
        console.error('⚠️ Error ending session:', error.message);
      } finally {
        // ALWAYS remove from Map, even if endSession fails
        activeSessions.delete(socket.id);
      }
    }
    
    try {
      // Find participant
      const participant = await ParticipantModel.findBySocketId(socket.id);
      
      if (participant) {
        const room = participant.room;
        
        // Mark participant as inactive
        await participant.leave();
        
        // Update room participant count
        await room.decrementParticipants();
        
        // Notify others
        socket.to(room.roomCode).emit('user-left', { userId: socket.id });
        
        console.log(`   Left room: ${room.roomCode}`);
      }
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });

  // ✅ Screen sharing events
  socket.on('screen-share-started', ({ roomCode, userId }) => {
    console.log('🖥️ Screen share started by:', userId);
    socket.to(roomCode).emit('screen-share-started', { userId });
  });

  socket.on('screen-share-stopped', ({ roomCode }) => {
    console.log('🖥️ Screen share stopped');
    socket.to(roomCode).emit('screen-share-stopped');
  });

  // ✅ Emoji reactions
  socket.on('emoji-reaction', ({ roomCode, emoji, reactionId }) => {
    console.log('😊 Emoji reaction:', emoji, 'from:', socket.id);
    socket.to(roomCode).emit('emoji-reaction', {
      emoji,
      reactionId,
      from: socket.id
    });
  });
});

// Cleanup inactive rooms periodically
setInterval(() => {
  roomController.cleanupInactiveRooms();
}, config.room.cleanupInterval);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Initialize database and start server
async function startServer() {
  try {
    // Test database connection
    const connected = await testConnection();
    if (!connected) {
      console.error('❌ Failed to connect to database. Exiting...');
      process.exit(1);
    }
    
    // Sync database (create tables)
    await syncDatabase();
    
    // Start server
    server.listen(config.port, () => {
      console.log(`\n🚀 Server running on port ${config.port}`);
      console.log(`📝 Environment: ${config.nodeEnv}`);
      console.log(`💾 Database: PostgreSQL (Supabase)`);
      console.log(`🌍 Translation service: Active`);
      console.log(`✅ Ready to accept connections!\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app, server, io };
