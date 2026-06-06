
const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Contact",
    required: false, // Made optional for group messages
  },

  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ContactGroup",
    required: false, // Made optional for individual messages
  },

  isCampaign: {
    type: Boolean,
    default: false,
    index: true
  },

  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Campaign",
    required: false,
    index: true
  },

  targetType: {
    type: String,
    enum: ["individual", "group", "campaign"],
    required: false, // Made optional - auto-detect based on customerId presence
    default: function () {
      if (this.isCampaign) return "campaign";
      return this.customerId ? "individual" : "group";
    }
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  phone: String, // ✅ Added phoneNumber to message directly

  sender: {
    type: String,
    enum: ["user", "bot", "customer"],
    required: true,
  },
  senderName: String, // ✅ Display name for group chat replies

  type: {
    type: String,
    enum: ["text", "template", "button", "button_reply", "list_reply", "image", "document", "video", "audio", "sticker", "interactive", "system", "order"],
    required: true,
  },

  direction: {
    type: String,
    enum: ["incoming", "outgoing"],
    required: true,
  },

  header: String,
  image: String, // ✅ Store image URL for template messages
  body: String,
  text: String,  // For text messages
  footer: String,
  mediaType: String, // For media messages (image, document, etc.)
  mediaUrl: String, // Public URL for media files
  filename: String, // Original filename for documents
  buttonText: String, // For interactive list menus

  buttons: [
    {
      type: Object, // { text, type, id }
    },
  ],

  buttonId: String, // for webhook reply
  buttonPayload: String, // button payload from webhook
  metaMessageId: String, // WhatsApp message ID to prevent duplicates

  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true,
  },
  status: {
    type: String,
    enum: ["sent", "delivered", "read", "failed", "received", "unknown"],
    default: "unknown",
    index: true
  },
  error: String,
  timestamp: {
    type: Number,
    required: false, // WhatsApp timestamp from webhook
  },
  meta: {
    type: Object, // Flexible storage for reply IDs, etc.
    default: {}
  }
});

// Index for real unread message lookups and monthly message limit checks
MessageSchema.index({ userId: 1, direction: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model("Message", MessageSchema);
