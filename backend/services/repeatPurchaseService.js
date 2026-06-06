// WooCommerce Repeat Purchase Automation Service
const mongoose = require('mongoose');
const WooCommerceOrder = require('../models/WooCommerceOrder');
const WooCommerceRepeatPurchase = require('../models/WooCommerceRepeatPurchase');
const WooCommerceIntegration = require('../models/WooCommerceIntegration');
const WhatsAppIntegration = require('../models/WhatsAppIntegration');
const whatsappService = require('./whatsappService');
const Template = require('../models/Template');

class RepeatPurchaseService {
  /**
   * Sync completed orders and detect repeat purchase opportunities
   */
  async syncRepeatPurchaseOpportunities(userId) {
    try {
      console.log(`🔄 Syncing repeat purchase opportunities for user: ${userId}`);

      // 1. Fetch and sync historical WooCommerce orders first to ensure database has orders
      try {
        const woocommerceService = require('./woocommerceService');
        await woocommerceService.fetchAndSyncHistoricalOrders(userId);
      } catch (syncErr) {
        console.error('⚠️ Failed to sync historical WooCommerce orders in repeatPurchaseService:', syncErr.message);
      }
      
      // Get WooCommerce integration settings for default reorder days
      const integration = await WooCommerceIntegration.findOne({ userId });
      const rpSettings = integration?.settings?.repeatPurchase || {};
      const defaultReorderDays = rpSettings.reorderDays || 30;
      const onlyCompleted = rpSettings.onlyCompleted !== false; // Default true
      const excludeCancelled = rpSettings.excludeCancelled !== false; // Default true
      const excludeRefunded = rpSettings.excludeRefunded !== false; // Default true
      const minOrderAmount = rpSettings.minOrderAmount || 0;

      // Build query to find orders
      const query = { userId };
      
      if (onlyCompleted) {
        query.status = 'completed';
      } else {
        // Exclude cancelled/refunded if checked
        const excludeStatuses = [];
        if (excludeCancelled) excludeStatuses.push('cancelled', 'failed');
        if (excludeRefunded) excludeStatuses.push('refunded');
        
        if (excludeStatuses.length > 0) {
          query.status = { $nin: excludeStatuses };
        }
      }

      if (minOrderAmount > 0) {
        query.totalAmount = { $gte: minOrderAmount };
      }

      // Fetch all valid orders sorted by date ascending to calculate cycles properly
      const orders = await WooCommerceOrder.find(query).sort({ dateCreated: 1, createdAt: 1 }).lean();
      
      if (orders.length === 0) {
        console.log(`ℹ️ No WooCommerce orders found matching query for user: ${userId}`);
        return { synced: 0, converted: 0 };
      }

      // Group line items by Customer + Product
      // Key: customerEmail_productId
      const customerProductsMap = new Map();
      const customerProfileMap = new Map();

      for (const order of orders) {
        const email = (order.customerEmail || '').toLowerCase().trim();
        if (!email) continue;

        // Store customer details for profile updates
        customerProfileMap.set(email, {
          id: order.billing?.customer_id || order.rawPayload?.customer_id || 'guest',
          name: order.customerName || 'Customer',
          phone: order.customerPhone || order.billing?.phone || '',
          city: order.billing?.city || '',
          currency: order.currency || 'INR'
        });

        const items = order.lineItems || [];
        for (const item of items) {
          const productId = String(item.product_id || item.id);
          if (!productId) continue;

          const key = `${email}_${productId}`;
          if (!customerProductsMap.has(key)) {
            customerProductsMap.set(key, []);
          }
          customerProductsMap.get(key).push({
            orderId: order.orderId,
            orderNumber: order.orderNumber,
            date: new Date(order.dateCreated || order.createdAt),
            totalAmount: order.totalAmount,
            productName: item.name || item.productName || 'Product',
            category: item.category || 'Default'
          });
        }
      }

      let syncedCount = 0;
      let convertedCount = 0;

      // Process each customer-product purchase history
      for (const [key, purchases] of customerProductsMap.entries()) {
        const [customerEmail, productId] = key.split('_');
        const profile = customerProfileMap.get(customerEmail);

        // Sort purchases by date ascending
        purchases.sort((a, b) => a.date - b.date);

        // Determine estimated repeat purchase cycle
        let cycleDays = defaultReorderDays;
        if (purchases.length > 1) {
          let totalGaps = 0;
          let gapCount = 0;
          for (let i = 1; i < purchases.length; i++) {
            const gapMs = purchases[i].date - purchases[i - 1].date;
            const gapDays = gapMs / (1000 * 60 * 60 * 24);
            if (gapDays > 1) { // Filter out same-day duplicates
              totalGaps += gapDays;
              gapCount++;
            }
          }
          if (gapCount > 0) {
            cycleDays = Math.round(totalGaps / gapCount);
            // Put boundary checks to avoid unrealistic cycle days
            if (cycleDays < 3) cycleDays = 3;
            if (cycleDays > 365) cycleDays = 365;
          }
        }

        const latestPurchase = purchases[purchases.length - 1];
        const lastOrderDate = latestPurchase.date;
        const reorderDueDate = new Date(lastOrderDate.getTime() + cycleDays * 24 * 60 * 60 * 1000);

        // Calculate Customer Stats
        const customerPurchases = Array.from(customerProductsMap.entries())
          .filter(([k]) => k.startsWith(`${customerEmail}_`))
          .flatMap(([, items]) => items);
        
        const totalSpend = customerPurchases.reduce((acc, curr) => acc + curr.totalAmount, 0);
        const totalOrders = new Set(customerPurchases.map(p => p.orderId)).size;
        const vipStatus = totalSpend >= (rpSettings.vipSpendThreshold || 5000) || totalOrders >= (rpSettings.vipOrdersThreshold || 5);

        // Check if opportunity already exists in database
        const existingOpportunity = await WooCommerceRepeatPurchase.findOne({
          userId,
          customerEmail,
          productId
        });

        if (!existingOpportunity) {
          // Create new opportunity
          await WooCommerceRepeatPurchase.create({
            userId,
            customerId: profile.id,
            customerName: profile.name,
            customerEmail,
            customerPhone: profile.phone,
            productId,
            productName: latestPurchase.productName,
            productCategory: latestPurchase.category,
            lastOrderId: latestPurchase.orderId,
            lastOrderNumber: latestPurchase.orderNumber,
            lastOrderDate,
            reorderCycleDays: cycleDays,
            reorderDueDate,
            automationStatus: rpSettings.enabled ? 'pending' : 'paused',
            city: profile.city,
            totalSpend,
            totalOrders,
            vipStatus
          });
          syncedCount++;
        } else {
          // Opportunity exists
          // Check if there is a newer order since we last synced
          if (existingOpportunity.lastOrderId !== latestPurchase.orderId) {
            
            // If the reminder was sent previously, it counts as a CONVERSION!
            if (existingOpportunity.automationStatus === 'sent') {
              existingOpportunity.automationStatus = 'converted';
              existingOpportunity.recoveredOrderId = latestPurchase.orderId;
              existingOpportunity.revenueGenerated = latestPurchase.totalAmount;
              convertedCount++;
              
              // Reset reminder state for the next cycle
              existingOpportunity.reminderCount = 0;
              existingOpportunity.couponGenerated = null;
            }

            // Update details with the latest purchase info
            existingOpportunity.lastOrderId = latestPurchase.orderId;
            existingOpportunity.lastOrderNumber = latestPurchase.orderNumber;
            existingOpportunity.lastOrderDate = lastOrderDate;
            existingOpportunity.reorderCycleDays = cycleDays;
            existingOpportunity.reorderDueDate = reorderDueDate;
            existingOpportunity.city = profile.city;
            existingOpportunity.totalSpend = totalSpend;
            existingOpportunity.totalOrders = totalOrders;
            existingOpportunity.vipStatus = vipStatus;
            
            // Put it back to pending if converted or failed
            if (existingOpportunity.automationStatus === 'converted' || existingOpportunity.automationStatus === 'failed') {
              // It is now pending for the next cycle
              existingOpportunity.automationStatus = rpSettings.enabled ? 'pending' : 'paused';
            }

            await existingOpportunity.save();
            syncedCount++;
          } else {
            // No new order, just update profile stats in case they bought other things or settings changed
            existingOpportunity.city = profile.city;
            existingOpportunity.totalSpend = totalSpend;
            existingOpportunity.totalOrders = totalOrders;
            existingOpportunity.vipStatus = vipStatus;
            existingOpportunity.reorderCycleDays = cycleDays;
            existingOpportunity.reorderDueDate = reorderDueDate;
            
            // Update automation status if globally enabled/disabled and currently not sent
            if (existingOpportunity.automationStatus === 'pending' && !rpSettings.enabled) {
              existingOpportunity.automationStatus = 'paused';
            } else if (existingOpportunity.automationStatus === 'paused' && rpSettings.enabled) {
              existingOpportunity.automationStatus = 'pending';
            }

            await existingOpportunity.save();
          }
        }
      }

      console.log(`✅ Repeat Purchase Sync complete: Synced ${syncedCount} items, Detected ${convertedCount} conversions.`);
      return { synced: syncedCount, converted: convertedCount };
    } catch (err) {
      console.error('❌ Service Error in syncRepeatPurchaseOpportunities:', err.message);
      throw err;
    }
  }

  /**
   * Send WhatsApp reminder for a repeat purchase opportunity
   */
  async sendReorderReminder(userId, opportunityId) {
    try {
      const opportunity = await WooCommerceRepeatPurchase.findOne({ _id: opportunityId, userId });
      if (!opportunity) throw new Error('Repeat purchase opportunity not found');

      const phone = (opportunity.customerPhone || '').replace(/\D/g, '');
      if (!phone) throw new Error('Customer phone number missing');

      // Find user's active WhatsApp integration
      const integration = await WhatsAppIntegration.findOne({ userId, status: 'connected' });
      if (!integration) throw new Error('WhatsApp integration not connected');

      // Get repeat purchase settings
      const wooIntegration = await WooCommerceIntegration.findOne({ userId });
      const rpSettings = wooIntegration?.settings?.repeatPurchase || {};

      let templateName = rpSettings.whatsappTemplate || 'repeat_purchase_reminder';
      const usedLanguage = 'en_US'; // Strict default

      // Generate coupon code if configured
      let couponCode = '';
      if (rpSettings.enableCoupon) {
        const coupons = ['REORDER10', 'WELCOMEBACK15', 'VIP20', 'RELOAD15', 'LOVED10'];
        couponCode = opportunity.couponGenerated || rpSettings.defaultCoupon || coupons[Math.floor(Math.random() * coupons.length)];
        opportunity.couponGenerated = couponCode;
      }

      // Build available dynamic parameters
      // 1. Customer Name
      // 2. Product Name
      // 3. Coupon Code (if generated)
      // 4. Shop Name / Reorder URL
      const availableParams = [
        opportunity.customerName || 'Friend',
        opportunity.productName || 'your favorite items',
        couponCode || 'REORDER10',
        wooIntegration.storeUrl ? `https://${wooIntegration.storeUrl}` : 'our shop'
      ];

      // Check if template exists in system
      const template = await Template.findOne({ metaTemplateName: templateName });
      
      const { buildTemplatePayload } = require('../utils/templateUtils');
      const bodyParams = buildTemplatePayload(template, availableParams);

      console.log(`📤 Sending Repeat Purchase WhatsApp Template: ${templateName} to +${phone}`);

      try {
        const result = await whatsappService.sendTemplateMessage({
          userId,
          to: phone,
          templateName,
          language: usedLanguage,
          bodyParams
        });

        if (result && !result.error) {
          opportunity.automationStatus = 'sent';
          opportunity.whatsappDeliveryStatus = 'sent';
          opportunity.reminderCount += 1;
          await opportunity.save();
          return { success: true, message: 'WhatsApp reminder sent successfully' };
        } else {
          opportunity.automationStatus = 'failed';
          opportunity.whatsappDeliveryStatus = 'failed';
          await opportunity.save();
          return { success: false, error: result?.error || 'Rejected by Meta API' };
        }
      } catch (err) {
        console.error('❌ Meta API WhatsApp Error:', err.message);
        opportunity.automationStatus = 'failed';
        opportunity.whatsappDeliveryStatus = 'failed';
        await opportunity.save();
        return { success: false, error: err.message };
      }
    } catch (err) {
      console.error('❌ Service Error in sendReorderReminder:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Get analytical details for repeat purchases dashboard
   */
  async getRepeatPurchaseStats(userId) {
    try {
      const stats = await WooCommerceRepeatPurchase.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: null,
            totalRepeatCustomers: { $addToSet: '$customerEmail' },
            automatedRemindersSent: { $sum: '$reminderCount' },
            recoveredOrders: { $sum: { $cond: [{ $eq: ['$automationStatus', 'converted'] }, 1, 0] } },
            repeatRevenueGenerated: { $sum: '$revenueGenerated' },
            pendingOpportunities: { $sum: { $cond: [{ $eq: ['$automationStatus', 'pending'] }, 1, 0] } }
          }
        }
      ]);

      const result = stats[0] || {
        totalRepeatCustomers: [],
        automatedRemindersSent: 0,
        recoveredOrders: 0,
        repeatRevenueGenerated: 0,
        pendingOpportunities: 0
      };

      // Calculate conversion rate
      const totalSent = await WooCommerceRepeatPurchase.countDocuments({ userId, reminderCount: { $gt: 0 } });
      const conversions = await WooCommerceRepeatPurchase.countDocuments({ userId, automationStatus: 'converted' });
      const conversionRate = totalSent > 0 ? Math.round((conversions / totalSent) * 100) : 0;

      // Get top repeated products
      const topProducts = await WooCommerceRepeatPurchase.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: '$productName',
            count: { $sum: 1 },
            conversions: { $sum: { $cond: [{ $eq: ['$automationStatus', 'converted'] }, 1, 0] } },
            revenue: { $sum: '$revenueGenerated' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]);

      return {
        totalRepeatCustomers: Array.isArray(result.totalRepeatCustomers) ? result.totalRepeatCustomers.length : 0,
        automatedRemindersSent: result.automatedRemindersSent,
        recoveredOrders: result.recoveredOrders,
        repeatRevenueGenerated: Math.round(result.repeatRevenueGenerated),
        pendingOpportunities: result.pendingOpportunities,
        whatsappConversionRate: conversionRate,
        topProducts: topProducts.map(p => ({
          name: p._id,
          count: p.count,
          conversions: p.conversions,
          revenue: Math.round(p.revenue)
        }))
      };
    } catch (err) {
      console.error('❌ Service Error in getRepeatPurchaseStats:', err.message);
      throw err;
    }
  }
}

module.exports = new RepeatPurchaseService();
