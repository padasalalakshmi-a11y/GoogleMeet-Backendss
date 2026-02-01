const User = require('../models/UserModel');
const { generateToken } = require('../middleware/auth');

class AuthController {
  // Register new user
  async register(req, res) {
    try {
      const { name, email, password } = req.body;
      
      // Validation
      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Please provide name, email, and password'
        });
      }
      
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters'
        });
      }
      
      // Check if user exists
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered'
        });
      }
      
      // Create user
      const user = await User.create({
        name,
        email,
        password,
        credits: 50,  // Free 50 credits
        plan: 'free'
      });
      
      // Generate token
      const token = generateToken(user.id);
      
      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        token,
        user: user.toJSON()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Registration failed',
        error: error.message
      });
    }
  }
  
  // Login user
  async login(req, res) {
    try {
      const { email, password } = req.body;
      
      // Validation
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Please provide email and password'
        });
      }
      
      // Find user
      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }
      
      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }
      
      // Check if account is active
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account is deactivated'
        });
      }
      
      // Generate token
      const token = generateToken(user.id);
      
      res.json({
        success: true,
        message: 'Login successful',
        token,
        user: user.toJSON()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Login failed',
        error: error.message
      });
    }
  }
  
  // Get current user
  async getMe(req, res) {
    try {
      res.json({
        success: true,
        user: req.user.toJSON()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get user data'
      });
    }
  }
  
  // Update user profile
  async updateProfile(req, res) {
    try {
      const { name } = req.body;
      
      if (name) {
        req.user.name = name;
        await req.user.save();
      }
      
      res.json({
        success: true,
        message: 'Profile updated',
        user: req.user.toJSON()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update profile'
      });
    }
  }
  
  // Get user credits
  async getCredits(req, res) {
    try {
      res.json({
        success: true,
        credits: req.user.credits,
        plan: req.user.plan
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get credits'
      });
    }
  }
}

module.exports = new AuthController();
