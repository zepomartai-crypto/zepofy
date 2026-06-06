const mongoose = require("mongoose");

const MetaMessageSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "MetaConversation", required: true },
    platform: { type: String, enum: ["facebook", "instagram"], required: true },
    senderType: { type: String, enum: ["customer", "agent", "bot"], required: true },
    senderId: { type: String, required: true },
    recipientId: { type: String },
    customerId: { type: String, required: true },
    messageId: { type: String },
    messageText: { type: String },
    type: { type: String, default: "text" },
    attachments: { type: Array, default: [] },
    reactions: { type: Array, default: [] },
    status: { type: String }, // e.g., 'sent', 'delivered', 'read'
    timestamp: { type: Date, default: Date.now },
    rawPayload: { type: Object },
  },
  { timestamps: true }
);

MetaMessageSchema.index({ conversationId: 1, timestamp: 1 });
MetaMessageSchema.index({ messageId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("MetaMessage", MetaMessageSchema);
