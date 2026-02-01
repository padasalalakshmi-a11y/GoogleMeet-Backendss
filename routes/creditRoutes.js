const express = require('express');
const router = express.Router();
const creditController = require('../controllers/creditController');
const { requireAuth } = require('../middleware/auth');

// All routes require authentication
router.use(requireAuth);

// Get current credits
router.get('/', creditController.getCredits.bind(creditController));

// Get usage history
router.get('/history', creditController.getUsageHistory.bind(creditController));

// Get usage statistics
router.get('/stats', creditController.getUsageStats.bind(creditController));

// Purchase credits (placeholder)
router.post('/purchase', creditController.purchaseCredits.bind(creditController));

// Admin: Add credits (for testing/support)
router.post('/add', creditController.addCredits.bind(creditController));

module.exports = router;
