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
      // console.log('   API Key:', this.apiKey.substring(0, 20) + '...');
    }
  }

  /**
   * Convert audio to text using Google Cloud Speech-to-Text API
   * @param {Buffer} audioBuffer - Audio file buffer
   * @param {string} languageCode - Language code (e.g., 'en-US', 'te-IN')
   * @param {string} targetLanguage - Optional: Translate to this language
   * @returns {Promise<Object>} - Transcribed text and optional translation
   */
  async transcribeAudio(audioBuffer, languageCode = 'en-US', targetLanguage = null) {
    try {
      console.log('🎤 Google Speech-to-Text: Starting transcription...');
      console.log('   Language:', languageCode);
      console.log('   Audio size:', audioBuffer.length, 'bytes');
      if (targetLanguage) {
        console.log('   Target translation:', targetLanguage);
      }

      // Validate audio size (Google Speech API limit: 10MB for sync, 1 minute for best results)
      const MAX_AUDIO_SIZE = 10 * 1024 * 1024; // 10MB
      const RECOMMENDED_MAX_SIZE = 1 * 1024 * 1024; // 1MB (recommended)
      
      if (audioBuffer.length > MAX_AUDIO_SIZE) {
        throw new Error(`Audio file too large: ${Math.round(audioBuffer.length / 1024 / 1024)}MB (max 10MB)`);
      }
      
      if (audioBuffer.length > RECOMMENDED_MAX_SIZE) {
        console.log(`⚠️ Warning: Audio size ${Math.round(audioBuffer.length / 1024)}KB exceeds recommended 1MB`);
        console.log('   Consider using shorter audio segments for better results');
      }

      // Validate audio buffer
      if (!audioBuffer || audioBuffer.length === 0) {
        throw new Error('Empty audio buffer');
      }

      // Convert audio buffer to base64
      let audioBase64;
      try {
        audioBase64 = audioBuffer.toString('base64');
        console.log('   Base64 size:', audioBase64.length, 'characters');
      } catch (encodeError) {
        console.error('❌ Failed to encode audio to base64:', encodeError.message);
        throw new Error('Failed to encode audio data');
      }

      // Prepare request payload with improved settings
      const requestData = {
        config: {
          encoding: 'WEBM_OPUS', // Audio format from browser
          sampleRateHertz: 48000, // Standard for WebM
          languageCode: languageCode,
          enableAutomaticPunctuation: true,
          model: 'latest_long', // Better for conversational speech
          useEnhanced: true, // Better quality
          // Add alternative language codes for better recognition
          alternativeLanguageCodes: this.getAlternativeLanguages(languageCode),
          // Enable word-level confidence
          enableWordConfidence: true,
          // Better handling of numbers and dates
          enableSpokenPunctuation: true,
          enableSpokenEmojis: false,
        },
        audio: {
          content: audioBase64
        }
      };

      console.log('📤 Sending request to Google Speech API...');
      console.log('   Request size:', JSON.stringify(requestData).length, 'bytes');
      const startTime = Date.now();

      // Make API request with better error handling
      let response;
      try {
        response = await axios.post(
          `${this.speechApiUrl}?key=${this.apiKey}`,
          requestData,
          {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 60000, // 60 second timeout (increased for larger files)
            maxContentLength: 50 * 1024 * 1024, // 50MB max response
            maxBodyLength: 50 * 1024 * 1024 // 50MB max request
          }
        );
      } catch (axiosError) {
        console.error('❌ Axios request failed:', axiosError.message);
        if (axiosError.code === 'ECONNABORTED') {
          throw new Error('Request timeout - audio file may be too large or network is slow');
        }
        throw axiosError;
      }

      const processingTime = Date.now() - startTime;

      // Extract transcription from response
      if (response.data && response.data.results && response.data.results.length > 0) {
        const transcript = response.data.results
          .map(result => result.alternatives[0].transcript)
          .join(' ')
          .trim();

        const confidence = response.data.results[0].alternatives[0].confidence;

        console.log('✅ Google Speech-to-Text: Success!');
        console.log('   Transcription:', transcript);
        console.log('   Processing time:', processingTime, 'ms');
        console.log('   Confidence:', confidence);

        // If target language specified, translate using Google Translate
        let translation = null;
        if (targetLanguage && targetLanguage !== languageCode.split('-')[0]) {
          try {
            console.log('🌐 Translating to', targetLanguage);
            const googleTranslateService = require('./googleTranslateService');
            translation = await googleTranslateService.translate(
              transcript,
              targetLanguage,
              languageCode.split('-')[0]
            );
            console.log('   Translation:', translation);
          } catch (translateError) {
            console.error('⚠️ Translation failed:', translateError.message);
            // Continue without translation
          }
        }

        return {
          transcript,
          translation,
          confidence,
          languageCode
        };
      } else {
        console.log('⚠️ No transcription results from Google API');
        console.log('   Response data:', JSON.stringify(response.data, null, 2));
        throw new Error('No speech detected in audio');
      }

    } catch (error) {
      console.error('❌ Google Speech-to-Text error:', error.message);
      
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Status text:', error.response.statusText);
        console.error('   Error details:', JSON.stringify(error.response.data, null, 2));
        
        // Handle specific errors
        if (error.response.status === 400) {
          const errorMsg = error.response.data?.error?.message || 'Invalid audio format or configuration';
          throw new Error(`Bad Request: ${errorMsg}`);
        } else if (error.response.status === 403) {
          throw new Error('Google API key invalid or Speech-to-Text API not enabled');
        } else if (error.response.status === 429) {
          throw new Error('API quota exceeded - too many requests');
        } else if (error.response.status === 413) {
          throw new Error('Audio file too large for Google Speech API');
        }
      }
      
      // Re-throw with more context
      throw new Error(`Speech-to-Text failed: ${error.message}`);
    }
  }

  /**
   * Get alternative language codes for better recognition
   * @param {string} primaryLanguage - Primary language code
   * @returns {Array<string>} - Alternative language codes
   */
  getAlternativeLanguages(primaryLanguage) {
    const alternatives = {
      'te-IN': ['en-IN', 'hi-IN'], // Telugu speakers often mix English/Hindi
      'hi-IN': ['en-IN', 'te-IN'],
      'ta-IN': ['en-IN', 'hi-IN'],
      'en-IN': ['hi-IN', 'te-IN'],
      'en-US': ['en-GB', 'en-AU'],
    };
    
    return alternatives[primaryLanguage] || [];
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
