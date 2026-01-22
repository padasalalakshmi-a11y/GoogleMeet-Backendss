// Validation Middleware

const { isValidRoomCode } = require('../utils/roomCodeGenerator');

// Validate room code format
function validateRoomCode(req, res, next) {
  const roomCode = req.params.roomCode || req.body.roomCode;
  
  if (!roomCode) {
    return res.status(400).json({
      success: false,
      message: 'Room code is required'
    });
  }

  if (!isValidRoomCode(roomCode)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid room code format. Expected format: abc-defg-hij'
    });
  }

  next();
}

// Validate translation request
function validateTranslation(req, res, next) {
  const { text, targetLanguage } = req.body;
  
  if (!text) {
    return res.status(400).json({
      success: false,
      message: 'Text is required'
    });
  }

  if (!targetLanguage) {
    return res.status(400).json({
      success: false,
      message: 'Target language is required'
    });
  }

  if (typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Text must be a non-empty string'
    });
  }

  if (text.length > 5000) {
    return res.status(400).json({
      success: false,
      message: 'Text too long (maximum 5000 characters)'
    });
  }

  next();
}

// Validate user data
function validateUserData(data) {
  const { userName, language, speakingLanguage } = data;
  
  if (!userName || typeof userName !== 'string' || userName.trim().length === 0) {
    return { valid: false, message: 'Valid user name is required' };
  }

  if (!language || typeof language !== 'string') {
    return { valid: false, message: 'Language preference is required' };
  }

  if (!speakingLanguage || typeof speakingLanguage !== 'string') {
    return { valid: false, message: 'Speaking language is required' };
  }

  return { valid: true };
}

module.exports = {
  validateRoomCode,
  validateTranslation,
  validateUserData
};
