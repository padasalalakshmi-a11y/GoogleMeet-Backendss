const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`⚠️ Rate limit exceeded: ${req.ip} on ${req.path}`);
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    });
  }
});

// Strict limiter for room creation
const roomCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 rooms per hour
  message: {
    error: 'Too many rooms created. Please wait before creating more.',
    retryAfter: '1 hour'
  },
  handler: (req, res) => {
    console.log(`⚠️ Room creation limit exceeded: ${req.ip}`);
    res.status(429).json({
      error: 'Too many rooms created. Please wait before creating more.',
      retryAfter: '1 hour'
    });
  }
});

// Translation limiter (most important for cost control)
const translationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 translations per minute
  message: {
    error: 'Translation rate limit exceeded. Please slow down.',
    retryAfter: '1 minute'
  },
  handler: (req, res) => {
    console.log(`⚠️ Translation limit exceeded: ${req.ip}`);
    res.status(429).json({
      error: 'Translation rate limit exceeded. Please slow down.',
      retryAfter: '1 minute'
    });
  }
});

module.exports = {
  apiLimiter,
  roomCreationLimiter,
  translationLimiter
};
