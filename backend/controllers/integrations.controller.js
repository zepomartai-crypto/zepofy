// controllers/integrations.controller.js
// FIXED VERSION - Single Source of Truth for Status

const whatsappIntegrationService = require('../services/whatsappIntegrationService');
const metaCatalogService = require('../services/metaCatalog.service');

/* ================= GET USER INTEGRATION ================= */
exports.getIntegration = async (req, res) => {
  try {
    const WhatsAppIntegration = require('../models/WhatsAppIntegration');
    const integration = await WhatsAppIntegration.findByUserIdWithToken(req.userId);

    if (!integration) {
      return res.json({
        success: true,
        data: {
          status: 'not_connected',
          metaApiVersion: 'v19.0'
        }
      });
    }

    // ✅ Establish Webhook Token if missing
    if (!integration.webhookVerifyToken) {
      integration.webhookVerifyToken = whatsappIntegrationService.generateWebhookToken();
      integration.webhookConfigured = false;
      await integration.save();
    }

    const webhookInfo = whatsappIntegrationService.getWebhookUrls(integration);
    const data = integration.toJSON();
    let permissionMissing = false;
    let catalogIdValid = true;

    // 🛡️ HONEST STATE Re-validation: Check real Meta status on load
    if (integration.catalogId && integration.catalogId !== "123456789012345") {
      try {
        await metaCatalogService.validateCatalog(integration);
        // If we are here, it's valid. Ensure DB reflects this truth
        if (!integration.catalogConnected) {
          integration.catalogConnected = true;
          await integration.save();
          data.catalogConnected = true;
        }
      } catch (valErr) {
        console.warn(`⚠️ [STATUS RE-VALIDATE] Catalog verification failed for user ${req.userId}:`, valErr.message);
        const rawErr = metaCatalogService.getRawMetaError(valErr);
        // codes 100/200 indicate the catalog is gone or inaccessible
        if (rawErr.code === 100 || rawErr.code === 200) {
          integration.catalogConnected = false;
          await integration.save();
          data.catalogConnected = false;
          catalogIdValid = false;
        }
      }
    } else {
      // Scrub placeholder or missing IDs
      data.catalogId = null;
      data.catalogConnected = false;
      catalogIdValid = false;
    }

    // 🛡️ Safe Permission status for UI banners
    try {
      const baseUrl = `https://graph.facebook.com/${integration.metaApiVersion || 'v19.0'}`;
      await whatsappIntegrationService.validatePermissions(integration, baseUrl);
    } catch (permErr) {
      if (permErr.message.includes('Permission Error')) {
        permissionMissing = true;
      }
    }

    res.json({
      success: true,
      data: {
        ...data,
        catalogConnected: data.catalogConnected,
        permissionMissing,
        catalogIdValid,
        connected: integration.status === 'connected',
        webhookUrl: webhookInfo.webhookUrl,
        webhookVerifyToken: integration.webhookVerifyToken
      }
    });
  } catch (error) {
    console.error('Error getting integration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/* ================= CONNECT WHATSAPP ================= */
exports.connectWhatsApp = async (req, res) => {
  try {
    console.log('🔄 Connecting WhatsApp for user:', req.userId);

    const {
      wabaId,
      phoneNumberId,
      businessPhoneNumber,
      accessToken,
      appId,
      catalogId,
      commerceSettings
    } = req.body;

    // Validate required fields
    if (!wabaId || !phoneNumberId || !businessPhoneNumber || !accessToken) {
      return res.status(400).json({
        success: false,
        error: 'wabaId, phoneNumberId, businessPhoneNumber, and accessToken are required'
      });
    }

    // Use service to connect WhatsApp (sets status = 'connected')
    const integration = await whatsappIntegrationService.connectWhatsApp(req.userId, {
      wabaId: wabaId.trim(),
      phoneNumberId: phoneNumberId.trim(),
      businessPhoneNumber: businessPhoneNumber?.trim(),
      accessToken: accessToken.trim(),
      appId: appId?.trim(),
      catalogId: catalogId?.trim(),
      commerceSettings
    });

    console.log('✅ WhatsApp connected successfully for user:', req.userId);

    // Auto-update integration status
    const userStatusService = require('../services/userStatusService');
    await userStatusService.updateUserIntegrationStatus(req.userId);

    const webhookInfo = whatsappIntegrationService.getWebhookUrls(integration);

    // 📝 Log Integration Success
    try {
      const SystemLog = require("../models/SystemLog");
      await SystemLog.create({
        type: "info",
        message: `WhatsApp connected successfully for user: ${req.userId}`,
        userId: req.userId,
        ip: req.ip
      });
    } catch (logErr) {
      console.error("❌ Failed to log integration success:", logErr.message);
    }

    res.json({
      success: true,
      message: 'WhatsApp connected successfully',
      data: {
        ...integration.toJSON(),
        connected: true,
        maskedAccessToken: integration.maskedAccessToken,
        webhookUrl: webhookInfo.webhookUrl,
        webhookVerifyToken: integration.webhookVerifyToken
      }
    });

  } catch (error) {
    console.error('❌ Error connecting WhatsApp:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to connect WhatsApp'
    });
  }
};

/* ================= TEST CONNECTION ================= */
exports.testConnection = async (req, res) => {
  try {
    console.log('🔍 Testing connection for user:', req.userId);

    // Fetch integration by logged-in userId
    const WhatsAppIntegration = require('../models/WhatsAppIntegration');
    const integration = await WhatsAppIntegration.findByUserIdWithToken(req.userId);

    if (!integration) {
      return res.status(404).json({
        success: false,
        error: "No WhatsApp integration found"
      });
    }

    console.log('📊 Integration status:', integration.status);
    console.log('📱 Phone Number ID:', integration.phoneNumberId);

    // If already connected, just verify token is still valid
    if (integration.status === 'connected') {
      const verification = await whatsappIntegrationService.verifyToken(
        integration.accessToken,
        integration.phoneNumberId
      );

      if (verification.success) {
        // Update last verified timestamp
        integration.lastVerifiedAt = new Date();
        integration.errorMessage = null;
        await integration.save();

        return res.json({
          success: true,
          message: 'Connection test successful',
          data: verification.data
        });
      } else {
        // Token is no longer valid, update status to error
        integration.status = 'error';
        integration.errorMessage = verification.error;
        await integration.save();

        return res.status(400).json({
          success: false,
          error: verification.error
        });
      }
    }

    // If not connected, return error
    return res.status(400).json({
      success: false,
      error: `WhatsApp integration not connected (status: ${integration.status})`
    });

  } catch (error) {
    console.error('❌ Error testing connection:', error);

    // Update status to error only on actual API failures
    try {
      const WhatsAppIntegration = require('../models/WhatsAppIntegration');
      await WhatsAppIntegration.updateOne(
        { userId: req.userId },
        {
          status: 'error',
          errorMessage: error.message,
          lastVerifiedAt: new Date()
        }
      );
    } catch (updateError) {
      console.error('Failed to update error status:', updateError);
    }

    const errorMessage = error.response?.data?.error?.message || error.message;
    res.status(400).json({
      success: false,
      error: errorMessage
    });
  }
};

/* ================= DISCONNECT WHATSAPP ================= */
exports.disconnectWhatsApp = async (req, res) => {
  try {
    const integration = await whatsappIntegrationService.disconnectWhatsApp(req.userId);

    // Auto-update integration status
    const userStatusService = require('../services/userStatusService');
    await userStatusService.updateUserIntegrationStatus(req.userId);

    // 📝 Log Disconnection
    try {
      const SystemLog = require("../models/SystemLog");
      await SystemLog.create({
        type: "info",
        message: `WhatsApp disconnected manual by user: ${req.userId}`,
        userId: req.userId,
        ip: req.ip
      });
    } catch (logErr) {
      console.error("❌ Failed to log disconnection:", logErr.message);
    }

    res.json({
      success: true,
      message: 'WhatsApp disconnected successfully',
      data: {
        ...integration,
        connected: false
      }
    });
  } catch (error) {
    console.error('Error disconnecting WhatsApp:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/* ================= REGENERATE WEBHOOK TOKEN ================= */
exports.regenerateWebhookToken = async (req, res) => {
  try {
    const WhatsAppIntegration = require('../models/WhatsAppIntegration');
    const integration = await WhatsAppIntegration.findOne({ userId: req.userId });

    if (!integration) {
      return res.status(404).json({ success: false, error: 'Integration not found' });
    }

    integration.webhookVerifyToken = whatsappIntegrationService.generateWebhookToken();
    integration.webhookConfigured = false; // Need to re-verify at Meta
    await integration.save();

    res.json({
      success: true,
      message: 'Webhook token regenerated successfully',
      data: {
        webhookVerifyToken: integration.webhookVerifyToken
      }
    });
  } catch (error) {
    console.error('Error regenerating webhook token:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/* ================= VERIFY TOKEN ================= */
exports.verifyToken = async (req, res) => {
  try {
    const { accessToken, phoneNumberId } = req.body;

    if (!accessToken || !phoneNumberId) {
      return res.status(400).json({
        success: false,
        error: 'Access token and phone number ID are required'
      });
    }

    const verification = await whatsappIntegrationService.verifyToken(accessToken, phoneNumberId);

    res.json(verification);
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/* ================= SAVE INTEGRATION (LEGACY) ================= */
exports.saveIntegration = async (req, res) => {
  try {
    // Redirect to connectWhatsApp for consistency
    return await exports.connectWhatsApp(req, res);
  } catch (error) {
    console.error('Error saving integration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
/* ================= GET OVERALL STATUS ================= */
exports.getOverallStatus = async (req, res) => {
  try {
    const WhatsAppIntegration = require('../models/WhatsAppIntegration');
    const WooCommerceIntegration = require('../models/WooCommerceIntegration');
    const ShopifyIntegration = require('../models/ShopifyIntegration');
    const MetaIntegration = require('../models/MetaIntegration');
    const mongoose = require('mongoose');
    const userId = new mongoose.Types.ObjectId(req.userId);

    const [whatsapp, woocommerce, shopify, metaIntegration] = await Promise.all([
      WhatsAppIntegration.findOne({ userId }),
      WooCommerceIntegration.findOne({ userId }),
      ShopifyIntegration.findOne({ userId }),
      MetaIntegration.findOne({ userId })
    ]);

    res.json({
      success: true,
      data: {
        whatsapp: {
          connected: whatsapp?.status === 'connected',
          status: whatsapp?.status || 'not_connected',
          catalogConnected: whatsapp?.catalogConnected || false,
          catalogId: whatsapp?.catalogId || null
        },
        whatsappCommerce: {
          connected: whatsapp?.catalogConnected || whatsapp?.commerceSettings?.isActive || false,
          status: (whatsapp?.catalogConnected || whatsapp?.commerceSettings?.isActive) ? 'connected' : 'not_connected'
        },
        woocommerce: {
          connected: woocommerce?.status === 'connected',
          status: woocommerce?.status || 'not_connected'
        },
        shopify: {
          connected: shopify?.status === 'connected',
          status: shopify?.status || 'not_connected'
        },
        facebook_instagram: {
          connected: metaIntegration?.isActive || false,
          status: metaIntegration?.isActive ? 'connected' : 'not_connected',
          webhookStatus: metaIntegration?.webhookStatus || 'inactive'
        }
      }
    });
  } catch (error) {
    console.error('Error getting overall status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/* ================= WHATSAPP EMBEDDED SIGNUP ================= */
exports.embeddedSignup = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, error: 'Code is required' });
    }

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!appId || !appSecret) {
      return res.status(500).json({ 
        success: false, 
        error: 'Meta App ID or App Secret is not configured on the server.' 
      });
    }

    const axios = require('axios');

    // Step 2: Exchange code for access token
    console.log('🔄 Exchanging OAuth code for Meta access token...');
    const tokenResponse = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: {
        client_id: appId,
        client_secret: appSecret,
        code
      }
    });

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) {
      throw new Error('Failed to retrieve access token from Meta.');
    }

    // Step 3: Fetch WABA ID
    console.log('🔄 Fetching WABA ID from Meta...');
    const wabaResponse = await axios.get('https://graph.facebook.com/v19.0/me/whatsapp_business_accounts', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const wabaData = wabaResponse.data.data;
    if (!wabaData || wabaData.length === 0) {
      throw new Error('No WhatsApp Business Accounts found for this Meta user.');
    }
    const wabaId = wabaData[0].id;

    // Step 4: Fetch Phone Number details
    console.log(`🔄 Fetching Phone Numbers for WABA: ${wabaId}...`);
    const phoneResponse = await axios.get(`https://graph.facebook.com/v19.0/${wabaId}/phone_numbers`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const phoneData = phoneResponse.data.data;
    if (!phoneData || phoneData.length === 0) {
      throw new Error('No phone numbers found in this WhatsApp Business Account.');
    }
    const phoneNumberId = phoneData[0].id;
    const businessPhoneNumber = phoneData[0].display_phone_number;

    console.log('✅ Retrieved embedded signup details:', { wabaId, phoneNumberId, businessPhoneNumber });

    // Step 6: Connect WhatsApp
    const integration = await whatsappIntegrationService.connectWhatsApp(req.userId, {
      wabaId,
      phoneNumberId,
      businessPhoneNumber,
      accessToken,
      appId
    });

    console.log('✅ WhatsApp connected successfully via embedded signup for user:', req.userId);

    // Auto-update integration status
    const userStatusService = require('../services/userStatusService');
    await userStatusService.updateUserIntegrationStatus(req.userId);

    const webhookInfo = whatsappIntegrationService.getWebhookUrls(integration);

    // 📝 Log Integration Success
    try {
      const SystemLog = require("../models/SystemLog");
      await SystemLog.create({
        type: "info",
        message: `WhatsApp connected successfully via Embedded Signup for user: ${req.userId}`,
        userId: req.userId,
        ip: req.ip
      });
    } catch (logErr) {
      console.error("❌ Failed to log integration success:", logErr.message);
    }

    res.json({
      success: true,
      message: 'WhatsApp connected successfully via Embedded Signup',
      data: {
        ...integration.toJSON(),
        connected: true,
        maskedAccessToken: integration.maskedAccessToken,
        webhookUrl: webhookInfo.webhookUrl,
        webhookVerifyToken: integration.webhookVerifyToken
      }
    });

  } catch (error) {
    console.error('❌ Error in WhatsApp Embedded Signup:', error.response?.data || error.message);
    const apiError = error.response?.data?.error?.message || error.message;
    res.status(500).json({
      success: false,
      error: apiError || 'Failed to complete WhatsApp Embedded Signup'
    });
  }
};