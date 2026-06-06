const Conversation = require("../models/Conversation");

exports.getOrCreateConversation = async (contact) => {
  if (!contact?._id || !contact?.userId) return null;

  // ✅ FIX: phone ONLY in $set, not in $setOnInsert
  const convo = await Conversation.findOneAndUpdate(
    { userId: contact.userId, customerId: contact._id },
    {
      $setOnInsert: {
        phone: contact.phone,
        state: "open",
      },
    },
    { upsert: true, new: true }
  );

  return convo;
};

exports.markInbound = async ({ conversationId, metaMessageId }) => {
  if (!conversationId) return;

  await Conversation.findByIdAndUpdate(conversationId, {
    $set: {
      state: "replied",
      lastInboundAt: new Date(),
      lastMessageAt: new Date(),
      lastInboundMetaMessageId: metaMessageId,
      lastTemplateStatus: "replied",
    },
  });
};

exports.markOutbound = async ({ conversationId, metaMessageId, templateName }) => {
  if (!conversationId) return;

  const update = {
    state: "awaiting_reply",
    lastOutboundAt: new Date(),
    lastMessageAt: new Date(),
    lastOutboundMetaMessageId: metaMessageId,
  };

  if (templateName) {
    update.lastTemplateName = templateName;
    update.lastTemplateStatus = "sent";
    update.lastTemplateMetaMessageId = metaMessageId;
    update.lastTemplateSentAt = new Date();
    update.lastTemplateError = null;
  }

  await Conversation.findByIdAndUpdate(conversationId, { $set: update });
};

exports.markTemplateFailed = async ({ conversationId, templateName, error }) => {
  if (!conversationId) return;

  await Conversation.findByIdAndUpdate(conversationId, {
    $set: {
      lastTemplateName: templateName,
      lastTemplateStatus: "failed",
      lastTemplateError: error,
    },
  });
};

exports.updateLastMessage = async ({ conversationId, message }) => {
  if (!conversationId) return;
  await Conversation.findByIdAndUpdate(conversationId, {
    $set: {
      lastMessage: message,
      lastMessageAt: new Date()
    }
  });
};
