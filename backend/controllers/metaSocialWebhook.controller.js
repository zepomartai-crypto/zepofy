// controllers/metaSocialWebhook.controller.js
// Handles Facebook & Instagram real-time webhooks (GET challenge and POST event streams)

const axios = require("axios");
const MetaIntegration = require("../models/MetaIntegration");
const MetaWebhookLog = require("../models/MetaWebhookLog");
const MetaConversation = require("../models/MetaConversation");
const MetaMessage = require("../models/MetaMessage");
const flowEngine = require("../modules/flowBuilder/flow.engine");

class MetaSocialWebhookController {
  /**
   * Handle webhook GET requests (handshake/verification from Meta)
   */
  async verifyWebhook(req, res) {
    try {
      const { userId } = req.params;
      const {
        "hub.mode": mode,
        "hub.verify_token": token,
        "hub.challenge": challenge
      } = req.query;

      console.log(`🔍 [Meta Webhook Verification] Query for user ${userId}`);

      if (!userId) {
        return res.status(400).json({ error: "Missing userId" });
      }

      if (mode === "subscribe" && token) {
        const integration = await MetaIntegration.findOne({ userId });
        if (!integration) {
          console.error(`❌ [Meta Webhook Verification] No integration config found`);
          return res.status(404).json({ error: "Integration config not found" });
        }

        if (token === integration.verifyToken) {
          console.log(`✅ [Meta Webhook Verification] Successfully verified token`);
          if (integration.webhookStatus !== "active") {
            integration.webhookStatus = "active";
            await integration.save();
          }
          return res.status(200).send(challenge);
        } else {
          return res.status(403).json({ error: "Verification token mismatch" });
        }
      }
      return res.status(400).json({ error: "Invalid verification request parameters" });
    } catch (error) {
      console.error("❌ [Meta Webhook Verification Error]:", error);
      return res.status(500).json({ error: "Internal server error during verification" });
    }
  }

  async handleWebhookEvents(req, res) {
    // Ensure webhook immediately returns 200 OK to Meta
    if (!res.headersSent) {
      res.sendStatus(200);
    }

    try {
      const { userId } = req.params;
      console.log(`\n============================================`);
      console.log(`🚀 [META WEBHOOK HIT] POST /api/webhook/meta/${userId}`);

      let payload = req.body;
      if (Buffer.isBuffer(payload)) {
        try {
          payload = JSON.parse(payload.toString("utf8"));
        } catch (parseErr) {
          console.error("❌ [Meta Webhook] Failed to parse Buffer:", parseErr.message);
          return;
        }
      } else if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch (parseErr) {
          console.error("❌ [Meta Webhook] Failed to parse String:", parseErr.message);
          return;
        }
      }

      const { object, entry } = payload || {};

      // We ONLY care about "instagram" or "page" (facebook messenger)
      if (object !== "instagram" && object !== "page") {
        console.log(`[Meta Webhook] Ignoring object type: ${object}`);
        return;
      }

      if (!userId) return;

      const integration = await MetaIntegration.findOne({ userId });
      if (!integration) {
        console.error(`❌ [Meta Webhook Event] Invalid userId: ${userId}`);
        return;
      }

      const platform = object === "instagram" ? "instagram" : "facebook";

      if (!entry || !Array.isArray(entry)) return;

      console.log(`[Meta Webhook] Processing ${entry.length} entries for ${platform}...`);

      // Process each entry in the webhook batch asynchronously
      for (const entryItem of entry) {
        await this.processWebhookEntry(integration, platform, entryItem);
      }
    } catch (error) {
      console.error("❌ [Meta Webhook Event Processing Error]:", error);
    }
  }

  /**
   * Process a single entry payload item and log/broadcast it
   */
  async processWebhookEntry(integration, platform, entryItem) {
    try {
      const { id, messaging, changes } = entryItem;
      const workspaceId = integration.userId;

      // 1. Process messaging events (Messenger / IG Direct Messages)
      if (messaging && Array.isArray(messaging)) {
        for (const msgItem of messaging) {
          const senderId = msgItem.sender?.id || "unknown_sender";
          let eventType = "message";

          if (msgItem.read) eventType = "read";
          else if (msgItem.delivery) eventType = "delivery";
          else if (msgItem.postback) eventType = "postback";
          else if (msgItem.message?.is_echo) eventType = "message_echo";
          else if (msgItem.optin) eventType = "optin";

          // --- NOISE REDUCTION: Ignore non-actionable events ---
          if (["read", "delivery", "message_echo"].includes(eventType)) {
            continue;
          }

          if (eventType === "message" && msgItem.message) {
            console.log(`💬 [Social Inbox] New incoming message from ${senderId}`);
            await this.handleIncomingMessage(integration, platform, senderId, msgItem);
          }

          // Legacy log
          await this.logAndEmitEvent({ workspaceId, platform, eventType, senderId, payload: msgItem });
        }
      }

      // 2. Process feed changes (Comments, Mentions, Page likes, etc.)
      if (changes && Array.isArray(changes)) {
        for (const changeItem of changes) {
          const eventType = changeItem.field || "feed_change";
          let senderId = changeItem.value?.from?.id || changeItem.value?.sender_id || "unknown";
          
          if (eventType === "comments" || (eventType === "feed" && changeItem.value?.item === "comment") || (eventType === "feed" && changeItem.value?.item === "post")) {
            const commentId = changeItem.value?.id || changeItem.value?.comment_id || changeItem.value?.post_id || `comment_${Date.now()}`;
            const text = changeItem.value?.text || changeItem.value?.message || "[Comment]";
            
            // Normalize payload to look like a message so we can reuse handleIncomingMessage
            const normalizedMsg = {
              message: {
                mid: commentId,
                text: text,
              },
              timestamp: changeItem.value?.created_time ? new Date(changeItem.value.created_time).getTime() : Date.now(),
              isComment: true,
              post_id: changeItem.value?.post_id || null
            };
            
            console.log(`💬 [Social Inbox] New incoming comment/post from ${senderId}`);
            await this.handleIncomingMessage(integration, platform, senderId, normalizedMsg);
          }

          await this.logAndEmitEvent({ workspaceId, platform, eventType, senderId, payload: changeItem });
        }
      }
    } catch (error) {
      console.error(`❌ [Meta Webhook] Error processing entry item:`, error);
    }
  }

  /**
   * Handle incoming message for the Social Inbox
   */
  async handleIncomingMessage(integration, platform, senderId, msgItem) {
    const workspaceId = integration.userId;
    const messageId = msgItem.message.mid;
    const text = msgItem.message.text || "";
    const attachments = msgItem.message.attachments || [];
    let mediaUrl = "";
    let messageType = "text";
    
    // Determine pageId based on platform
    let pageId = null;
    if (platform === "facebook") pageId = integration.facebookPageId;
    if (platform === "instagram") pageId = integration.instagramBusinessId;

    if (attachments.length > 0) {
      messageType = attachments[0].type;
      mediaUrl = attachments[0].payload?.url || "";
    }

    try {
      // 1. Check if message already exists to prevent duplicate processing
      const existingMsg = await MetaMessage.findOne({ messageId: messageId });
      if (existingMsg) return;

      // 2. Fetch User Profile from Graph API
      let customerName = "Unknown User";
      let profilePicture = "";
      let username = "";

      try {
        if (integration.accessToken) {
          const fields = platform === "instagram" ? "name,username,profile_pic" : "first_name,last_name,profile_pic";
          const graphUrl = `https://graph.facebook.com/v25.0/${senderId}?fields=${fields}&access_token=${integration.accessToken}`;
          const profileRes = await axios.get(graphUrl);
          if (profileRes.data) {
            if (platform === "facebook") {
              const firstName = profileRes.data.first_name || "";
              const lastName = profileRes.data.last_name || "";
              const fullName = `${firstName} ${lastName}`.trim();
              if (fullName) customerName = fullName;
            } else {
              customerName = profileRes.data.name || profileRes.data.username || customerName;
            }
            profilePicture = profileRes.data.profile_pic || profilePicture;
            username = profileRes.data.username || "";
          }
        }
      } catch (profileErr) {
        console.error(`⚠️ [Social Inbox] Could not fetch profile for ${senderId}:`, profileErr.response?.data || profileErr.message);
      }

      // 3. Upsert MetaConversation
      const convType = msgItem.isComment ? "comment" : "dm";
      const conversation = await MetaConversation.findOneAndUpdate(
        { workspaceId, platform, customerId: senderId },
        {
          workspaceId,
          platform,
          customerId: senderId,
          customerName,
          customerUsername: username,
          customerProfilePic: profilePicture,
          pageId,
          conversationType: convType,
          lastMessage: messageType === "text" ? text : `[${messageType}]`,
          lastMessageAt: new Date(),
          $inc: { unreadCount: 1 }
        },
        { upsert: true, new: true }
      );
      
      console.log(`[Meta Conversation Created] ID: ${conversation._id}`);

      // 4. Save MetaMessage
      const newMsg = await MetaMessage.create({
        workspaceId,
        conversationId: conversation._id,
        platform,
        senderType: "customer",
        senderId: senderId,
        recipientId: pageId,
        customerId: senderId,
        messageId: messageId,
        messageText: text,
        attachments: attachments,
        status: "received",
        timestamp: new Date(msgItem.timestamp || Date.now()),
        rawPayload: msgItem
      });

      console.log(`[Meta Message Saved] ID: ${newMsg._id}`);

      // 5. Broadcast to Social Inbox UI via Socket.io
      if (global.io) {
        console.log(`📡 [Social Inbox Socket] Emitting 'social:new_message' to workspace: ${workspaceId}`);
        global.io.to(workspaceId.toString()).emit("social:new_message", {
          conversation,
          message: newMsg
        });
      }

      // 6. Trigger Auto Flow System
      if (text) {
        // Map senderId as phone for flow engine compatibility
        const metadata = { platform, customerName, conversationId: conversation._id };
        await flowEngine.handleIncomingEvent(workspaceId, senderId, "message", text, metadata);
      }

    } catch (err) {
      console.error(`❌ [Social Inbox] Error saving message:`, err);
    }
  }

  /**
   * Logs incoming events to legacy WebhookLog database (kept for debugging)
   */
  async logAndEmitEvent({ workspaceId, platform, eventType, senderId, payload }) {
    try {
      const newLog = await MetaWebhookLog.create({
        workspaceId,
        platform,
        eventType,
        senderId,
        status: "logged",
        payload
      });
      // Legacy emit for debugging logs UI
      if (global.io) {
        global.io.to(workspaceId.toString()).emit("meta_event_logged", newLog);
      }
    } catch (error) {
      console.error("❌ [Meta Webhook DB] Database save failure!", error.message);
    }
  }
}

module.exports = new MetaSocialWebhookController();
