// services/whatsappIntegrationService.js
// Core WhatsApp Integration Service for Multi-tenant System

const WhatsAppIntegration = require('../models/WhatsAppIntegration');
const axios = require('axios');
const crypto = require('crypto');

class WhatsAppIntegrationService {
  constructor() {
    this.webhookBaseUrl = process.env.WEBHOOK_BASE_URL || 'http://localhost:5000';
  }

  // Get user's WhatsApp integration
  async getUserIntegration(userId) {
    return await WhatsAppIntegration.findByUserIdWithToken(userId);
  }

  // Get integration by phone number ID (for webhook routing)
  async getIntegrationByPhoneNumberId(phoneNumberId) {
    return await WhatsAppIntegration.findByPhoneNumberId(phoneNumberId);
  }

  // Get integration by webhook verify token
  async getIntegrationByWebhookToken(webhookVerifyToken) {
    return await WhatsAppIntegration.findByWebhookToken(webhookVerifyToken);
  }

  // Save or update integration
  async saveIntegration(userId, integrationData) {
    const existing = await WhatsAppIntegration.findOne({ userId });

    const data = {
      ...integrationData,
      userId,
      lastVerifiedAt: new Date(),
      errorMessage: null
    };

    // Only set default status if not provided
    if (!data.status) {
      data.status = 'not_connected';
    }

    // Generate webhook verify token if not provided
    if (!data.webhookVerifyToken) {
      data.webhookVerifyToken = this.generateWebhookToken();
    }

    if (existing) {
      Object.assign(existing, data);
      return await existing.save();
    } else {
      return await WhatsAppIntegration.create(data);
    }
  }

  // Verify access token with Meta API
  async verifyToken(accessToken, phoneNumberId) {
    try {
      console.log('🔍 Verifying token with Meta API...');
      console.log('📱 Phone Number ID:', phoneNumberId);
      console.log('🔑 Token starts with:', accessToken.substring(0, 20) + '...');

      const response = await axios.get(
        `https://graph.facebook.com/v24.0/${phoneNumberId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          timeout: 10000
        }
      );

      console.log('✅ Token verification successful');
      return {
        success: true,
        data: {
          ...response.data,
          verifiedAt: new Date()
        }
      };
    } catch (error) {
      console.error('❌ Token verification failed:', error.response?.status, error.response?.data);

      let errorMessage = 'Token verification failed';

      if (error.response?.status === 401) {
        errorMessage = 'Invalid or expired access token. Please generate a new System User Permanent Token from Meta Business Manager.';
      } else if (error.response?.status === 400) {
        errorMessage = 'Invalid phone number ID or token format';
      } else if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  // Connect WhatsApp (validate and update status)
  async connectWhatsApp(userId, integrationData) {
    const { accessToken, phoneNumberId, wabaId, appId, businessPhoneNumber } = integrationData;

    // 1️⃣ Verify token with Meta
    const verification = await this.verifyToken(accessToken, phoneNumberId);

    if (!verification.success) {
      throw new Error(`Token verification failed: ${verification.error}`);
    }

    // 2️⃣ Save integration
    const integration = await this.saveIntegration(userId, {
      accessToken,
      phoneNumberId,
      wabaId,
      appId,
      businessPhoneNumber,
      metaApiVersion: "v24.0",
      status: "connected",
      connectedAt: new Date(),
      lastVerifiedAt: new Date(),
    });

    // 3️⃣ Subscribe webhook (optional - don't block connection)
    try {
      await this.subscribeToWebhooks(integration);
    } catch (webhookError) {
      console.warn('⚠️ Webhook subscription failed (non-critical):', webhookError.message);
      // Don't fail the entire connection if webhook setup fails
    }

    return integration;
  }

  // Disconnect WhatsApp
  async disconnectWhatsApp(userId) {
    const integration = await WhatsAppIntegration.findOne({ userId }).select('+accessToken');

    if (!integration) {
      throw new Error('No WhatsApp integration found');
    }

    // ❗ DO NOT TOUCH accessToken
    integration.status = 'not_connected';
    integration.connectedAt = null;
    integration.webhookConfigured = false;
    integration.errorMessage = null;

    // 🔥 NEW: Also disconnect commerce catalog when WhatsApp is disconnected
    integration.catalogConnected = false;
    integration.catalogId = null;
    integration.catalogName = null;

    await integration.save();

    return {
      success: true,
      message: 'WhatsApp disconnected successfully'
    };
  }

  // Subscribe to webhooks for the phone number
  async subscribeToWebhooks(integration) {
    try {
      const webhookUrl = `${this.webhookBaseUrl}/api/webhook/whatsapp`;

      const response = await axios.post(
        `https://graph.facebook.com/v24.0/${integration.phoneNumberId}/subscribed_apps`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${integration.accessToken}`
          }
        }
      );

      // Configure webhook if not already configured
      if (!integration.webhookConfigured) {
        await this.configureWebhook(integration);
        integration.webhookConfigured = true;
      }

      await integration.save();

      console.log('✅ Webhook subscription successful:', response.data);
      return true;
    } catch (error) {
      console.warn('⚠️ Webhook subscription failed (non-critical):', error.response?.data?.error?.message || error.message);
      // DO NOT throw error - just log and continue
      // Webhook failures should NOT break messaging
      return false;
    }
  }

  // Configure webhook for the app
  async configureWebhook(integration) {
    try {
      const webhookUrl = `${this.webhookBaseUrl}/api/webhook/whatsapp`;

      await axios.post(
        `https://graph.facebook.com/v24.0/${integration.appId}/subscriptions`,
        {
          object: 'whatsapp_business_account',
          callback_url: webhookUrl,
          verify_token: integration.webhookVerifyToken,
          fields: ['messages', 'message_status', 'template_status']
        },
        {
          headers: {
            'Authorization': `Bearer ${integration.accessToken}`
          }
        }
      );

      console.log('✅ Webhook configured successfully');
      return true;
    } catch (error) {
      console.error('❌ Webhook configuration failed:', error.response?.data || error.message);
      throw new Error(`Webhook configuration failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  // Generate webhook verify token
  generateWebhookToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Get webhook URLs for integration
  getWebhookUrls(integration) {
    // 1. Prioritize process.env.BASE_URL as requested by user
    // 2. Fallback to BASE_API_URL if BASE_URL is not set
    // 3. Last resort: environment-specific defaults
    const BASE_URL = process.env.BASE_URL || process.env.BASE_API_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://wauto.smritiz.com"
        : "http://localhost:5000");

    // Ensure no trailing slash on BASE_URL
    const sanitizedBaseUrl = BASE_URL.replace(/\/$/, "");

    return {
      webhookUrl: `${sanitizedBaseUrl}/api/webhook/whatsapp/${integration.userId}`,
      verifyToken: integration.webhookVerifyToken
    };
  }


  // Test connection
  async testConnection(userId) {
    const integration = await this.getUserIntegration(userId);

    if (!integration || !integration.accessToken) {
      return {
        success: false,
        error: 'No WhatsApp integration found'
      };
    }

    return await this.verifyToken(integration.accessToken, integration.phoneNumberId);
  }

  // Send message using user's integration
  async sendMessage(userId, to, message, messageType = 'text') {
    const integration = await this.getUserIntegration(userId);

    if (!integration || integration.status !== 'connected') {
      throw new Error('WhatsApp integration not connected');
    }

    const payload = this.buildMessagePayload(to, message, messageType);

    const response = await axios.post(
      `https://graph.facebook.com/v24.0/${integration.phoneNumberId}/messages`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${integration.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  }

  // Build message payload based on type
  buildMessagePayload(to, message, type) {
    const basePayload = {
      messaging_product: 'whatsapp',
      to,
      type
    };

    switch (type) {
      case 'text':
        basePayload.text = { body: message };
        break;
      case 'template':
        basePayload.template = message;
        break;
      case 'interactive':
        basePayload.interactive = message;
        break;
      default:
        throw new Error(`Unsupported message type: ${type}`);
    }

    return basePayload;
  }

  // Calculate token expiry (60 days for permanent tokens)
  calculateTokenExpiry(accessToken) {
    // For permanent tokens, set expiry to 60 days from now
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 60);
    return expiryDate;
  }

  /**
   * 🛡️ Validates if the token has 'business_management' permission
   * Uses caching to prevent rate limits (1 hour TTL)
   * @param {Object} integration 
   * @param {string} baseUrl 
   */
  async validatePermissions(integration, baseUrl) {
    const CACHE_TTL = 60 * 60 * 1000; // 1 Hour
    const isCacheFresh = integration.lastPermCheck && (new Date() - new Date(integration.lastPermCheck) < CACHE_TTL);

    if (isCacheFresh && integration.hasBusinessManagement) {
      console.log('⚡ [META AUTH] Using cached permission status (Fresh)');
      return true;
    }

    const accessToken = integration.accessToken;
    try {
      console.log('🔍 [META AUTH] Cache Stale/Missing. Validating Permissions with Meta...');
      const response = await axios.get(`${baseUrl}/me/permissions`, {
        params: { access_token: accessToken }
      });

      const permissions = response.data.data || [];
      const busMgmt = permissions.find(p => p.permission === 'business_management' && p.status === 'granted');
      const catMgmt = permissions.find(p => p.permission === 'catalog_management' && p.status === 'granted');
      const waMgmt = permissions.find(p => p.permission === 'whatsapp_business_management' && p.status === 'granted');

      const isGranted = !!busMgmt && !!catMgmt && !!waMgmt;

      // Update Local State
      integration.hasBusinessManagement = isGranted;
      integration.lastPermCheck = new Date();

      if (!isGranted) {
        console.warn('⚠️ [META AUTH] Permission missing, attempting anyway...', {
          business: !!busMgmt,
          catalog: !!catMgmt,
          whatsapp: !!waMgmt
        });
      }

      console.log('✅ [META AUTH] Triple-permissions status updated (Soft Blocked)');
      return isGranted;
    } catch (error) {
      console.warn('⚠️ [META AUTH] Permission Validation Failed, attempting anyway:', error.message);
      return false;
    }
  }

  /**
   * 🗺️ Maps Meta API Error codes to user-friendly messages
   */
  mapMetaError(error) {
    const metaError = error.response?.data?.error || {};
    const code = metaError.code;

    if (code === 200) {
      return "Permission Error: Add 'business_management' to your access token";
    }
    if (code === 100) {
      return "Invalid Catalog ID or Business Account";
    }

    return metaError.message || error.message || "Meta API Error";
  }

  // Connect and auto-configure Meta Catalog
  async connectMetaCatalog(userId) {
    const integration = await this.getUserIntegration(userId);
    if (!integration) throw new Error("WhatsApp not connected");

    const baseUrl = `https://graph.facebook.com/${integration.metaApiVersion || 'v24.0'}`;

    try {
      // 0. Strict Permission Validation (Required for Search/Discovery)
      try {
        await this.validatePermissions(integration, baseUrl);
      } catch (permErr) {
        throw new Error("Reconnect Meta with full permissions. Auto-discovery requires 'business_management', 'catalog_management', and 'whatsapp_business_management' permissions. Please link your catalog manually below.");
      }

      let businessId;
      let businessName = "Discovered Business";

      console.log('🔍 [META CATALOG] Step 1: Fetching Businesses...');
      try {
        const busRes = await axios.get(`${baseUrl}/me/businesses`, {
          params: { access_token: integration.accessToken }
        });

        if (busRes.data.data?.length) {
          businessId = busRes.data.data[0].id;
          businessName = busRes.data.data[0].name;
          console.log(`✅ [META CATALOG] Business found: ${businessName} (${businessId})`);
        }
      } catch (busErr) {
        console.error('❌ [META CATALOG] Step 1 Failed:', busErr.response?.data || busErr.message);
        throw new Error(this.mapMetaError(busErr));
      }

      if (!businessId) {
        throw new Error("No Meta Business Account found. Please create one in Meta Business Suite and ensure your token has access.");
      }

      // 2. Fetch catalogs
      console.log('🔍 [META CATALOG] Step 2: Fetching Catalogs...');
      const catRes = await axios.get(`${baseUrl}/${businessId}/owned_product_catalogs`, {
        params: { access_token: integration.accessToken, fields: 'name,id' }
      });

      let catalogId;
      let catalogName;

      // 3. Pick or Create
      if (catRes.data.data?.length) {
        catalogId = catRes.data.data[0].id;
        catalogName = catRes.data.data[0].name;
        console.log(`✅ [META CATALOG] Using existing catalog: ${catalogName} (ID: ${catalogId})`);
      } else {
        console.log('🔍 [META CATALOG] Step 3: Creating New Catalog...');
        const createRes = await axios.post(`${baseUrl}/${businessId}/owned_product_catalogs`, {
          name: "Zepofy Auto Catalog",
          vertical: "commerce"
        }, {
          params: { access_token: integration.accessToken }
        });
        catalogId = createRes.data.id;
        catalogName = "Zepofy Auto Catalog";
        console.log(`✅ [META CATALOG] New catalog created: ${catalogId}`);
      }

      // 4. Link Catalog (Assign User/WABA access)
      console.log('🔍 [META CATALOG] Step 4: Linking Catalog to User...');
      try {
        const meRes = await axios.get(`${baseUrl}/me`, {
          params: { access_token: integration.accessToken, fields: 'id' }
        });
        const metaUserId = meRes.data.id;

        await axios.post(`${baseUrl}/${catalogId}/assigned_users`, {
          user: metaUserId,
          tasks: ['MANAGE', 'CREATE_CONTENT']
        }, {
          params: { access_token: integration.accessToken }
        });
        console.log(`✅ [Meta Catalog] User ${metaUserId} assigned to catalog`);
      } catch (linkErr) {
        console.warn('⚠️ [Meta Catalog] Non-critical error assigning user:', linkErr.response?.data || linkErr.message);
      }

      // 5. Save to DB
      integration.catalogId = catalogId.trim();
      integration.catalogName = catalogName.trim();
      integration.catalogConnected = true;
      await integration.save();

      return {
        success: true,
        catalogId,
        catalogName,
        businessName
      };

    } catch (error) {
      console.error('❌ [META CATALOG] Critical Error:', error.response?.data || error.message);
      // Ensure we return the mapped user-friendly error
      throw new Error(this.mapMetaError(error));
    }
  }
}

module.exports = new WhatsAppIntegrationService();
