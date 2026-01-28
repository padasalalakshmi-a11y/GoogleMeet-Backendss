// Google Cloud Speech-to-Text Service
// Uses the same Google API key as translation

const axios = require('axios');
const config = require('../config/config');

class GoogleSpeechService {
  constructor() {
    this.apiKey = config.translation.apiKey || process.env.GOOGLE_TRANSLATE_API_KEY;
    this.speechApiUrl = 'https://speech.googleapis.com/v1/speech:recognize';
    
    if (!this.apiKey) {
      console.error('❌ Google API key not found!');
    } else {
      console.log('✅ Google Speech-to-Text service initialized');
      console.log('   API Key:', this.apiKey.substring(0, 20) + '...');
    }
  }

  /**
   * Convert audio to text using Google Cloud Speech-to-Text API
   * @param {Buffer} audioBuffer - Audio file buffer
   * @param {string} languageCode - Language code (e.g., 'en-US', 'te-IN')
   * @returns {Promise<string>} - Transcribed text
   */
  async transcribeAudio(audioBuffer, languageCode = 'en-US') {
    try {
      console.log('🎤 Google Speech-to-Text: Starting transcription...');
      console.log('   Language:', languageCode);
      console.log('   Audio size:', audioBuffer.length, 'bytes');

      // Convert audio buffer to base64
      const audioBase64 = audioBuffer.toString('base64');

      // Prepare request payload
      const requestData = {
        config: {
          encoding: 'WEBM_OPUS', // Audio format from browser
          sampleRateHertz: 48000, // Standard for WebM
          languageCode: languageCode,
          enableAutomaticPunctuation: true,
          model: 'default',
          useEnhanced: true, // Better quality
        },
        audio: {
          content: audioBase64
        }
      };

      console.log('📤 Sending request to Google Speech API...');
      const startTime = Date.now();

      // Make API request
      const response = await axios.post(
        `${this.speechApiUrl}?key=${this.apiKey}`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        }
      );

      const processingTime = Date.now() - startTime;

      // Extract transcription from response
      if (response.data && response.data.results && response.data.results.length > 0) {
        const transcript = response.data.results
          .map(result => result.alternatives[0].transcript)
          .join(' ')
          .trim();

        console.log('✅ Google Speech-to-Text: Success!');
        console.log('   Transcription:', transcript);
        console.log('   Processing time:', processingTime, 'ms');
        console.log('   Confidence:', response.data.results[0].alternatives[0].confidence);

        return transcript;
      } else {
        console.log('⚠️ No transcription results from Google API');
        throw new Error('No speech detected in audio');
      }

    } catch (error) {
      console.error('❌ Google Speech-to-Text error:', error.message);
      
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Error details:', JSON.stringify(error.response.data, null, 2));
        
        // Handle specific errors
        if (error.response.status === 400) {
          throw new Error('Invalid audio format or configuration');
        } else if (error.response.status === 403) {
          throw new Error('Google API key invalid or Speech-to-Text API not enabled');
        } else if (error.response.status === 429) {
          throw new Error('API quota exceeded');
        }
      }
      
      throw new Error(`Speech-to-Text failed: ${error.message}`);
    }
  }

  /**
   * Get language code for Google Speech API
   * @param {string} language - Short language code (e.g., 'en', 'te')
   * @returns {string} - Full language code (e.g., 'en-US', 'te-IN')
   */
  getLanguageCode(language) {
    const languageCodes = {
      'en': 'en-US',
      'es': 'es-ES',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'it': 'it-IT',
      'pt': 'pt-BR',
      'ru': 'ru-RU',
      'ja': 'ja-JP',
      'ko': 'ko-KR',
      'zh': 'zh-CN',
      'ar': 'ar-SA',
      'hi': 'hi-IN',
      'te': 'te-IN', // Telugu
      'ta': 'ta-IN', // Tamil
      'bn': 'bn-IN', // Bengali
      'mr': 'mr-IN', // Marathi
      'gu': 'gu-IN', // Gujarati
      'kn': 'kn-IN', // Kannada
      'ml': 'ml-IN', // Malayalam
      'pa': 'pa-IN', // Punjabi
      'ur': 'ur-PK', // Urdu
    };

    return languageCodes[language] || 'en-US';
  }

  /**
   * Check if Google Speech API is properly configured
   * @returns {boolean}
   */
  isConfigured() {
    return !!this.apiKey;
  }
}

module.exports = new GoogleSpeechService();
