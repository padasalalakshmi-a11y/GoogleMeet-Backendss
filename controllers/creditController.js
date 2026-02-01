const UserModel = require('../models/UserModel');
const CreditUsageLog = require('../models/CreditUsageLog');
const { Op } = require('sequelize');

class CreditController {
  // Get current user credits
  async getCredits(req, res) {
    try {
      const user = await UserModel.findByPk(req.user.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        credits: user.credits,
        plan: user.plan
      });
    } catch (error) {
      console.error('Get credits error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get credits'
      });
    }
  }

  // Get credit usage history
  async getUsageHistory(req, res) {
    try {
      const { limit = 50, offset = 0 } = req.query;

      const logs = await CreditUsageLog.findAll({
        where: { userId: req.user.id },
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      const total = await CreditUsageLog.count({
        where: { userId: req.user.id }
      });

      res.json({
        success: true,
        logs,
        total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } catch (error) {
      console.error('Get usage history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get usage history'
      });
    }
  }

  // Get usage statistics
  async getUsageStats(req, res) {
    try {
      const { period = '30d' } = req.query;
      
      // Calculate date range
      const now = new Date();
      let startDate = new Date();
      
      switch(period) {
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(now.getDate() - 90);
          break;
        default:
          startDate.setDate(now.getDate() - 30);
      }

      const logs = await CreditUsageLog.findAll({
        where: {
          userId: req.user.id,
          createdAt: {
            [Op.gte]: startDate
          }
        }
      });

      const totalCreditsUsed = logs.reduce((sum, log) => sum + log.creditsUsed, 0);
      const totalSessions = logs.length;
      const avgCreditsPerSession = totalSessions > 0 ? totalCreditsUsed / totalSessions : 0;

      res.json({
        success: true,
        stats: {
          period,
          totalCreditsUsed,
          totalSessions,
          avgCreditsPerSession: Math.round(avgCreditsPerSession * 10) / 10,
          currentCredits: req.user.credits
        }
      });
    } catch (error) {
      console.error('Get usage stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get usage statistics'
      });
    }
  }

  // Purchase credits (placeholder for payment integration)
  async purchaseCredits(req, res) {
    try {
      const { amount, paymentMethod } = req.body;

      // Validate amount
      const validAmounts = [100, 500, 1000, 5000];
      if (!validAmounts.includes(amount)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid credit amount'
        });
      }

      // TODO: Integrate with payment gateway (Stripe/Razorpay)
      // For now, this is a placeholder

      res.json({
        success: false,
        message: 'Payment integration coming soon',
        note: 'This feature will be available in the next update'
      });
    } catch (error) {
      console.error('Purchase credits error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to purchase credits'
      });
    }
  }

  // Admin: Add credits to user (for testing/support)
  async addCredits(req, res) {
    try {
      const { userId, amount, reason } = req.body;

      if (!userId || !amount) {
        return res.status(400).json({
          success: false,
          message: 'User ID and amount are required'
        });
      }

      const user = await UserModel.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const newBalance = await user.addCredits(amount);

      console.log(`✅ Added ${amount} credits to user ${userId}. New balance: ${newBalance}`);
      console.log(`   Reason: ${reason || 'Not specified'}`);

      res.json({
        success: true,
        message: `Added ${amount} credits successfully`,
        newBalance
      });
    } catch (error) {
      console.error('Add credits error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add credits'
      });
    }
  }
}

module.exports = new CreditController();
