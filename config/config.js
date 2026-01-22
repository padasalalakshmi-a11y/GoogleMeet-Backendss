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
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'DELETE'],
    credentials: true
  },
  
  // Socket.io settings
  socketio: {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
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
