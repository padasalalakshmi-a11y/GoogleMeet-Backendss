// Application Configuration

require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'Production',
  
  // Database settings
  database: {
    url: process.env.DB_URL,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  },
  
  // CORS settings
  cors: {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // List of allowed origins
      const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://googlemeet-frontend.vercel.app',
        process.env.FRONTEND_URL
      ].filter(Boolean);
      
      // Check if origin is allowed or if it's a Vercel preview URL
      if (allowedOrigins.includes(origin) || origin.includes('vercel.app')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'DELETE'],
    credentials: true
  },
  
  // Socket.io settings
  socketio: {
    cors: {
      origin: function (origin, callback) {
        // Allow requests with no origin
        if (!origin) return callback(null, true);
        
        // List of allowed origins
        const allowedOrigins = [
          'http://localhost:5173',
          'http://localhost:3000',
          'https://googlemeet-frontend.vercel.app',
          process.env.FRONTEND_URL
        ].filter(Boolean);
        
        // Check if origin is allowed or if it's a Vercel preview URL
        if (allowedOrigins.includes(origin) || origin.includes('vercel.app')) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000
  },
  
  // Translation API
  translation: {
    apiKey: process.env.GOOGLE_TRANSLATE_API_KEY,
    maxTextLength: 5000
  },
  
  // Room settings
  room: {
    maxParticipants: 50,
    cleanupInterval: 300000 // 5 minutes
  }
};
