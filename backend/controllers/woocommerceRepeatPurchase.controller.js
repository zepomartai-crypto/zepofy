// WooCommerce Repeat Purchase Controller
const repeatPurchaseService = require('../services/repeatPurchaseService');
const WooCommerceRepeatPurchase = require('../models/WooCommerceRepeatPurchase');
const WooCommerceIntegration = require('../models/WooCommerceIntegration');

/**
 * Sync completed WooCommerce orders to calculate repeat purchase opportunities
 */
exports.syncOpportunities = async (req, res) => {
  try {
    const result = await repeatPurchaseService.syncRepeatPurchaseOpportunities(req.userId);
    res.json({
      success: true,
      message: `Successfully synchronized repeat purchase opportunities.`,
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Get repeat purchase opportunities list with advanced filtering
 */
exports.getOpportunities = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = 'all' } = req.query;
    const query = { userId: req.userId };

    // Search filter (customer email, customer name, product name)
    if (search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { customerName: searchRegex },
        { customerEmail: searchRegex },
        { productName: searchRegex }
      ];
    }

    // Status filter
    if (status !== 'all') {
      query.automationStatus = status;
    }

    const items = await WooCommerceRepeatPurchase.find(query)
      .sort({ reorderDueDate: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await WooCommerceRepeatPurchase.countDocuments(query);

    res.json({
      success: true,
      data: items,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Get aggregated analytics for Repeat Purchase Dashboard
 */
exports.getStats = async (req, res) => {
  try {
    const stats = await repeatPurchaseService.getRepeatPurchaseStats(req.userId);
    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Send a manual WhatsApp reminder message to a repeat purchase contact
 */
exports.sendReminder = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await repeatPurchaseService.sendReorderReminder(req.userId, id);
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Get repeat purchase settings from WooCommerce integration
 */
exports.getSettings = async (req, res) => {
  try {
    const integration = await WooCommerceIntegration.findOne({ userId: req.userId });
    if (!integration) {
      return res.status(404).json({ success: false, error: 'WooCommerce integration not found' });
    }
    
    res.json({
      success: true,
      data: integration.settings?.repeatPurchase || {
        enabled: false,
        reorderDays: 30,
        onlyCompleted: true,
        excludeCancelled: true,
        excludeRefunded: true,
        enableCoupon: false,
        whatsappTemplate: 'repeat_purchase_reminder',
        minOrderAmount: 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Save repeat purchase settings to WooCommerce integration
 */
exports.saveSettings = async (req, res) => {
  try {
    const integration = await WooCommerceIntegration.findOne({ userId: req.userId });
    if (!integration) {
      return res.status(404).json({ success: false, error: 'WooCommerce integration not found' });
    }

    const settings = integration.settings || {};
    settings.repeatPurchase = {
      ...settings.repeatPurchase,
      ...req.body.settings
    };

    integration.settings = settings;
    await integration.save();

    // Trigger sync post-save so opportunities are refreshed under new settings
    try {
      await repeatPurchaseService.syncRepeatPurchaseOpportunities(req.userId);
    } catch (syncErr) {
      console.error('⚠️ Sync failed after saving settings:', syncErr.message);
    }

    res.json({
      success: true,
      message: 'Repeat purchase automation settings updated successfully',
      data: settings.repeatPurchase
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
