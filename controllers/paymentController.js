const Razorpay = require('razorpay');
const crypto = require('crypto');
const UserModel = require('../models/UserModel');
const PaymentTransaction = require('../models/PaymentTransaction');

// Razorpay configuration
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET
});

// Credit packages (USD pricing - globally recognized)
// Razorpay will auto-convert to INR for Indian users
const CREDIT_PACKAGES = {
  starter: { 
    credits: 100, 
    price: 800,
    priceUSD: 10,
    name: 'Starter' 
  },
  pro: { 
    credits: 500, 
    price: 3200,
    priceUSD: 40,
    name: 'Pro' 
  },
  business: { 
    credits: 1000, 
    price: 5600,
    priceUSD: 70,
    name: 'Business' 
  },
  enterprise: { 
    credits: 5000, 
    price: 24000,
    priceUSD: 300,
    name: 'Enterprise' 
  }
};

class PaymentController {
  // Create payment order
  async createOrder(req, res) {
    try {
      console.log('📝 Creating Razorpay order...');
      console.log('   Request body:', req.body);
      console.log('   User:', req.user?.id, req.user?.email);
      
      const { packageId } = req.body; // Removed currency from destructuring
      const user = req.user;

      // Check if user exists
      if (!user) {
        console.error('❌ No user found in request');
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      // Check Razorpay credentials
      if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
        console.error('❌ Razorpay credentials not configured');
        return res.status(500).json({
          success: false,
          message: 'Payment gateway not configured. Please contact support.'
        });
      }

      // Validate package
      const selectedPackage = CREDIT_PACKAGES[packageId];
      if (!selectedPackage) {
        console.error('❌ Invalid package:', packageId);
        return res.status(400).json({
          success: false,
          message: 'Invalid package selected'
        });
      }

      console.log('✅ Package selected:', selectedPackage.name);

      // Get amount in paise (Razorpay uses paise for INR)
      // 1 Rupee = 100 paise
      const amount = selectedPackage.price * 100; // Convert rupees to paise
      const currency = 'INR'; // Always use INR for Indian market
      
      console.log('💰 Order details:');
      console.log('   Amount:', selectedPackage.price, 'INR (', amount, 'paise)');
      console.log('   Credits:', selectedPackage.credits);

      // Create Razorpay order
      const razorpayOrder = await razorpay.orders.create({
        amount: amount, // Amount in paise
        currency: currency, // INR
        receipt: `receipt_${user.id}_${Date.now()}`,
        notes: {
          userId: user.id,
          packageId: packageId,
          credits: selectedPackage.credits,
          packageName: selectedPackage.name
        }
      });

      console.log('✅ Razorpay order created:', razorpayOrder.id);

      // Create transaction in database
      try {
        const transaction = await PaymentTransaction.create({
          userId: user.id,
          orderId: razorpayOrder.id,
          amount: amount / 100, // Store in rupees/dollars
          currency,
          credits: selectedPackage.credits,
          status: 'pending',
          paymentGateway: 'razorpay',
          gatewayResponse: razorpayOrder
        });
        console.log('✅ Transaction created in database:', transaction.id);
      } catch (dbError) {
        console.error('❌ Database error:', dbError.message);
        return res.status(500).json({
          success: false,
          message: 'Failed to create transaction in database',
          error: dbError.message
        });
      }

      res.json({
        success: true,
        orderId: razorpayOrder.id,
        amount: amount,
        currency: currency,
        credits: selectedPackage.credits,
        package: selectedPackage.name,
        key: RAZORPAY_KEY_ID // Send key for frontend
      });

    } catch (error) {
      console.error('❌ Create order error:');
      console.error('   Message:', error.message);
      console.error('   Error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to create payment order',
        error: error.message
      });
    }
  }

  // Verify payment
  async verifyPayment(req, res) {
    try {
      const { 
        razorpay_order_id, 
        razorpay_payment_id, 
        razorpay_signature 
      } = req.body;
      
      const user = req.user;

      console.log('🔍 Verifying payment...');
      console.log('   Order ID:', razorpay_order_id);
      console.log('   Payment ID:', razorpay_payment_id);

      // Find transaction
      const transaction = await PaymentTransaction.findOne({
        where: { orderId: razorpay_order_id, userId: user.id }
      });

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Transaction not found'
        });
      }

      // Verify signature
      const sign = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSign = crypto
        .createHmac('sha256', RAZORPAY_KEY_SECRET)
        .update(sign.toString())
        .digest('hex');

      if (razorpay_signature !== expectedSign) {
        console.error('❌ Invalid signature');
        transaction.status = 'failed';
        transaction.failureReason = 'Invalid signature';
        await transaction.save();

        return res.status(400).json({
          success: false,
          message: 'Payment verification failed - Invalid signature'
        });
      }

      console.log('✅ Signature verified');

      // Get payment details from Razorpay
      const payment = await razorpay.payments.fetch(razorpay_payment_id);
      
      console.log('💳 Payment details:', payment.status);

      // Update transaction
      transaction.paymentId = razorpay_payment_id;
      transaction.status = payment.status === 'captured' ? 'success' : 'failed';
      transaction.paymentMethod = payment.method;
      transaction.gatewayResponse = payment;

      if (payment.status === 'captured') {
        // Add credits to user
        await user.addCredits(transaction.credits);
        await transaction.save();

        console.log(`✅ Payment successful: ${razorpay_order_id}`);
        console.log(`   Added ${transaction.credits} credits to user ${user.id}`);

        res.json({
          success: true,
          message: 'Payment successful',
          credits: user.credits,
          creditsAdded: transaction.credits,
          transaction: {
            orderId: transaction.orderId,
            paymentId: transaction.paymentId,
            amount: transaction.amount,
            currency: transaction.currency,
            status: transaction.status
          }
        });
      } else {
        transaction.failureReason = payment.status;
        await transaction.save();

        res.status(400).json({
          success: false,
          message: 'Payment failed or pending',
          status: payment.status
        });
      }

    } catch (error) {
      console.error('❌ Verify payment error:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to verify payment',
        error: error.message
      });
    }
  }

  // Webhook handler
  async handleWebhook(req, res) {
    try {
      const webhookBody = JSON.stringify(req.body);
      const webhookSignature = req.headers['x-razorpay-signature'];
      
      console.log('📥 Razorpay webhook received');

      // Verify webhook signature
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || RAZORPAY_KEY_SECRET)
        .update(webhookBody)
        .digest('hex');

      if (webhookSignature !== expectedSignature) {
        console.error('❌ Invalid webhook signature');
        return res.status(400).json({ success: false, message: 'Invalid signature' });
      }

      const event = req.body.event;
      const payload = req.body.payload.payment.entity;

      console.log('📦 Webhook event:', event);
      console.log('   Order ID:', payload.order_id);
      console.log('   Payment ID:', payload.id);

      if (event === 'payment.captured') {
        // Find transaction
        const transaction = await PaymentTransaction.findOne({
          where: { orderId: payload.order_id }
        });

        if (!transaction) {
          console.error('❌ Transaction not found:', payload.order_id);
          return res.status(404).json({ success: false, message: 'Transaction not found' });
        }

        // Check if already processed
        if (transaction.status === 'success') {
          console.log('⚠️ Transaction already processed');
          return res.json({ success: true, message: 'Already processed' });
        }

        // Update transaction
        transaction.paymentId = payload.id;
        transaction.status = 'success';
        transaction.paymentMethod = payload.method;
        transaction.gatewayResponse = payload;

        // Add credits to user
        const user = await UserModel.findByPk(transaction.userId);
        if (user) {
          await user.addCredits(transaction.credits);
          console.log(`✅ Webhook: Added ${transaction.credits} credits to user ${user.id}`);
        }

        await transaction.save();
      } else if (event === 'payment.failed') {
        // Handle failed payment
        const transaction = await PaymentTransaction.findOne({
          where: { orderId: payload.order_id }
        });

        if (transaction) {
          transaction.status = 'failed';
          transaction.failureReason = payload.error_description || 'Payment failed';
          transaction.gatewayResponse = payload;
          await transaction.save();
          console.log('❌ Payment failed:', payload.order_id);
        }
      }

      res.json({ success: true, message: 'Webhook processed' });

    } catch (error) {
      console.error('❌ Webhook error:', error.message);
      res.status(500).json({ success: false, message: 'Webhook processing failed' });
    }
  }

  // Get payment history
  async getPaymentHistory(req, res) {
    try {
      const { limit = 20, offset = 0 } = req.query;
      const user = req.user;

      const transactions = await PaymentTransaction.findAll({
        where: { userId: user.id },
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      const total = await PaymentTransaction.count({
        where: { userId: user.id }
      });

      res.json({
        success: true,
        transactions,
        total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

    } catch (error) {
      console.error('❌ Get payment history error:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to get payment history'
      });
    }
  }

  // Get available packages
  getPackages(req, res) {
    res.json({
      success: true,
      packages: Object.entries(CREDIT_PACKAGES).map(([id, pkg]) => ({
        id,
        ...pkg
      }))
    });
  }
}

module.exports = new PaymentController();
