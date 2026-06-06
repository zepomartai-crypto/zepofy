// controllers/settings.controller.js
const Settings = require("../models/Settings");
const Template = require("../models/Template");
const WhatsAppIntegration = require("../models/WhatsAppIntegration");
const axios = require("axios");
const crypto = require("crypto");

// Helper function to validate Meta API token
const validateMetaToken = async (accessToken, phoneNumberId) => {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${phoneNumberId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    return {
      valid: true,
      data: {
        phoneNumberId: response.data.id,
        displayName: response.data.display_phone_number,
        verifiedName: response.data.verified_name
      }
    };
  } catch (error) {
    console.error("Meta API validation failed:", error.response?.data || error.message);
    return {
      valid: false,
      error: error.response?.data?.error?.message || error.message
    };
  }
};

// Helper function to generate webhook verify token
const generateWebhookToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Helper function to validate webhook URL
const validateWebhookUrl = async (url) => {
  if (!url) return { valid: false, error: "Webhook URL is required" };

  try {
    const response = await axios.head(url, { timeout: 5000 });
    return { valid: true, status: response.status };
  } catch (error) {
    return { valid: false, error: "Webhook URL is not reachable" };
  }
};

// Helper function to generate API key
const generateApiKey = () => {
  return `wauto_${crypto.randomBytes(32).toString('hex')}`;
};

// Helper function to mask sensitive data
const maskSensitiveData = (settings) => {
  if (!settings) return {};
  const masked = { ...settings };
  if (masked.security?.twoFactorAuth?.secret) {
    masked.security.twoFactorAuth.secret = "***MASKED***";
  }
  if (masked.security?.apiKeys && Array.isArray(masked.security.apiKeys)) {
    masked.security.apiKeys = masked.security.apiKeys.map(key => ({
      ...key,
      key: key.key && typeof key.key === 'string' ? key.key.substring(0, 8) + "***MASKED***" : ""
    }));
  }
  return masked;
};

exports.connectWhatsApp = async (req, res) => {
  try {
    const { phoneNumberId, accessToken, wabaId, appId } = req.body;

    if (!phoneNumberId || !accessToken || !wabaId) {
      return res.status(400).json({
        success: false,
        error: "Phone Number ID, Access Token, and WABA ID are required"
      });
    }

    // Validate with Meta API first
    const validation = await validateMetaToken(accessToken, phoneNumberId);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: "Invalid WhatsApp credentials",
        details: validation.error
      });
    }

    // Check if integration already exists
    const existing = await WhatsAppIntegration.findOne({ userId: req.userId });

    const integrationData = {
      userId: req.userId,
      phoneNumberId,
      accessToken,
      wabaId,
      appId,
      businessPhoneNumber: validation.data.displayName,
      status: 'connected',
      connectedAt: new Date(),
      lastVerifiedAt: new Date(),
      errorMessage: null,
      webhookVerifyToken: generateWebhookToken()
    };

    let integration;
    if (existing) {
      // Update existing integration
      integration = await WhatsAppIntegration.findOneAndUpdate(
        { userId: req.userId },
        integrationData,
        { new: true }
      );
    } else {
      // Create new integration
      integration = await WhatsAppIntegration.create(integrationData);
    }

    console.log(`✅ WhatsApp connected for user ${req.userId}`, {
      phoneNumberId,
      displayName: validation.data.displayName,
      verifiedName: validation.data.verifiedName
    });

    res.json({
      success: true,
      message: "WhatsApp Business API connected successfully",
      data: {
        id: integration._id,
        phoneNumberId: integration.phoneNumberId,
        businessPhoneNumber: integration.businessPhoneNumber,
        status: integration.status,
        connectedAt: integration.connectedAt
      }
    });

  } catch (error) {
    console.error("WhatsApp connection error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to connect WhatsApp Business API",
      details: error.message
    });
  }
};

exports.disconnectWhatsApp = async (req, res) => {
  try {
    const integration = await WhatsAppIntegration.findOne({ userId: req.userId });

    if (!integration) {
      return res.status(404).json({
        success: false,
        error: "No WhatsApp integration found"
      });
    }

    // Update status to disconnected (keep data for reconnection)
    await WhatsAppIntegration.findOneAndUpdate(
      { userId: req.userId },
      {
        status: 'not_connected',
        disconnectedAt: new Date(),
        errorMessage: 'User disconnected'
      }
    );

    console.log(`🔌 WhatsApp disconnected for user ${req.userId}`);

    res.json({
      success: true,
      message: "WhatsApp Business API disconnected successfully"
    });

  } catch (error) {
    console.error("WhatsApp disconnection error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to disconnect WhatsApp Business API"
    });
  }
};

exports.getWhatsAppIntegration = async (req, res) => {
  try {
    const WhatsAppIntegration = require('../models/WhatsAppIntegration');
    const integration = await WhatsAppIntegration.findByUserIdWithToken(req.userId);

    if (!integration) {
      return res.json({
        success: true,
        data: {
          connected: false,
          phoneNumberId: null,
          businessNumber: null,
          wabaId: null,
          connectedAt: null,
          lastSync: null
        }
      });
    }

    // Use the existing validation logic from integrations controller
    let validation;
    try {
      validation = await validateMetaToken(integration.accessToken, integration.phoneNumberId);
    } catch (err) {
      console.error('Meta API validation failed:', err);
      validation = { valid: false, error: 'Validation failed' };
    }

    const whatsappIntegrationService = require('../services/whatsappIntegrationService');
    const webhookInfo = whatsappIntegrationService.getWebhookUrls(integration);

    const responseData = {
      connected: validation.valid,
      phoneNumberId: integration.phoneNumberId,
      businessNumber: integration.businessPhoneNumber,
      wabaId: integration.wabaId,
      connectedAt: integration.connectedAt,
      lastSync: integration.lastVerifiedAt,
      webhookUrl: webhookInfo.webhookUrl,
      webhookVerifyToken: integration.webhookVerifyToken
    };

    if (!validation.valid) {
      responseData.errorMessage = validation.error;
      // Update integration status to error
      try {
        await WhatsAppIntegration.findOneAndUpdate(
          { userId: req.userId },
          {
            status: 'error',
            errorMessage: validation.error,
            lastVerifiedAt: new Date()
          }
        );
      } catch (updateErr) {
        console.error('Failed to update WhatsApp status:', updateErr);
      }
    }

    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error("Get WhatsApp integration error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch settings"
    });
  }
};

exports.getWhatsAppStatus = async (req, res) => {
  try {
    const integration = await WhatsAppIntegration.findByUserIdWithToken(req.userId);

    if (!integration) {
      return res.json({
        success: true,
        data: {
          connected: false,
          phoneNumberId: null,
          businessNumber: null,
          wabaId: null,
          connectedAt: null,
          lastSync: null
        }
      });
    }

    // Verify current token validity
    const validation = await validateMetaToken(integration.accessToken, integration.phoneNumberId);

    const responseData = {
      connected: validation.valid,
      phoneNumberId: integration.phoneNumberId,
      businessNumber: integration.businessPhoneNumber,
      wabaId: integration.wabaId,
      connectedAt: integration.connectedAt,
      lastSync: integration.lastVerifiedAt
    };

    if (!validation.valid) {
      responseData.errorMessage = validation.error;
      // Update integration status to error
      await WhatsAppIntegration.findOneAndUpdate(
        { userId: req.userId },
        {
          status: 'error',
          errorMessage: validation.error,
          lastVerifiedAt: new Date()
        }
      );
    }

    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error("Get WhatsApp status error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch settings"
    });
  }
};

exports.saveAutomationSettings = async (req, res) => {
  try {
    const { autoReply, retrySettings, notifications } = req.body;

    const updates = {};

    if (autoReply !== undefined) {
      updates['messaging.autoReply.enabled'] = autoReply.enabled;
      updates['messaging.autoReply.templateId'] = autoReply.templateId || null;
      updates['messaging.autoReply.delayMinutes'] = autoReply.delayMinutes || 1;
      updates['messaging.autoReply.businessHoursOnly'] = autoReply.businessHoursOnly || false;
    }

    if (retrySettings !== undefined) {
      updates['messaging.retries'] = Math.max(1, Math.min(10, retrySettings.maxRetries || 3));
      updates['messaging.rateLimiting.enabled'] = retrySettings.rateLimiting !== false;
      updates['messaging.rateLimiting.messagesPerMinute'] = Math.max(1, Math.min(100, retrySettings.messagesPerMinute || 30));
    }

    if (notifications !== undefined) {
      updates['notifications.email.enabled'] = notifications.email !== false;
      updates['notifications.webhook.enabled'] = notifications.webhookFailures !== false;
      updates['notifications.email.events'] = notifications.events || ['message_failed', 'quota_exceeded'];
    }

    updates.metadata = {
      lastModifiedBy: req.userId,
      changelog: [{
        field: 'automation_settings',
        newValue: updates,
        modifiedAt: new Date(),
        modifiedBy: req.userId
      }]
    };

    const settings = await Settings.findOneAndUpdate(
      { userId: req.userId },
      updates,
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: "Automation settings saved successfully",
      data: settings
    });

  } catch (error) {
    console.error("Save automation settings error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to save automation settings"
    });
  }
};

exports.getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne({ userId: req.userId })
      .populate('messaging.autoReply.templateId')
      .populate('messaging.templates.defaultWelcome')
      .populate('messaging.templates.defaultGoodbye')
      .populate('messaging.templates.defaultError');

    if (!settings) {
      // Create default settings for new user
      settings = await Settings.create({
        userId: req.userId,
        metadata: { lastModifiedBy: req.userId }
      });
    }

    // Ensure nested structures exist
    if (!settings.whatsapp) settings.whatsapp = {};
    if (!settings.webhook) settings.webhook = {};
    if (!settings.messaging) settings.messaging = { autoReply: {}, rateLimiting: {}, templates: {} };

    // Get WhatsApp integration status - SAFE VERSION
    try {
      const WhatsAppIntegration = require('../models/WhatsAppIntegration');
      const whatsappIntegration = await WhatsAppIntegration.findByUserIdWithToken(req.userId);
      if (whatsappIntegration) {
        // Update settings with WhatsApp data
        settings.whatsapp.status = whatsappIntegration.status || 'not_connected';
        settings.whatsapp.phoneNumber = whatsappIntegration.businessPhoneNumber;
        settings.whatsapp.phoneNumberId = whatsappIntegration.phoneNumberId;
        settings.whatsapp.businessAccountId = whatsappIntegration.wabaId;
        settings.whatsapp.lastSyncAt = whatsappIntegration.lastVerifiedAt;
      } else {
        settings.whatsapp.status = 'not_connected';
      }
    } catch (err) {
      console.error('WhatsApp integration fetch error:', err);
      settings.whatsapp.status = 'not_connected';
    }

    // Get WooCommerce Status
    try {
      const WooCommerceIntegration = require('../models/WooCommerceIntegration');
      const wooIntegration = await WooCommerceIntegration.findOne({ userId: req.userId });
      if (wooIntegration) {
        settings.woocommerce = {
          connected: wooIntegration.status === 'connected',
          storeUrl: wooIntegration.storeUrl,
          lastSync: wooIntegration.lastSyncAt
        };
      }
    } catch (err) {
      console.error('WooCommerce integration fetch error:', err);
    }

    // Get Shopify Status
    try {
      const ShopifyIntegration = require('../models/ShopifyIntegration');
      const shopifyIntegration = await ShopifyIntegration.findOne({ userId: req.userId });
      if (shopifyIntegration) {
        settings.shopify = {
          connected: shopifyIntegration.status === 'connected',
          storeDomain: shopifyIntegration.storeDomain,
          lastSync: shopifyIntegration.lastSyncAt
        };
      }
    } catch (err) {
      console.error('Shopify integration fetch error:', err);
    }

    // Mask sensitive data for response
    const maskedSettings = maskSensitiveData(settings.toObject());

    res.json({
      success: true,
      data: maskedSettings
    });
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch settings",
      message: error.message
    });
  }
};

exports.saveSettings = async (req, res) => {
  try {
    const updates = { ...req.body };
    updates.metadata = {
      ...updates.metadata,
      lastModifiedBy: req.userId,
      version: (updates.metadata?.version || 0) + 1
    };

    // Validate webhook URL if provided
    if (updates.webhook?.url) {
      const webhookValidation = await validateWebhookUrl(updates.webhook.url);
      if (!webhookValidation.valid) {
        return res.status(400).json({
          success: false,
          error: webhookValidation.error
        });
      }
      updates.webhook.lastTestAt = new Date();
      updates.webhook.lastTestStatus = "validated";
    }

    // Update settings with upsert
    const settings = await Settings.findOneAndUpdate(
      { userId: req.userId },
      updates,
      {
        upsert: true,
        new: true,
        runValidators: true
      }
    ).populate('messaging.autoReply.templateId')
      .populate('messaging.templates.defaultWelcome')
      .populate('messaging.templates.defaultGoodbye')
      .populate('messaging.templates.defaultError');

    // Log important changes
    if (updates.security || updates.webhook) {
      console.log(`Security settings updated for user ${req.userId}`, {
        timestamp: new Date().toISOString(),
        changes: Object.keys(updates)
      });
    }

    const maskedSettings = maskSensitiveData(settings.toObject());

    res.json({
      success: true,
      data: maskedSettings,
      message: "Settings saved successfully"
    });
  } catch (error) {
    console.error("Error saving settings:", error);
    res.status(500).json({
      success: false,
      error: "Failed to save settings",
      details: error.message
    });
  }
};

exports.testWebhook = async (req, res) => {
  try {
    const settings = await Settings.findOne({ userId: req.userId });

    if (!settings?.webhook?.url) {
      return res.status(400).json({
        success: false,
        error: "Webhook URL not configured"
      });
    }

    const testPayload = {
      test: true,
      timestamp: new Date().toISOString(),
      event: "webhook_test",
      userId: req.userId,
      message: "Webhook test from Wauto",
      metadata: {
        source: "settings_page",
        testId: crypto.randomBytes(16).toString('hex')
      }
    };

    const startTime = Date.now();
    const response = await axios.post(settings.webhook.url, testPayload, {
      timeout: settings.webhook.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Wauto-Webhook-Test/1.0',
        'X-Wauto-Signature': crypto
          .createHmac('sha256', settings.webhook.secret || '')
          .update(JSON.stringify(testPayload))
          .digest('hex')
      }
    });
    const responseTime = Date.now() - startTime;

    // Update webhook test status
    await Settings.findOneAndUpdate(
      { userId: req.userId },
      {
        'webhook.lastTestAt': new Date(),
        'webhook.lastTestStatus': 'success',
        'webhook.lastTestResponseTime': responseTime
      }
    );

    res.json({
      success: true,
      message: "Webhook test successful",
      data: {
        responseTime: `${responseTime}ms`,
        statusCode: response.status,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("Webhook test failed:", error);

    // Update webhook test status
    await Settings.findOneAndUpdate(
      { userId: req.userId },
      {
        'webhook.lastTestAt': new Date(),
        'webhook.lastTestStatus': 'failed',
        'webhook.lastTestError': error.message
      }
    );

    res.status(400).json({
      success: false,
      error: "Webhook test failed",
      details: error.message
    });
  }
};

exports.createApiKey = async (req, res) => {
  try {
    const { name, permissions, expiresAt } = req.body;

    if (!name || !permissions || !Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        error: "Name and permissions are required"
      });
    }

    const apiKey = generateApiKey();
    const newApiKey = {
      name,
      key: apiKey,
      permissions,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdAt: new Date(),
      isActive: true
    };

    await Settings.findOneAndUpdate(
      { userId: req.userId },
      {
        $push: { 'security.apiKeys': newApiKey },
        'metadata.lastModifiedBy': req.userId
      }
    );

    res.json({
      success: true,
      data: {
        ...newApiKey,
        key: apiKey // Return full key only on creation
      },
      message: "API key created successfully"
    });
  } catch (error) {
    console.error("Error creating API key:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create API key"
    });
  }
};

exports.revokeApiKey = async (req, res) => {
  try {
    const { keyId } = req.params;

    await Settings.findOneAndUpdate(
      { userId: req.userId, 'security.apiKeys._id': keyId },
      {
        $set: { 'security.apiKeys.$.isActive': false },
        'metadata.lastModifiedBy': req.userId
      }
    );

    res.json({
      success: true,
      message: "API key revoked successfully"
    });
  } catch (error) {
    console.error("Error revoking API key:", error);
    res.status(500).json({
      success: false,
      error: "Failed to revoke API key"
    });
  }
};

exports.getApiKeys = async (req, res) => {
  try {
    const settings = await Settings.findOne({ userId: req.userId });

    if (!settings?.security?.apiKeys) {
      return res.json({ success: true, data: [] });
    }

    // Mask API keys for security
    const maskedKeys = settings.security.apiKeys.map(key => ({
      ...key.toObject(),
      key: key.key.substring(0, 8) + "***MASKED***"
    }));

    res.json({
      success: true,
      data: maskedKeys
    });
  } catch (error) {
    console.error("Error fetching API keys:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch API keys"
    });
  }
};

exports.exportSettings = async (req, res) => {
  try {
    const settings = await Settings.findOne({ userId: req.userId });

    if (!settings) {
      return res.status(404).json({
        success: false,
        error: "Settings not found"
      });
    }

    // Create export-friendly version (exclude sensitive data)
    const exportData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      settings: {
        webhook: settings.webhook,
        messaging: settings.messaging,
        notifications: settings.notifications,
        business: settings.business,
        advanced: settings.advanced
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="wauto-settings-${new Date().toISOString().split('T')[0]}.json"`);

    res.json(exportData);
  } catch (error) {
    console.error("Error exporting settings:", error);
    res.status(500).json({
      success: false,
      error: "Failed to export settings"
    });
  }
};

exports.importSettings = async (req, res) => {
  try {
    const { settings: importData } = req.body;

    if (!importData) {
      return res.status(400).json({
        success: false,
        error: "No settings data provided"
      });
    }

    // Validate import data structure
    const allowedSections = ['webhook', 'messaging', 'notifications', 'business', 'advanced'];
    const updates = {};

    allowedSections.forEach(section => {
      if (importData[section]) {
        updates[section] = importData[section];
      }
    });

    updates.metadata = {
      lastModifiedBy: req.userId,
      version: 1,
      changelog: [{
        field: 'import',
        newValue: 'Settings imported from file',
        modifiedAt: new Date(),
        modifiedBy: req.userId
      }]
    };

    const result = await Settings.findOneAndUpdate(
      { userId: req.userId },
      { $set: updates },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      message: "Settings imported successfully",
      data: result
    });
  } catch (error) {
    console.error("Error importing settings:", error);
    res.status(500).json({
      success: false,
      error: "Failed to import settings"
    });
  }
};

// WooCommerce Integration Handlers
exports.connectWooCommerce = async (req, res) => {
  try {
    const { store_url, consumer_key, consumer_secret } = req.body;

    if (!store_url || !consumer_key || !consumer_secret) {
      return res.status(400).json({
        success: false,
        error: "Store URL, Consumer Key, and Consumer Secret are required"
      });
    }

    // Test WooCommerce connection
    const axios = require('axios');
    const testUrl = `${store_url}/wp-json/wc/v3/system_status`;

    try {
      const response = await axios.get(testUrl, {
        auth: {
          username: consumer_key,
          password: consumer_secret
        },
        timeout: 10000
      });

      if (response.status === 200) {
        // Save integration to database
        const crypto = require('crypto');
        const encryptedSecret = crypto.createHash('sha256').update(consumer_secret).digest('hex');

        await Settings.findOneAndUpdate(
          { userId: req.userId },
          {
            $set: {
              'woocommerce': {
                type: 'woocommerce',
                store_url,
                consumer_key,
                consumer_secret: encryptedSecret,
                status: 'connected',
                connected_at: new Date(),
                last_tested_at: new Date()
              }
            }
          },
          { new: true, upsert: true }
        );

        res.json({
          success: true,
          message: "WooCommerce connected successfully"
        });
      } else {
        res.status(400).json({
          success: false,
          error: "Invalid WooCommerce credentials"
        });
      }
    } catch (testError) {
      res.status(400).json({
        success: false,
        error: "Failed to connect to WooCommerce store. Please check your credentials and store URL."
      });
    }
  } catch (error) {
    console.error("WooCommerce connection error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to connect WooCommerce"
    });
  }
};

exports.testWooCommerceConnection = async (req, res) => {
  try {
    const { store_url, consumer_key, consumer_secret } = req.body;

    if (!store_url || !consumer_key || !consumer_secret) {
      return res.status(400).json({
        success: false,
        error: "Store URL, Consumer Key, and Consumer Secret are required"
      });
    }

    const axios = require('axios');
    const testUrl = `${store_url}/wp-json/wc/v3/system_status`;

    try {
      const response = await axios.get(testUrl, {
        auth: {
          username: consumer_key,
          password: consumer_secret
        },
        timeout: 10000
      });

      if (response.status === 200) {
        res.json({
          success: true,
          message: "WooCommerce connection test successful"
        });
      } else {
        res.status(400).json({
          success: false,
          error: "Invalid WooCommerce credentials"
        });
      }
    } catch (testError) {
      res.status(400).json({
        success: false,
        error: "Failed to connect to WooCommerce store. Please check your credentials and store URL."
      });
    }
  } catch (error) {
    console.error("WooCommerce test error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to test WooCommerce connection"
    });
  }
};

exports.getWooCommerceStatus = async (req, res) => {
  try {
    const settings = await Settings.findOne({ userId: req.userId });

    if (settings && settings.woocommerce && settings.woocommerce.status === 'connected') {
      res.json({
        success: true,
        connected: true,
        store_url: settings.woocommerce.store_url,
        consumer_key: settings.woocommerce.consumer_key,
        connected_at: settings.woocommerce.connected_at,
        last_tested_at: settings.woocommerce.last_tested_at
      });
    } else {
      res.json({
        success: true,
        connected: false
      });
    }
  } catch (error) {
    console.error("Get WooCommerce status error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get WooCommerce status"
    });
  }
};

exports.disconnectWooCommerce = async (req, res) => {
  try {
    await Settings.findOneAndUpdate(
      { userId: req.userId },
      { $unset: { woocommerce: 1 } }
    );

    res.json({
      success: true,
      message: "WooCommerce disconnected successfully"
    });
  } catch (error) {
    console.error("WooCommerce disconnect error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to disconnect WooCommerce"
    });
  }
};

// Shopify Integration Handlers
exports.connectShopify = async (req, res) => {
  try {
    const { store_domain, access_token } = req.body;

    if (!store_domain || !access_token) {
      return res.status(400).json({
        success: false,
        error: "Store Domain and Access Token are required"
      });
    }

    // Test Shopify connection
    const axios = require('axios');
    const testUrl = `https://${store_domain}/admin/api/2025-01/shop.json`;

    try {
      const response = await axios.get(testUrl, {
        headers: {
          'X-Shopify-Access-Token': access_token,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.status === 200 && response.data.shop) {
        // Save integration to database
        const crypto = require('crypto');
        const encryptedToken = crypto.createHash('sha256').update(access_token).digest('hex');

        await Settings.findOneAndUpdate(
          { userId: req.userId },
          {
            $set: {
              'shopify': {
                type: 'shopify',
                store_domain,
                access_token: encryptedToken,
                status: 'connected',
                connected_at: new Date(),
                last_tested_at: new Date()
              }
            }
          },
          { new: true, upsert: true }
        );

        res.json({
          success: true,
          message: "Shopify connected successfully"
        });
      } else {
        res.status(400).json({
          success: false,
          error: "Invalid Shopify credentials"
        });
      }
    } catch (testError) {
      res.status(400).json({
        success: false,
        error: "Failed to connect to Shopify store. Please check your credentials and store domain."
      });
    }
  } catch (error) {
    console.error("Shopify connection error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to connect Shopify"
    });
  }
};

exports.testShopifyConnection = async (req, res) => {
  try {
    const { store_domain, access_token } = req.body;

    if (!store_domain || !access_token) {
      return res.status(400).json({
        success: false,
        error: "Store Domain and Access Token are required"
      });
    }

    const axios = require('axios');
    const testUrl = `https://${store_domain}/admin/api/2025-01/shop.json`;

    try {
      const response = await axios.get(testUrl, {
        headers: {
          'X-Shopify-Access-Token': access_token,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.status === 200 && response.data.shop) {
        res.json({
          success: true,
          message: "Shopify connection test successful"
        });
      } else {
        res.status(400).json({
          success: false,
          error: "Invalid Shopify credentials"
        });
      }
    } catch (testError) {
      res.status(400).json({
        success: false,
        error: "Failed to connect to Shopify store. Please check your credentials and store domain."
      });
    }
  } catch (error) {
    console.error("Shopify test error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to test Shopify connection"
    });
  }
};

exports.getShopifyStatus = async (req, res) => {
  try {
    const settings = await Settings.findOne({ userId: req.userId });

    if (settings && settings.shopify && settings.shopify.status === 'connected') {
      res.json({
        success: true,
        connected: true,
        store_domain: settings.shopify.store_domain,
        connected_at: settings.shopify.connected_at,
        last_tested_at: settings.shopify.last_tested_at
      });
    } else {
      res.json({
        success: true,
        connected: false
      });
    }
  } catch (error) {
    console.error("Get Shopify status error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get Shopify status"
    });
  }
};

exports.disconnectShopify = async (req, res) => {
  try {
    await Settings.findOneAndUpdate(
      { userId: req.userId },
      { $unset: { shopify: 1 } }
    );

    res.json({
      success: true,
      message: "Shopify disconnected successfully"
    });
  } catch (error) {
    console.error("Shopify disconnect error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to disconnect Shopify"
    });
  }
};
