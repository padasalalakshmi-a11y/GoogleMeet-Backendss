// Translation Controller - Handles translation requests

// Use Google Translate for better quality (requires API key)
const translateService = require('../services/googleTranslateService');
// Fallback to free service if Google fails
const translateServiceFree = require('../services/translateServiceFree');

class TranslationController {
  async translate(req, res) {
    try {
      const { text, targetLanguage, sourceLanguage = 'en' } = req.body;
      
      // Validation
      if (!text || !targetLanguage) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: text and targetLanguage'
        });
      }

      if (text.length > 5000) {
        return res.status(400).json({
          success: false,
          message: 'Text too long (max 5000 characters)'
        });
      }

      let translation;
      let service = 'google';

      // Try Google Translate first (better quality)
      try {
        translation = await translateService.translate(
          text,
          targetLanguage,
          sourceLanguage
        );
      } catch (googleError) {
        console.log('⚠️ Google Translate failed, using free service fallback');
        // Fallback to free service
        translation = await translateServiceFree.translate(
          text,
          targetLanguage,
          sourceLanguage
        );
        service = 'libre';
      }

      res.json({
        success: true,
        original: text,
        translated: translation,
        sourceLanguage,
        targetLanguage,
        service // Show which service was used
      });
    } catch (error) {
      console.error('Translation error:', error);
      res.status(500).json({
        success: false,
        message: 'Translation failed',
        error: error.message
      });
    }
  }

  async detectLanguage(req, res) {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({
          success: false,
          message: 'Missing required field: text'
        });
      }

      const detectedLanguage = await translateService.detectLanguage(text);

      res.json({
        success: true,
        text,
        detectedLanguage
      });
    } catch (error) {
      console.error('Language detection error:', error);
      res.status(500).json({
        success: false,
        message: 'Language detection failed',
        error: error.message
      });
    }
  }
}

module.exports = new TranslationController();
