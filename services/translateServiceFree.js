const axios = require('axios');

class TranslateServiceFree {
  constructor() {
    // Try to use Google Cloud Translation API if key is available
    this.googleApiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    this.googleApiUrl = 'https://translation.googleapis.com/language/translate/v2';
    // Fallback to LibreTranslate (free, no API key needed)
    this.libreTranslateUrl = 'https://libretranslate.com/translate';
    
    if (this.googleApiKey) {
      console.log('✅ translateServiceFree: Will use Google Cloud API (with fallback to LibreTranslate)');
    } else {
      console.log('⚠️ translateServiceFree: No Google API key, will use LibreTranslate only');
    }
  }

  async translate(text, targetLanguage, sourceLanguage = 'en') {
    // PRIORITY 1: Try Google Cloud Translation API (if API key exists)
    if (this.googleApiKey) {
      try {
        console.log('🔄 Trying Google Cloud Translation API first...');
        const url = `${this.googleApiUrl}?key=${this.googleApiKey}`;
        
        const response = await axios.post(url, {
          q: text,
          target: targetLanguage,
          source: sourceLanguage,
          format: 'text'
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 5000  // ✅ FIXED: 5 second timeout to prevent hanging
        });

        if (response.data && response.data.data && response.data.data.translations) {
          const translation = response.data.data.translations[0].translatedText;
          console.log('✅ Google Cloud Translation succeeded');
          return translation;
        }
      } catch (googleError) {
        if (googleError.code === 'ECONNABORTED') {
          console.log('⚠️ Google Cloud Translation timeout (5s)');
        } else {
          console.log('⚠️ Google Cloud Translation failed:', googleError.message);
        }
        console.log('🔄 Falling back to LibreTranslate...');
      }
    }

    // PRIORITY 2: Try LibreTranslate (free service)
    try {
      console.log('🔄 Trying LibreTranslate...');
      const response = await axios.post(this.libreTranslateUrl, {
        q: text,
        source: sourceLanguage,
        target: targetLanguage,
        format: 'text'
      }, {
        timeout: 10000
      });

      if (response.data && response.data.translatedText) {
        console.log('✅ LibreTranslate succeeded');
        return response.data.translatedText;
      }

      throw new Error('Invalid response from LibreTranslate');
    } catch (libreError) {
      console.error('⚠️ LibreTranslate failed:', libreError.message);
      
      // PRIORITY 3: Try unofficial Google Translate (last resort)
      try {
        console.log('🔄 Trying unofficial Google Translate (last resort)...');
        const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLanguage}&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(text)}`;
        const googleResponse = await axios.get(googleUrl, { timeout: 5000 });
        
        if (googleResponse.data && googleResponse.data[0] && googleResponse.data[0][0]) {
          console.log('✅ Unofficial Google Translate succeeded');
          return googleResponse.data[0][0][0];
        }
      } catch (fallbackError) {
        console.error('❌ All translation methods failed:', fallbackError.message);
      }
      
      // If all fails, return original text
      console.log('⚠️ Returning original text (all translation methods failed)');
      return text;
    }
  }

  async detectLanguage(text) {
    // Try Google Cloud first if API key exists
    if (this.googleApiKey) {
      try {
        const url = `${this.googleApiUrl}/detect?key=${this.googleApiKey}`;
        const response = await axios.post(url, {
          q: text
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 5000
        });

        if (response.data && response.data.data && response.data.data.detections) {
          return response.data.data.detections[0][0].language;
        }
      } catch (error) {
        console.log('⚠️ Google language detection failed, trying LibreTranslate...');
      }
    }

    // Fallback to LibreTranslate
    try {
      const response = await axios.post('https://libretranslate.com/detect', {
        q: text
      }, {
        timeout: 5000
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
