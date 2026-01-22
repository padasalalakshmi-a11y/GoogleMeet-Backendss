const axios = require('axios');

class TranslateService {
  constructor() {
    this.apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    this.baseUrl = 'https://translation.googleapis.com/language/translate/v2';
  }

  async translate(text, targetLanguage, sourceLanguage = 'en') {
    try {
      const response = await axios.post(this.baseUrl, null, {
        params: {
          q: text,
          target: targetLanguage,
          source: sourceLanguage,
          key: this.apiKey,
          format: 'text'
        }
      });

      if (response.data && response.data.data && response.data.data.translations) {
        return response.data.data.translations[0].translatedText;
      }

      throw new Error('Invalid response from translation API');
    } catch (error) {
      console.error('Translation API error:', error.response?.data || error.message);
      throw new Error('Translation failed');
    }
  }

  async detectLanguage(text) {
    try {
      const response = await axios.post(
        'https://translation.googleapis.com/language/translate/v2/detect',
        null,
        {
          params: {
            q: text,
            key: this.apiKey
          }
        }
      );

      if (response.data && response.data.data && response.data.data.detections) {
        return response.data.data.detections[0][0].language;
      }

      return 'en';
    } catch (error) {
      console.error('Language detection error:', error);
      return 'en';
    }
  }
}

module.exports = new TranslateService();
