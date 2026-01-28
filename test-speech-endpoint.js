// Test script to verify Google Speech API endpoint
const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testSpeechEndpoint() {
  console.log('🧪 Testing Google Speech API Endpoint\n');
  
  // Test 1: Check if endpoint exists
  console.log('Test 1: Checking endpoint status...');
  try {
    const statusResponse = await fetch('http://localhost:5000/api/speech/status');
    const statusData = await statusResponse.json();
    console.log('✅ Status endpoint response:', JSON.stringify(statusData, null, 2));
    
    if (!statusData.configured) {
      console.log('❌ Google Speech API is not configured!');
      console.log('💡 Check your API key in config/config.js');
      return;
    }
  } catch (error) {
    console.error('❌ Cannot reach backend:', error.message);
    console.log('💡 Make sure backend is running: node server.js');
    return;
  }
  
  console.log('\n');
  
  // Test 2: Check if we can send a test request
  console.log('Test 2: Testing transcribe endpoint...');
  console.log('⚠️  Note: This test requires an actual audio file');
  console.log('    The real test happens when you speak in the browser\n');
  
  // Test 3: Check Google Speech Service configuration
  console.log('Test 3: Checking Google Speech Service...');
  const googleSpeechService = require('./services/googleSpeechService');
  
  if (googleSpeechService.isConfigured()) {
    console.log('✅ Google Speech Service is configured');
    console.log('   API Key exists: Yes');
  } else {
    console.log('❌ Google Speech Service is NOT configured');
    console.log('   API Key exists: No');
  }
  
  console.log('\n');
  
  // Test 4: Check if routes are registered
  console.log('Test 4: Checking if routes are registered...');
  try {
    const response = await fetch('http://localhost:5000/api/speech/status');
    if (response.status === 200) {
      console.log('✅ Speech routes are properly registered');
    } else {
      console.log('❌ Speech routes returned status:', response.status);
    }
  } catch (error) {
    console.log('❌ Cannot reach speech routes');
  }
  
  console.log('\n');
  console.log('═══════════════════════════════════════');
  console.log('📋 SUMMARY');
  console.log('═══════════════════════════════════════');
  console.log('');
  console.log('To test speech recognition:');
  console.log('1. Make sure backend is running');
  console.log('2. Open browser: http://localhost:5000');
  console.log('3. Join a meeting');
  console.log('4. Click 💬 Translate button');
  console.log('5. Speak for 3-5 seconds');
  console.log('6. Click 💬 again to stop');
  console.log('7. Check browser console (F12) for logs');
  console.log('8. Check backend console for "Received audio"');
  console.log('');
  console.log('Expected browser console output:');
  console.log('  🎤 Google Speech: Starting audio recording...');
  console.log('  ✅ Google Speech: Recording started - speak now!');
  console.log('  ⏹️ Google Speech: Stopping recording...');
  console.log('  📤 Sending audio to Google Speech API...');
  console.log('  ✅ Google Speech transcription successful!');
  console.log('');
  console.log('Expected backend console output:');
  console.log('  📝 Received audio for transcription');
  console.log('  🎤 Calling Google Speech-to-Text API...');
  console.log('  ✅ Transcription successful!');
  console.log('');
}

// Run the test
testSpeechEndpoint().catch(console.error);
