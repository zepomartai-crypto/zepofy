// controllers/metaIntegration.controller.js
// Handles Facebook Page and Instagram Business integration configurations and credential flows

const crypto = require("crypto");
const MetaIntegration = require("../models/MetaIntegration");
const MetaWebhookLog = require("../models/MetaWebhookLog");
const metaGraphService = require("../services/metaGraph.service");
const generateWebhookUrl = require("../utils/webhookUrlGenerator");

class MetaIntegrationController {
  /**
   * Connect Facebook Page and Instagram Account
   */
  async connectMeta(req, res) {
    try {
      console.log(`🔄 Connecting Meta (FB & IG) for user: ${req.userId}`);

      const {
        facebookPageId,
        instagramBusinessId,
        appId,
        appSecret,
        accessToken
      } = req.body;

      // 1. Validate Input Params
      if (!facebookPageId || !instagramBusinessId || !appId || !appSecret || !accessToken) {
        return res.status(400).json({
          success: false,
          error: "All fields are required: facebookPageId, instagramBusinessId, appId, appSecret, and accessToken"
        });
      }

      // 2. Validate Credentials against Facebook Graph API
      let pageData;
      try {
        pageData = await metaGraphService.validatePageConnection(
          facebookPageId.trim(),
          accessToken.trim(),
          appId.trim(),
          appSecret.trim()
        );
      } catch (err) {
        return res.status(400).json({
          success: false,
          error: `Facebook Page Validation Failed: ${err.message}`
        });
      }

      // 2b. Auto-subscribe the Facebook Page to our webhooks
      try {
        await metaGraphService.subscribePageWebhook(
          pageData.pageId,
          pageData.pageAccessToken
        );
      } catch (webhookErr) {
        console.error(`⚠️ [Meta Integration] Could not auto-subscribe webhooks:`, webhookErr.message);
      }

      // 3. Validate and fetch linked Instagram Business Account
      let igData;
      try {
        igData = await metaGraphService.validateInstagramConnection(
          facebookPageId.trim(),
          accessToken.trim(),
          instagramBusinessId.trim()
        );
      } catch (err) {
        return res.status(400).json({
          success: false,
          error: `Instagram Business Account Sync Failed: ${err.message}`
        });
      }

      // 4. Upsert config
      let integration = await MetaIntegration.findOne({ userId: req.userId });

      const verifyToken = integration?.verifyToken || crypto.randomBytes(24).toString("hex");

      const updatePayload = {
        userId: req.userId,
        facebookPageId: facebookPageId.trim(),
        facebookPageName: pageData.pageName,
        instagramBusinessId: igData.instagramBusinessId,
        instagramUsername: igData.instagramUsername,
        appId: appId.trim(),
        appSecret: appSecret.trim(),
        accessToken: pageData.pageAccessToken.trim(), // Automatically encrypted via mongoose pre-save middleware
        verifyToken,
        isActive: true,
        webhookStatus: "active",
        lastSync: new Date()
      };

      if (integration) {
        // Object.assign triggers pre-save middleware if save() is called
        Object.assign(integration, updatePayload);
        await integration.save();
      } else {
        integration = new MetaIntegration(updatePayload);
        await integration.save();
      }

      // 5. Audit Log Success
      try {
        const SystemLog = require("../models/SystemLog");
        await SystemLog.create({
          type: "info",
          message: `Facebook & Instagram Integration successful for user: ${req.userId}`,
          userId: req.userId,
          ip: req.ip
        });
      } catch (logErr) {
        console.error("❌ Failed to create integration system log:", logErr.message);
      }

      console.log(`✅ Meta integration saved successfully for user: ${req.userId}`);

      return res.status(200).json({
        success: true,
        message: "Facebook & Instagram integrated successfully",
        data: {
          facebookPageId: integration.facebookPageId,
          facebookPageName: integration.facebookPageName,
          instagramBusinessId: integration.instagramBusinessId,
          instagramUsername: integration.instagramUsername,
          appId: integration.appId,
          userId: integration.userId,
          maskedAccessToken: integration.maskedAccessToken,
          maskedAppSecret: integration.appSecret ? `${integration.appSecret.slice(0, 4)}******${integration.appSecret.slice(-4)}` : null,
          verifyToken: integration.verifyToken,
          callbackUrl: generateWebhookUrl({ provider: "meta", integrationId: integration.userId }),
          webhookStatus: integration.webhookStatus,
          isActive: integration.isActive,
          lastSync: integration.lastSync
        }
      });
    } catch (error) {
      console.error("❌ Error in connectMeta:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to establish Meta Connection"
      });
    }
  }

  /**
   * Retrieve active connection configuration details
   */
  async getMetaConfig(req, res) {
    try {
      const integration = await MetaIntegration.findOne({ userId: req.userId });

      if (!integration) {
        return res.status(200).json({
          success: true,
          data: {
            status: "not_connected",
            isActive: false
          }
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          status: integration.isActive ? "connected" : "not_connected",
          facebookPageId: integration.facebookPageId,
          facebookPageName: integration.facebookPageName,
          instagramBusinessId: integration.instagramBusinessId,
          instagramUsername: integration.instagramUsername,
          appId: integration.appId,
          userId: integration.userId,
          maskedAccessToken: integration.maskedAccessToken,
          maskedAppSecret: integration.appSecret ? `${integration.appSecret.slice(0, 4)}******${integration.appSecret.slice(-4)}` : null,
          verifyToken: integration.verifyToken,
          callbackUrl: generateWebhookUrl({ provider: "meta", integrationId: integration.userId }),
          webhookStatus: integration.webhookStatus,
          isActive: integration.isActive,
          lastSync: integration.lastSync
        }
      });
    } catch (error) {
      console.error("❌ Error in getMetaConfig:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to retrieve configuration"
      });
    }
  }

  /**
   * Revoke Meta integration credentials (manual disconnect)
   */
  async revokeMetaConnection(req, res) {
    try {
      console.log(`🔄 Revoking Meta Connection for user: ${req.userId}`);

      const result = await MetaIntegration.deleteOne({ userId: req.userId });

      if (result.deletedCount === 0) {
        return res.status(404).json({
          success: false,
          error: "No active Meta Integration found to revoke"
        });
      }

      // Log disconnection audit trace
      try {
        const SystemLog = require("../models/SystemLog");
        await SystemLog.create({
          type: "info",
          message: `Facebook & Instagram Integration manually disconnected by user: ${req.userId}`,
          userId: req.userId,
          ip: req.ip
        });
      } catch (logErr) {
        console.error("❌ Failed to log disconnection:", logErr.message);
      }

      console.log(`✅ Meta connection revoked successfully for user: ${req.userId}`);

      return res.status(200).json({
        success: true,
        message: "Facebook & Instagram integration disconnected successfully"
      });
    } catch (error) {
      console.error("❌ Error in revokeMetaConnection:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to disconnect Meta Integration"
      });
    }
  }

  /**
   * Fetch recent webhook events logs for frontend display
   */
  async getWebhookLogs(req, res) {
    try {
      const logs = await MetaWebhookLog.find({ workspaceId: req.userId })
        .sort({ createdAt: -1 })
        .limit(20);

      return res.status(200).json({
        success: true,
        data: logs
      });
    } catch (error) {
      console.error("❌ Error in getWebhookLogs:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to retrieve webhook event logs"
      });
    }
  }
}

module.exports = new MetaIntegrationController();
