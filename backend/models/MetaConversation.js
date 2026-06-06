const mongoose = require("mongoose");

const MetaConversationSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    platform: { type: String, enum: ["facebook", "instagram"], required: true },
    customerId: { type: String, required: true },
    customerName: { type: String },
    customerUsername: { type: String },
    customerProfilePic: { type: String },
    pageId: { type: String },
    conversationType: { type: String }, // e.g., 'dm', 'comment'
    lastMessage: { type: String },
    lastMessageAt: { type: Date },
    unreadCount: { type: Number, default: 0 },
    isBlocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

MetaConversationSchema.index({ platform: 1, customerId: 1, workspaceId: 1, conversationType: 1 }, { unique: true });
MetaConversationSchema.index({ updatedAt: -1 });

module.exports = mongoose.model("MetaConversation", MetaConversationSchema);
