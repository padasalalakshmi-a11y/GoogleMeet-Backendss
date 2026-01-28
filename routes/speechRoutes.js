// Speech-to-Text Routes using Google Cloud Speech API
const express = require('express');
const router = express.Router();
const multer = require('multer');
const googleSpeechService = require('../services/googleSpeechService');

// Configure multer for audio file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

/**
 * POST /api/speech/transcribe
 * Transcribe audio to text using Google Cloud Speech-to-Text API
 */
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    console.log('\n========================================');
    console.log('📝 Received audio for transcription');
    console.log('========================================');

    // Check if audio file was uploaded
    if (!req.file) {
      console.log('❌ No audio file provided');
      return res.status(400).json({
        success: false,
        message: 'No audio file provided'
      });
    }

    // Get language from request
    const language = req.body.language || 'en';
    const languageCode = googleSpeechService.getLanguageCode(language);

    console.log('📋 Request details:');
    console.log('   Language:', language, '→', languageCode);
    console.log('   Audio size:', req.file.size, 'bytes');
    console.log('   Audio type:', req.file.mimetype);

    // Check if Google Speech API is configured
    if (!googleSpeechService.isConfigured()) {
      console.log('❌ Google Speech API not configured');
      return res.status(500).json({
        success: false,
        message: 'Speech-to-Text service not configured'
      });
    }

    // Transcribe audio using Google Speech API
    console.log('🎤 Calling Google Speech-to-Text API...');
    const startTime = Date.now();
    
    const transcription = await googleSpeechService.transcribeAudio(
      req.file.buffer,
      languageCode
    );

    const processingTime = Date.now() - startTime;

    console.log('✅ Transcription successful!');
    console.log('   Text:', transcription);
    console.log('   Time:', processingTime, 'ms');
    console.log('========================================\n');

    // Return transcription
    res.json({
      success: true,
      text: transcription,
      language: language,
      processingTime: processingTime
    });

  } catch (error) {
    console.error('❌ Transcription error:', error.message);
    console.log('========================================\n');
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to transcribe audio'
    });
  }
});

/**
 * GET /api/speech/status
 * Check if Speech-to-Text service is configured
 */
router.get('/status', (req, res) => {
  const isConfigured = googleSpeechService.isConfigured();
  
  res.json({
    success: true,
    configured: isConfigured,
    service: 'Google Cloud Speech-to-Text',
    message: isConfigured 
      ? 'Speech-to-Text service is ready' 
      : 'Google API key not configured'
  });
});

module.exports = router;
