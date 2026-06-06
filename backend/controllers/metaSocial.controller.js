const MetaConversation = require("../models/MetaConversation");
const MetaMessage = require("../models/MetaMessage");
const MetaIntegration = require("../models/MetaIntegration");
const axios = require("axios");

class MetaSocialController {
  async getConversations(req, res) {
    try {
      const workspaceId = req.userId || req.user?._id || req.query.workspaceId;
      
      if (!workspaceId) {
          return res.status(400).json({ error: "Missing workspaceId" });
      }

      const conversations = await MetaConversation.find({ workspaceId }).sort({ updatedAt: -1 });
      console.log(`📡 [Social Inbox API] User ${workspaceId} fetched ${conversations.length} conversations for the page`);
      res.status(200).json({ success: true, conversations });
    } catch (error) {
      console.error("❌ [Social Inbox] Error getting conversations:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getMessages(req, res) {
    try {
      const { id } = req.params;
      const messages = await MetaMessage.find({ conversationId: id }).sort({ timestamp: 1 });
      
      // Reset unread count when messages are fetched
      await MetaConversation.findByIdAndUpdate(id, { unreadCount: 0 });
      
      console.log(`📡 [Social Inbox API] Fetched ${messages.length} messages for conversation ${id}`);
      res.status(200).json({ success: true, messages });
    } catch (error) {
      console.error("❌ [Social Inbox] Error getting messages:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async sendMessage(req, res) {
    try {
      const workspaceId = req.userId || req.user?._id || req.body.workspaceId;
      const { conversationId, text } = req.body;

      if (!workspaceId || !conversationId || !text) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const conversation = await MetaConversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const integration = await MetaIntegration.findByUserIdWithToken(workspaceId);
      if (!integration || !integration.accessToken) {
        return res.status(400).json({ error: "Meta integration not configured or missing access token" });
      }

      const accessToken = integration.accessToken;
      
      // Meta Send API URL for replies (Always use Facebook Page ID for the /messages edge, even for Instagram)
      const pageId = integration.facebookPageId;
      const url = `https://graph.facebook.com/v25.0/${pageId}/messages`;
      
      const payload = {
        messaging_type: "RESPONSE",
        recipient: { id: conversation.customerId },
        message: { text }
      };

      try {
        console.log("\n=========================================");
        console.log(`🚀 [Meta Send API Debug] Executing Manual Reply`);
        console.log(`- Endpoint: ${url}`);
        console.log(`- Token Prefix: ${accessToken.substring(0, 10)}... (Length: ${accessToken.length})`);
        console.log(`- Token Suffix: ...${accessToken.substring(accessToken.length - 5)}`);
        console.log(`- Payload:`, JSON.stringify(payload, null, 2));
        console.log("=========================================\n");

        const response = await axios.post(url, payload, {
          params: { access_token: accessToken }
        });

        console.log(`[Meta Send API Success] Message sent to ${conversation.customerId}`);

        // Save sent message
        const newMsg = await MetaMessage.create({
          workspaceId,
          conversationId: conversation._id,
          platform: conversation.platform,
          senderType: "agent",
          senderId: pageId,
          recipientId: conversation.customerId,
          customerId: conversation.customerId,
          messageId: response.data?.message_id || `local-${Date.now()}`,
          messageText: text,
          status: "sent",
          timestamp: new Date()
        });

        console.log(`[Meta Message Sent] ID: ${newMsg._id}`);

        // Update conversation lastMessage
        conversation.lastMessage = text;
        conversation.lastMessageAt = new Date();
        await conversation.save();

        if (global.io) {
            global.io.to(workspaceId.toString()).emit("social:new_message", {
              conversation,
              message: newMsg
            });
        }

        res.status(200).json({ success: true, message: newMsg });

      } catch (sendError) {
        console.error(`[Meta Send API Error]`, sendError.response?.data || sendError.message);
        const errData = sendError.response?.data?.error;
        
        let errMsg = "Failed to send message via Meta API";
        if (errData && errData.code === 190) {
          errMsg = "Meta Session Expired: Please reconnect your Facebook/Instagram Integration in settings.";
        } else if (errData && errData.code === 200) {
          errMsg = "Meta App Restriction: Your app needs 'Advanced Access' to 'instagram_manage_messages' or the recipient must be a tester in the Meta App Dashboard.";
        }
        
        res.status(500).json({ error: errMsg, details: errData || sendError.message });
      }

    } catch (error) {
      console.error("❌ [Social Inbox] Error sending message:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  // --------------------------------------------------------------------------
  // FLOW AUTOMATION HELPER
  // --------------------------------------------------------------------------
  async sendFlowMessage(workspaceId, platform, senderId, messagePayload) {
    try {
      const integration = await MetaIntegration.findByUserIdWithToken(workspaceId);
      if (!integration || !integration.accessToken) {
        throw new Error("Meta integration not configured or missing access token");
      }

      // Meta Send API URL for replies (Always use Facebook Page ID for the /messages edge, even for Instagram)
      const pageId = integration.facebookPageId;
      const url = `https://graph.facebook.com/v25.0/${pageId}/messages`;
      
      const payload = {
        messaging_type: "RESPONSE",
        recipient: { id: senderId },
        message: messagePayload
      };

      let apiResponseData = null;
      let messageStatus = "sent";
      let messageId = `local-${Date.now()}`;

      try {
        console.log("\n=========================================");
        console.log(`🤖 [Meta Flow API Debug] Executing Flow Reply`);
        console.log(`- Endpoint: ${url}`);
        console.log(`- Token Prefix: ${integration.accessToken.substring(0, 10)}... (Length: ${integration.accessToken.length})`);
        console.log(`- Token Suffix: ...${integration.accessToken.substring(integration.accessToken.length - 5)}`);
        console.log(`- Payload:`, JSON.stringify(payload, null, 2));
        console.log("=========================================\n");

        const response = await axios.post(url, payload, {
          params: { access_token: integration.accessToken }
        });
        apiResponseData = response.data;
        messageId = response.data?.message_id || messageId;
        console.log(`[Meta Flow Send API Success] Message sent to ${senderId}`);
      } catch (apiError) {
        console.error(`[Meta Flow Send Error]`, apiError.response?.data || apiError.message);
        const errData = apiError.response?.data?.error;
        
        if (errData && errData.code === 190) {
          console.error("❌ [Meta Flow] Session Expired. Integration needs to be reconnected.");
        } else if (errData && errData.code === 200) {
          console.error("❌ [Meta Flow] App Restriction. Needs Advanced Access or App Tester role.");
        }
        
        messageStatus = "failed"; // Mark as failed but continue saving to DB so UI shows it
      }

      // Upsert conversation to show flow messages in inbox
      const conversation = await MetaConversation.findOneAndUpdate(
        { workspaceId, platform, customerId: senderId },
        {
          workspaceId,
          platform,
          customerId: senderId,
          pageId,
          conversationType: "dm",
          lastMessage: messagePayload.text || "[Flow Message]",
          lastMessageAt: new Date()
        },
        { upsert: true, new: true }
      );

      // Save sent message
      const newMsg = await MetaMessage.create({
        workspaceId,
        conversationId: conversation._id,
        platform,
        senderType: "bot", // distinguish flow messages
        senderId: pageId,
        recipientId: senderId,
        customerId: senderId,
        messageId: messageId,
        messageText: messagePayload.text || "",
        status: messageStatus,
        timestamp: new Date()
      });

      if (global.io) {
        global.io.to(workspaceId.toString()).emit("social:new_message", {
          conversation,
          message: newMsg
        });
      }

      if (messageStatus === "failed") {
         throw new Error("Meta API Request Failed (Check logs)");
      }

      return { success: true, message: newMsg, data: apiResponseData };
    } catch (error) {
      // If error happens outside of the API call (e.g. DB error)
      if (error.message !== "Meta API Request Failed (Check logs)") {
         console.error(`[Meta Flow General Error]`, error);
      }
      throw error;
    }
  }
}

module.exports = new MetaSocialController();
