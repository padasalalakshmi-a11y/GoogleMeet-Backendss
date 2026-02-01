const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const jwt = require('jsonwebtoken');
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

// Regular email/password routes
router.post('/register', authController.register.bind(authController));
router.post('/login', authController.login.bind(authController));
router.get('/me', requireAuth, authController.getMe.bind(authController));

// Debug endpoint to check OAuth configuration
router.get('/oauth-debug', (req, res) => {
  res.json({
    clientId: process.env.GOOGLE_CLIENT_ID,
    backendUrl: process.env.BACKEND_URL || 'http://localhost:3000',
    callbackUrl: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/auth/google/callback`,
    frontendUrl: process.env.FRONTEND_URL,
    message: 'Add this callbackUrl to Google Cloud Console > Credentials > OAuth 2.0 Client > Authorized redirect URIs'
  });
});

// Google OAuth routes
router.get('/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false,
    prompt: 'select_account'  // Force account selection every time
  })
);

router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth_failed`,
    session: false
  }),
  (req, res) => {
    try {
      // Generate JWT token (use userId to match auth middleware)
      const token = jwt.sign(
        { 
          userId: req.user.id,  // Changed from 'id' to 'userId'
          email: req.user.email 
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Redirect to frontend with token
      res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=token_generation_failed`);
    }
  }
);

module.exports = router;
