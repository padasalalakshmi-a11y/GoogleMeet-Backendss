const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { requireAuth } = require('../middleware/auth');

// Get available packages (public)
router.get('/packages', paymentController.getPackages.bind(paymentController));

// Protected routes (require authentication)
router.use(requireAuth);

// Create payment order
router.post('/create-order', paymentController.createOrder.bind(paymentController));

// Verify payment
router.post('/verify', paymentController.verifyPayment.bind(paymentController));

// Get payment history
router.get('/history', paymentController.getPaymentHistory.bind(paymentController));

// Webhook (no auth required - verified by signature)
router.post('/webhook', paymentController.handleWebhook.bind(paymentController));

module.exports = router;
