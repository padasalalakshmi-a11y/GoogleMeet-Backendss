const axios = require('axios');

class TranslateServiceFree {
  constructor() {
    // Using LibreTranslate (free, no API key needed)
    this.baseUrl = 'https://libretranslate.com/translate';
  }

  async translate(text, targetLanguage, sourceLanguage = 'en') {
    try {
      const response = await axios.post(this.baseUrl, {
        q: text,
        source: sourceLanguage,
        target: targetLanguage,
        format: 'text'
      });

      if (response.data && response.data.translatedText) {
        return response.data.translatedText;
      }

      throw new Error('Invalid response from translation API');
    } catch (error) {
      console.error('Translation API error:', error.response?.data || error.message);
      
      // Fallback: Try Google Translate (unofficial)
      try {
        const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLanguage}&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(text)}`;
        const googleResponse = await axios.get(googleUrl);
        
        if (googleResponse.data && googleResponse.data[0] && googleResponse.data[0][0]) {
          return googleResponse.data[0][0][0];
        }
      } catch (fallbackError) {
        console.error('Fallback translation also failed:', fallbackError.message);
      }
      
      // If all fails, return original text
      return text;
    }
  }

  async detectLanguage(text) {
    try {
      const response = await axios.post('https://libretranslate.com/detect', {
        q: text
      });

      if (response.data && response.data[0] && response.data[0].language) {
        return response.data[0].language;
      }

      return 'en';
    } catch (error) {
      console.error('Language detection error:', error);
      return 'en';
    }
  }
}

module.exports = new TranslateServiceFree();
