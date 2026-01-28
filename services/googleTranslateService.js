// Google Cloud Translation Service
// Uses the same Google API key as Speech-to-Text

const axios = require('axios');
const config = require('../config/config');

class GoogleTranslateService {
  constructor() {
    this.apiKey = config.translation.apiKey || process.env.GOOGLE_TRANSLATE_API_KEY;
    this.translateApiUrl = 'https://translation.googleapis.com/language/translate/v2';
    
    if (!this.apiKey) {
      console.error('❌ Google API key not found!');
    } else {
      console.log('✅ Google Translation service initialized');
      console.log('   API Key:', this.apiKey.substring(0, 20) + '...');
    }
  }

  /**
   * Translate text using Google Cloud Translation API
   * @param {string} text - Text to translate
   * @param {string} targetLanguage - Target language code (e.g., 'en', 'te')
   * @param {string} sourceLanguage - Source language code (optional)
   * @returns {Promise<string>} - Translated text
   */
  async translate(text, targetLanguage, sourceLanguage = null) {
    try {
      if (!text || text.trim() === '') {
        return '';
      }

      console.log('🌍 Google Translate: Starting translation...');
      console.log('   From:', sourceLanguage || 'auto');
      console.log('   To:', targetLanguage);
      console.log('   Text:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));

      // Prepare request parameters
      const params = {
        q: text,
        target: targetLanguage,
        format: 'text',
        key: this.apiKey
      };

      // Add source language if specified
      if (sourceLanguage) {
        params.source = sourceLanguage;
      }

      const startTime = Date.now();

      // Make API request
      const response = await axios.post(
        this.translateApiUrl,
        null,
        {
          params: params,
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10 second timeout
        }
      );

      const processingTime = Date.now() - startTime;

      // Extract translation from response
      if (response.data && response.data.data && response.data.data.translations) {
        const translation = response.data.data.translations[0].translatedText;
        const detectedLanguage = response.data.data.translations[0].detectedSourceLanguage;

        console.log('✅ Google Translate: Success!');
        console.log('   Translation:', translation.substring(0, 50) + (translation.length > 50 ? '...' : ''));
        console.log('   Detected language:', detectedLanguage || sourceLanguage);
        console.log('   Processing time:', processingTime, 'ms');

        return translation;
      } else {
        throw new Error('Invalid response from Google Translate API');
      }

    } catch (error) {
      console.error('❌ Google Translate error:', error.message);
      
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Error details:', JSON.stringify(error.response.data, null, 2));
        
        // Handle specific errors
        if (error.response.status === 400) {
          throw new Error('Invalid translation request');
        } else if (error.response.status === 403) {
          throw new Error('Google API key invalid or Translation API not enabled');
        } else if (error.response.status === 429) {
          throw new Error('API quota exceeded');
        }
      }
      
      // Fallback: return original text if translation fails
      console.log('⚠️ Returning original text due to error');
      return text;
    }
  }

  /**
   * Detect language of text
   * @param {string} text - Text to detect language
   * @returns {Promise<string>} - Detected language code
   */
  async detectLanguage(text) {
    try {
      const response = await axios.post(
        `${this.translateApiUrl}/detect`,
        null,
        {
          params: {
            q: text,
            key: this.apiKey
          },
          timeout: 5000
        }
      );

      if (response.data && response.data.data && response.data.data.detections) {
        const language = response.data.data.detections[0][0].language;
        console.log('🔍 Detected language:', language);
        return language;
      }

      return 'en';
    } catch (error) {
      console.error('❌ Language detection error:', error.message);
      return 'en';
    }
  }

  /**
   * Get supported languages
   * @returns {Promise<Array>} - List of supported languages
   */
  async getSupportedLanguages() {
    try {
      const response = await axios.get(
        `${this.translateApiUrl}/languages`,
        {
          params: {
            key: this.apiKey,
            target: 'en'
          }
        }
      );

      if (response.data && response.data.data && response.data.data.languages) {
        return response.data.data.languages;
      }

      return [];
    } catch (error) {
      console.error('❌ Error fetching supported languages:', error.message);
      return [];
    }
  }

  /**
   * Check if Google Translate API is properly configured
   * @returns {boolean}
   */
  isConfigured() {
    return !!this.apiKey;
  }
}

module.exports = new GoogleTranslateService();
