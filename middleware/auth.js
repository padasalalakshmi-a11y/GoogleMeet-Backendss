const jwt = require('jsonwebtoken');
const User = require('../models/UserModel');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
};

// Optional auth - allows both authenticated and guest users
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      // No token = guest user
      req.user = null;
      req.isGuest = true;
      return next();
    }
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(decoded.userId);
    
    if (!user || !user.isActive) {
      req.user = null;
      req.isGuest = true;
      return next();
    }
    
    req.user = user;
    req.isGuest = false;
    next();
  } catch (error) {
    // Invalid token = treat as guest
    req.user = null;
    req.isGuest = true;
    next();
  }
};

// Required auth - must be logged in
const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(decoded.userId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    
    req.user = user;
    req.isGuest = false;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

// Check credits before API call
const checkCredits = (cost = 1) => {
  return async (req, res, next) => {
    // Guest users have limited access
    if (req.isGuest) {
      return res.status(403).json({
        success: false,
        message: 'Please sign in to use this feature',
        requiresAuth: true
      });
    }
    
    // Unlimited plan
    if (req.user.plan === 'unlimited') {
      return next();
    }
    
    // Check credits
    if (req.user.credits < cost) {
      return res.status(402).json({
        success: false,
        message: 'Insufficient credits',
        credits: req.user.credits,
        required: cost,
        needsUpgrade: true
      });
    }
    
    next();
  };
};

module.exports = {
  generateToken,
  optionalAuth,
  requireAuth,
  checkCredits
};
