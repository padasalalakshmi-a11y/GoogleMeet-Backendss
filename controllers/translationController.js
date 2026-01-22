// Translation Controller - Handles translation requests

const translateService = require('../services/translateServiceFree');

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

      // Translate
      const translation = await translateService.translate(
        text,
        targetLanguage,
        sourceLanguage
      );

      res.json({
        success: true,
        original: text,
        translated: translation,
        sourceLanguage,
        targetLanguage
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
