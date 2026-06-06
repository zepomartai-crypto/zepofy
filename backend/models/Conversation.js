const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      required: true,
      index: true,
    },

    phone: {
      type: String,
      index: true,
    },

    state: {
      type: String,
      default: "open",
    },

    lastMessage: String,

    lastInboundAt: Date,
    lastOutboundAt: Date,
    lastMessageAt: Date,

    lastInboundMetaMessageId: String,
    lastOutboundMetaMessageId: String,

    lastTemplateName: String,
    lastTemplateStatus: {
      type: String,
      enum: ["none", "sent", "failed", "replied"],
      default: "none",
    },
    lastTemplateMetaMessageId: String,
    lastTemplateSentAt: Date,
    lastTemplateError: Object,
  },
  { timestamps: true }
);

ConversationSchema.index({ userId: 1, customerId: 1 }, { unique: true });

module.exports = mongoose.model("Conversation", ConversationSchema);
