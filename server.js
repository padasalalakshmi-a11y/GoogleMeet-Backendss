require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const config = require('./config/config');
const { testConnection, syncDatabase } = require('./config/database');
const { RoomModel, ParticipantModel, TranslationLogModel } = require('./models');
const translateService = require('./services/translateServiceFree');
const roomController = require('./controllers/roomController');
const { validateUserData } = require('./middleware/validation');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { apiLimiter, roomCreationLimiter, translationLimiter } = require('./middleware/rateLimiter');

// Import routes
const roomRoutes = require('./routes/roomRoutes');
const translationRoutes = require('./routes/translationRoutes');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, config.socketio);

// Track translation requests per socket for rate limiting
const translationCounts = new Map();

// Middleware
app.use(cors(config.cors));
app.use(express.json());

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
app.use('/api/rooms', roomRoutes);
app.use('/api/translate', translationRoutes);

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
      // Validate user data
      const validation = validateUserData({ userName, language, speakingLanguage });
      if (!validation.valid) {
        socket.emit('error', { message: validation.message });
        return;
      }

      socket.join(roomCode);
      
      // Get or create room in database
      let room = await RoomModel.findByRoomCode(roomCode);
      if (!room) {
        room = await RoomModel.create({
          roomCode,
          createdBy: 'user',
          active: true
        });
      }
      
      // Update room activity
      await room.updateActivity();
      
      // Add participant to database
      const participant = await ParticipantModel.create({
        socketId: socket.id,
        userName,
        language,
        speakingLanguage,
        roomId: room.id,
        active: true
      });
      
      // Update participant count
      await room.incrementParticipants();
      
      console.log(`✅ ${userName} joined room ${roomCode}`);
      console.log(`   Speaking: ${speakingLanguage}, Wants: ${language}`);
      
      // Notify others in the room
      socket.to(roomCode).emit('user-joined', {
        userId: socket.id,
        userName,
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
        roomCode,
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
