// Translation Routes

const express = require('express');
const router = express.Router();
const translationController = require('../controllers/translationController');
const { validateTranslation } = require('../middleware/validation');
const { translationLimiter } = require('../middleware/rateLimiter');

// Translate text (with rate limiting)
router.post('/', translationLimiter, validateTranslation, translationController.translate.bind(translationController));

// Detect language (with rate limiting)
router.post('/detect', translationLimiter, translationController.detectLanguage.bind(translationController));

module.exports = router;
