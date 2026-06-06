// controllers/meta.controller.js
const axios = require("axios");
const MetaConversation = require("../models/MetaConversation");
const MetaMessage = require("../models/MetaMessage");
const MetaIntegration = require("../models/MetaIntegration");

class MetaController {

  // Get all active conversations for the workspace
  async getConversations(req, res) {
    try {
      const userId = req.user._id;
      const conversations = await MetaConversation.find({ workspaceId: userId })
        .sort({ updatedAt: -1 })
        .lean();

      return res.status(200).json({ success: true, conversations });
    } catch (error) {
      console.error("❌ [Social Inbox] Error fetching conversations:", error.message);
      return res.status(500).json({ success: false, error: "Server Error" });
    }
  }

  // Get messages for a specific conversation
  async getMessages(req, res) {
    try {
      const { conversationId } = req.params;

      // Mark as read
      await MetaConversation.findByIdAndUpdate(conversationId, { unreadCount: 0 });

      const messages = await MetaMessage.find({ conversationId })
        .sort({ timestamp: 1 })
        .lean();

      return res.status(200).json({ success: true, messages });
    } catch (error) {
      console.error("❌ [Social Inbox] Error fetching messages:", error.message);
      return res.status(500).json({ success: false, error: "Server Error" });
    }
  }

  // Send a new outgoing message via Graph API
  async sendMessage(req, res) {
    try {
      const userId = req.user._id;
      const { platform, recipientId, message, conversationId } = req.body;

      if (!recipientId || !message) {
        return res.status(400).json({ success: false, error: "Recipient and message required" });
      }

      const integration = await MetaIntegration.findByUserIdWithToken(userId);
      if (!integration || !integration.accessToken) {
        return res.status(400).json({ success: false, error: "Meta Integration not configured" });
      }

      // 1. Send via Meta Graph API
      const graphUrl = `https://graph.facebook.com/v25.0/me/messages?access_token=${integration.accessToken}`;
      const payload = {
        recipient: { id: recipientId },
        message: { text: message },
        messaging_type: "RESPONSE"
      };

      try {
        const metaRes = await axios.post(graphUrl, payload);
        const metaMessageId = metaRes.data.message_id || `out_${Date.now()}`;

        // 2. Save outgoing message to DB
        let conversation = null;
        if (conversationId) {
          conversation = await MetaConversation.findById(conversationId);
        } else {
          conversation = await MetaConversation.findOne({ workspaceId: userId, customerId: recipientId, platform });
        }

        if (conversation) {
          conversation.lastMessage = message;
          conversation.updatedAt = new Date();
          await conversation.save();

          const newMsg = await MetaMessage.create({
            workspaceId: userId,
            conversationId: conversation._id,
            platform: conversation.platform,
            senderType: "agent",
            senderId: "system",
            recipientId: recipientId,
            customerId: recipientId,
            messageText: message,
            messageId: metaMessageId,
            status: "sent"
          });

          // Broadcast to socket if necessary
          if (global.io) {
            global.io.to(userId.toString()).emit("social:new_message", {
              conversation,
              message: newMsg
            });
          }
        }

        return res.status(200).json({ success: true, message: "Message sent" });
      } catch (metaErr) {
        console.error("❌ [Social Inbox] Failed to send message to Meta:", metaErr.response?.data || metaErr.message);
        return res.status(400).json({
          success: false,
          error: "Failed to send message",
          details: metaErr.response?.data || metaErr.message
        });
      }

    } catch (error) {
      console.error("❌ [Social Inbox] Error sending message:", error.message);
      return res.status(500).json({ success: false, error: "Server Error" });
    }
  }

}

module.exports = new MetaController();
