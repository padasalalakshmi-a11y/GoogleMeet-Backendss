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
    const targetLanguage = req.body.targetLanguage || null; // Optional translation
    const languageCode = googleSpeechService.getLanguageCode(language);

    console.log('📋 Request details:');
    console.log('   Source language:', language, '→', languageCode);
    if (targetLanguage) {
      console.log('   Target language:', targetLanguage);
    }
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

    // Transcribe audio using Google Speech API (with optional translation)
    console.log('🎤 Calling Google Speech-to-Text API...');
    const startTime = Date.now();
    
    const result = await googleSpeechService.transcribeAudio(
      req.file.buffer,
      languageCode,
      targetLanguage
    );

    const processingTime = Date.now() - startTime;

    console.log('✅ Transcription successful!');
    console.log('   Original text:', result.transcript);
    if (result.translation) {
      console.log('   Translated text:', result.translation);
    }
    console.log('   Confidence:', result.confidence);
    console.log('   Time:', processingTime, 'ms');
    console.log('========================================\n');

    // Return transcription and translation
    res.json({
      success: true,
      text: result.transcript,
      translation: result.translation,
      confidence: result.confidence,
      language: language,
      processingTime: processingTime
    });

  } catch (error) {
    console.error('❌ Transcription error:', error.message);
    console.error('   Error stack:', error.stack);
    console.error('   Request details:', {
      audioSize: req.file?.size,
      language: req.body?.language,
      targetLanguage: req.body?.targetLanguage
    });
    console.log('========================================\n');
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to transcribe audio',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
