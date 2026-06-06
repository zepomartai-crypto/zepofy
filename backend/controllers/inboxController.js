const mongoose = require("mongoose");
const Message = require("../models/Message");
const Contact = require("../models/Contact");
const Template = require("../models/Template");
const User = require("../models/User");
const whatsappService = require("../services/whatsappService");
const metaTemplateService = require("../services/metaTemplateService");
const conversationService = require("../services/conversation.service");
const path = require("path");
const fs = require("fs");
const metaMediaService = require("../services/metaMediaService");
const {
  processTemplateVariables,
  generatePreview,
} = require("../services/simpleVariableHandler");

/* ---------------- GET CUSTOMERS ---------------- */
exports.getCustomers = async (req, res) => {
  try {
    const customers = await Contact.find({ userId: req.userId }).sort({ lastMessageTime: -1 });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ---------------- GET MESSAGES ---------------- */
exports.getMessages = async (req, res) => {
  try {
    console.log("🔍 MESSAGES API DEBUG: Fetching messages for ID:", req.params.id, "userId:", req.userId);

    const MessageModel = require("../models/Message");
    const ContactGroup = require("../models/ContactGroup");
    let messages = [];

    // ✅ Check if this is a groupId first
    const group = await ContactGroup.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (group) {
      console.log("🔍 MESSAGES API DEBUG: Found group, fetching by groupId:", group.name);
      messages = await MessageModel.find({
        groupId: req.params.id,
        userId: req.userId
      }).sort({ createdAt: 1 });
    } else {
      console.log("🔍 MESSAGES API DEBUG: Not a group, treating as individual chat");
      const Conversation = require("../models/Conversation");

      try {
        const conversation = await Conversation.findOne({
          customerId: req.params.id,
          userId: req.userId
        });

        if (conversation) {
          messages = await MessageModel.find({
            $or: [
              { conversationId: conversation._id },
              { customerId: req.params.id }
            ],
            userId: req.userId
          }).sort({ createdAt: 1 });
        } else {
          messages = await MessageModel.find({
            customerId: req.params.id,
            userId: req.userId
          }).sort({ createdAt: 1 });
        }
      } catch (convErr) {
        messages = await MessageModel.find({
          customerId: req.params.id,
          userId: req.userId
        }).sort({ createdAt: 1 });
      }
    }

    console.log("🔍 MESSAGES API DEBUG: Final result - returning", messages.length, "messages");
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ---------------- SEND TEXT MESSAGE ---------------- */
exports.sendMessage = async (req, res) => {
  try {
    const { customerId, groupId, text } = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ success: false, error: "Text required" });
    }

    let contact;
    let targetPhone;
    let targetType;

    if (groupId) {
      const ContactGroup = require("../models/ContactGroup");
      const group = await ContactGroup.findOne({ _id: groupId, userId: req.userId });
      if (!group) return res.status(404).json({ success: false, error: "Group not found" });

      if (!group.contactIds || group.contactIds.length === 0) {
        return res.status(400).json({ success: false, error: "Group has no members" });
      }
      contact = await Contact.findOne({ _id: group.contactIds[0], userId: req.userId });
      if (!contact) return res.status(404).json({ success: false, error: "No valid contacts in group" });

      targetPhone = contact.phone;
      targetType = "group";
    } else {
      contact = await Contact.findOne({ _id: customerId, userId: req.userId });
      if (!contact) return res.status(404).json({ success: false, error: "Contact not found" });

      targetPhone = contact.phone;
      targetType = "individual";
    }

    if (contact && contact.isBlocked) {
      return res.status(400).json({ success: false, error: "Cannot send message to a blocked contact" });
    }

    const now = new Date();
    const lastMessageTime = contact.lastMessageTime;
    let isSessionActive = false;

    if (lastMessageTime) {
      const hoursSinceLastMessage = (now - lastMessageTime) / (1000 * 60 * 60);
      isSessionActive = hoursSinceLastMessage <= 24;
    }

    const hasCustomerReplied = await Message.findOne({
      userId: req.userId,
      customerId: contact._id,
      direction: "incoming",
      createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
    });

    if (!isSessionActive && !hasCustomerReplied) {
      return res.status(400).json({
        success: false,
        error: "WHATSAPP_SESSION_INACTIVE",
        message: "Customer session inactive. Send a template first.",
        requiresTemplate: true
      });
    }

    let whatsappResponse;
    let actualMessageId;
    try {
      whatsappResponse = await whatsappService.sendTextMessage(req.userId, targetPhone, text);
      actualMessageId = whatsappResponse.messages?.[0]?.id;
      if (!actualMessageId) throw new Error("WhatsApp API response missing message ID");
    } catch (whatsappErr) {
      return res.status(400).json({
        success: false,
        error: "WHATSAPP_DELIVERY_FAILED",
        message: whatsappErr.message
      });
    }

    let savedMsg = null;
    try {
      let conversationId = null;
      try {
        const conversation = await conversationService.getOrCreateConversation(contact);
        if (conversation) conversationId = conversation._id;
      } catch (convErr) { }

      savedMsg = await Message.create({
        userId: req.userId,
        customerId: groupId ? null : contact._id,
        groupId: groupId || null,
        conversationId: conversationId,
        phone: targetPhone,
        sender: "user",
        direction: "outgoing",
        isRead: true,
        type: "text",
        body: text,
        text,
        targetType: targetType,
        metaMessageId: actualMessageId,
      });

      await Contact.findByIdAndUpdate(contact._id, {
        $set: {
          lastMessage: text,
          lastMessageTime: new Date(),
          lastSender: "admin",
          unreadCount: 0,
          flowStatus: "none", // Reset on manual intervention
          updatedAt: new Date()
        }
      });

      if (conversationId) {
        conversationService.markOutbound({
          conversationId: conversationId,
          metaMessageId: actualMessageId
        }).catch(() => { });
      }
    } catch (dbErr) {
      console.error("❌ DB SAVE ERROR:", dbErr);
    }

    return res.json({
      success: true,
      messageId: actualMessageId,
      status: "sent",
      msg: savedMsg
    });

  } catch (err) {
    console.error("❌ SYSTEM ERROR:", err);
    res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
};

/* ---------------- SEND TEMPLATE MESSAGE ---------------- */
exports.sendTemplateMessage = async (req, res) => {
  try {
    const { customerId, groupId, templateId, parameters = [], catalogThumbnailSku = null } = req.body;

    const template = await Template.findOne({ _id: templateId, userId: req.userId });
    if (!template) return res.status(404).json({ success: false, error: "Template not found" });
    if (template.metaStatus !== "approved") return res.status(400).json({ success: false, error: "Template not approved" });

    // ✅ PAYLOAD ANALYSIS
    const bodyVariableCount = (template.body.match(/{{\s*[^}]+\s*}}/g) || []).length;
    const urlButtonVariables = [];
    if (template.buttons && Array.isArray(template.buttons)) {
      template.buttons.forEach((button, index) => {
        if (button.type === 'url' && button.url) {
          const buttonVars = (button.url.match(/{{\d+}}/g) || []).length;
          for (let i = 0; i < buttonVars; i++) {
            urlButtonVariables.push({ buttonIndex: index, variableIndex: i });
          }
        }
      });
    }

    const bodyParams = parameters.slice(0, bodyVariableCount);
    const buttonParams = parameters.slice(bodyVariableCount);

    let contact;
    let targetPhone;
    let messageStrategy = "meta_cloud_api";

    if (groupId) {
      // 👥 GROUP BROADCAST LOGIC
      const ContactGroup = require("../models/ContactGroup");
      const group = await ContactGroup.findOne({ _id: groupId, userId: req.userId });
      if (!group) return res.status(404).json({ success: false, error: "Group not found" });

      const results = { sent: 0, failed: 0 };
      const contacts = await Contact.find({ _id: { $in: group.contactIds }, userId: req.userId });
      const activeContacts = contacts.filter(c => !c.isBlocked);

      for (const groupContact of activeContacts) {
        try {
          const { headerOverrideUrl } = req.body;
          const phone = groupContact.phone.startsWith("91") ? groupContact.phone : `91${groupContact.phone}`;
          await whatsappService.sendTemplateMessage({
            userId: req.userId,
            to: phone,
            templateName: template.metaTemplateName,
            language: template.language,
            bodyParams,
            buttonParams,
            metaImageHandle: headerOverrideUrl || (template.header?.type === "image" ? template.header.image : null),
            catalogThumbnailSku
          });
          results.sent++;
        } catch (e) { results.failed++; }
      }

      if (results.sent > 0) {
        let resolvedBody = template.body;
        if (bodyParams && Array.isArray(bodyParams)) {
          bodyParams.forEach((val, i) => {
            resolvedBody = resolvedBody.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), String(val || ""));
          });
        }

        await Message.create({
          userId: req.userId,
          groupId: groupId,
          sender: "user",
          direction: "outgoing",
          isRead: true,
          type: "template",
          status: "sent",
          templateName: template.metaTemplateName || template.name,
          bodyText: resolvedBody,
          text: resolvedBody,
          body: resolvedBody
        });
      }

      return res.json({ success: true, message: `Dispatched to ${results.sent} members`, data: results });

    } else {
      // 👤 INDIVIDUAL DISPATCH LOGIC
      contact = await Contact.findOne({ _id: customerId, userId: req.userId });
      if (!contact) return res.status(404).json({ success: false, error: "Contact not found" });

      targetPhone = contact.phone.toString().replace(/\D/g, '');
      if (targetPhone.length === 10) targetPhone = "91" + targetPhone;

      if (contact.isBlocked) {
        return res.status(400).json({ success: false, error: "Cannot send template to a blocked contact" });
      }

      if (template.category === "MARKETING" && contact.marketingOptIn === false) {
        return res.status(400).json({ success: false, error: "Marketing Opt-in Required" });
      }

      const { headerOverrideUrl } = req.body;

      let whatsappResponse;
      try {
        whatsappResponse = await whatsappService.sendTemplateMessage({
          userId: req.userId,
          to: targetPhone,
          templateName: template.metaTemplateName,
          language: template.language,
          bodyParams,
          buttonParams,
          metaImageHandle: headerOverrideUrl || (template.header?.type === "image" ? template.header.image : null),
          catalogThumbnailSku
        });

        const messageId = whatsappResponse?.messages?.[0]?.id || whatsappResponse?.metaMessageId;
        const isFallback = !!whatsappResponse?.fallback;

        if (!messageId && !isFallback && !whatsappResponse?.success) {
          throw new Error(whatsappResponse?.error || "WhatsApp API reject");
        }

        if (isFallback) messageStrategy = "fallback_local";

        let resolvedBody = template.body;
        if (bodyParams && Array.isArray(bodyParams)) {
          bodyParams.forEach((val, i) => {
            resolvedBody = resolvedBody.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), String(val || ""));
          });
        }

        let savedMsg = whatsappResponse?.message || null;
        if (!savedMsg) {
          const conversation = await conversationService.getOrCreateConversation(contact);
          savedMsg = await Message.create({
            userId: req.userId,
            customerId: contact._id,
            conversationId: conversation?._id,
            phone: targetPhone,
            sender: "user",
            direction: "outgoing",
            isRead: true,
            type: "template",
            metaMessageId: messageId,
            status: "sent",
            templateName: template.metaTemplateName || template.name,
            bodyText: resolvedBody,
            text: resolvedBody,
            body: resolvedBody,
            headerImage: headerOverrideUrl || (template.header?.type === "image" ? template.header.image : null), // 🔥 Store override in DB
            image: headerOverrideUrl || (template.header?.type === "image" ? template.header.image : null),
            footer: template.footer || "",
            buttons: template.buttons || [] // ✅ CRITICAL: Save buttons for UI display
          });
        }

        contact.lastMessage = `📄 Template: ${template.name}`;
        contact.lastMessageTime = new Date();
        contact.lastSender = "admin";
        contact.unreadCount = 0;
        contact.flowStatus = "none"; // Reset on manual intervention
        await contact.save();

        if (savedMsg.conversationId) {
          await conversationService.markOutbound({
            conversationId: savedMsg.conversationId,
            metaMessageId: messageId,
            templateName: template.name
          }).catch(() => { });
        }

        return res.json({
          success: true,
          messageId: messageId,
          status: "sent",
          msg: savedMsg,
          strategy: messageStrategy
        });

      } catch (apiErr) {
        console.error("❌ DISPATCH ERROR:", apiErr.message);
        try {
          await Message.create({
            userId: req.userId,
            customerId: contact._id,
            phone: targetPhone,
            sender: "user",
            direction: "outgoing",
            isRead: true,
            type: "template",
            templateName: template.metaTemplateName,
            status: "failed",
            error: apiErr.message
          });
        } catch (e) { }
        return res.status(400).json({ success: false, error: apiErr.message, strategy: messageStrategy });
      }
    }
  } catch (err) {
    console.error("❌ SYSTEM ERROR:", err.message);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

/* ---------------- SEND MEDIA MESSAGE ---------------- */
exports.sendMedia = async (req, res) => {
  try {
    const { customerId, groupId, mediaUrl, mediaType, caption, filename } = req.body;
    if (!mediaUrl || !mediaType) {
      return res.status(400).json({ success: false, error: "Media URL and Type required" });
    }

    let contact;
    let targetPhone;
    let targetType;

    if (groupId) {
      const ContactGroup = require("../models/ContactGroup");
      const group = await ContactGroup.findOne({ _id: groupId, userId: req.userId });
      if (!group) return res.status(404).json({ success: false, error: "Group not found" });

      if (!group.contactIds || group.contactIds.length === 0) {
        return res.status(400).json({ success: false, error: "Group has no members" });
      }
      contact = await Contact.findOne({ _id: group.contactIds[0], userId: req.userId });
      if (!contact) return res.status(404).json({ success: false, error: "No valid contacts in group" });

      targetPhone = contact.phone;
      targetType = "group";
    } else {
      contact = await Contact.findOne({ _id: customerId, userId: req.userId });
      if (!contact) return res.status(404).json({ success: false, error: "Contact not found" });

      targetPhone = contact.phone;
      targetType = "individual";
    }

    if (contact && contact.isBlocked) {
      return res.status(400).json({ success: false, error: "Cannot send media to a blocked contact" });
    }

    const now = new Date();
    const lastMessageTime = contact.lastMessageTime;
    let isSessionActive = false;

    if (lastMessageTime) {
      const hoursSinceLastMessage = (now - lastMessageTime) / (1000 * 60 * 60);
      isSessionActive = hoursSinceLastMessage <= 24;
    }

    const hasCustomerReplied = await Message.findOne({
      userId: req.userId,
      customerId: contact._id,
      direction: "incoming",
      createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
    });

    if (!isSessionActive && !hasCustomerReplied) {
      return res.status(400).json({
        success: false,
        error: "WHATSAPP_SESSION_INACTIVE",
        message: "Customer session inactive. Send a template first.",
        requiresTemplate: true
      });
    }

    let whatsappResponse;
    try {
      whatsappResponse = await whatsappService.sendMediaMessage({
        userId: req.userId,
        to: targetPhone,
        mediaUrl,
        mediaType,
        caption,
        filename
      });
    } catch (whatsappErr) {
      return res.status(400).json({
        success: false,
        error: "WHATSAPP_DELIVERY_FAILED",
        message: whatsappErr.message
      });
    }

    const actualMessageId = whatsappResponse.messages?.[0]?.id;
    let savedMsg = null;
    try {
      const conversation = await conversationService.getOrCreateConversation(contact);
      savedMsg = await Message.create({
        userId: req.userId,
        customerId: groupId ? null : contact._id,
        groupId: groupId || null,
        conversationId: conversation?._id,
        phone: targetPhone,
        sender: "user",
        direction: "outgoing",
        isRead: true,
        type: mediaType,
        mediaType,
        mediaUrl,
        caption,
        filename,
        targetType: targetType,
        metaMessageId: actualMessageId,
        status: "sent"
      });

      await Contact.findByIdAndUpdate(contact._id, {
        $set: {
          lastMessage: `📎 ${mediaType.toUpperCase()}`,
          lastMessageTime: new Date(),
          lastSender: "admin",
          unreadCount: 0,
          flowStatus: "none", // Reset on manual intervention
          updatedAt: new Date()
        }
      });
    } catch (dbErr) { }

    return res.json({
      success: true,
      messageId: actualMessageId,
      status: "sent",
      msg: savedMsg
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
};

/* ---------------- DELETE MESSAGE ---------------- */
exports.deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const MessageModel = require("../models/Message");
    const msg = await MessageModel.findOne({ _id: id, userId: req.userId });
    if (!msg) return res.status(404).json({ success: false, error: "Message not found" });
    await MessageModel.deleteOne({ _id: id });
    res.json({ success: true, message: "Message deleted locally" });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to delete message" });
  }
};

/* ---------------- GET MEDIA PROXY ---------------- */
exports.getMediaProxy = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const { userId } = req; // From auth middleware

    console.log(`🔍 [Proxy] Requesting media: ${mediaId} (User: ${userId})`);

    // 🛡️ VALIDATION: Meta Media IDs are strictly numeric
    const isMetaId = /^\d+$/.test(mediaId);

    if (isMetaId) {
      const { stream, mimeType } = await metaMediaService.getMedia(userId, mediaId);
      res.setHeader('Content-Type', mimeType);
      stream.pipe(res);
    } else {
      // 📂 FALLBACK: Check if this is a local file or Cloudinary filename
      console.log(`📂 [Proxy] Non-Meta ID detected: ${mediaId}. Checking local uploads...`);

      const fs = require('fs');
      const path = require('path');

      // Check common upload directories
      const possiblePaths = [
        path.join(__dirname, '../uploads/media', mediaId),
        path.join(__dirname, '../uploads/template', mediaId),
        path.join(__dirname, '../uploads', mediaId)
      ];

      for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
          console.log(`✅ [Proxy] Serving local file: ${filePath}`);
          return res.sendFile(filePath);
        }
      }

      // If it looks like a Cloudinary ID (often what we saw in logs), we can't proxy it directly here
      // but we should at least not throw a 500 by calling Meta.
      console.warn(`⚠️ [Proxy] Media not found locally or on Meta: ${mediaId}`);
      res.status(404).json({ success: false, error: "Media not found" });
    }

  } catch (error) {
    console.error("❌ Proxy error:", error.message);
    // Return a more descriptive error if it was a 400 from Meta
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      error: status === 400 ? "Invalid Meta Media ID" : "Failed to load media",
      details: error.message
    });
  }
};

/* ---------------- MARK MESSAGES AS READ ---------------- */
exports.markRead = async (req, res) => {
  try {
    const { customerId, groupId } = req.body;
    if (!customerId && !groupId) return res.status(400).json({ error: "Customer ID or Group ID required" });

    if (groupId) {
      // 1. Mark group messages as read
      await Message.updateMany(
        { userId: req.userId, groupId, direction: "incoming", isRead: false },
        { $set: { isRead: true } }
      );

      // Emit socket event for group
      if (global.io) {
        global.io.to(req.userId.toString()).emit("messages_read", { groupId });
      }
    } else {
      // 1. Find the last unread incoming message to mark it as "read" on Meta
      const lastIncomingMessage = await Message.findOne({
        userId: req.userId,
        customerId,
        direction: "incoming",
        isRead: false,
        metaMessageId: { $exists: true }
      }).sort({ createdAt: -1 });

      if (lastIncomingMessage && lastIncomingMessage.metaMessageId) {
        try {
          await whatsappService.markMessageRead(req.userId, lastIncomingMessage.metaMessageId);
          console.log(`✅ Marked message ${lastIncomingMessage.metaMessageId} as read on Meta`);
        } catch (metaErr) {
          console.warn(`⚠️ Failed to mark read on Meta:`, metaErr.message);
        }
      }

      // 2. Update all local messages as read
      await Message.updateMany(
        { userId: req.userId, customerId, direction: "incoming", isRead: false },
        { $set: { isRead: true } }
      );

      // 3. Reset unreadCount on Contact
      await Contact.findByIdAndUpdate(customerId, {
        $set: { unreadCount: 0 }
      });

      // 4. Emit socket event
      if (global.io) {
        global.io.to(req.userId.toString()).emit("messages_read", { customerId });
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ---------------- CLEAR CHAT ---------------- */
exports.clearChat = async (req, res) => {
  try {
    const { id } = req.params; // customerId or groupId

    console.log(`🗑️ CLEAR CHAT: Deleting messages for target ${id} (User: ${req.userId})`);

    // Delete all messages for this customer (or group)
    const result = await Message.deleteMany({
      $or: [{ customerId: id }, { groupId: id }],
      userId: req.userId
    });

    // Also reset lastMessage/lastMessageTime on the Contact for a clean slate
    const Contact = require("../models/Contact");
    await Contact.findByIdAndUpdate(id, {
      $set: {
        lastMessage: "",
        unreadCount: 0
      }
    });

    res.json({
      success: true,
      message: "Chat history cleared successfully",
      deletedCount: result.deletedCount
    });
  } catch (err) {
    console.error("❌ CLEAR CHAT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};
