// models/Contact.js
const mongoose = require("mongoose");

const ContactSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  name: String,
  phone: String,
  tags: [String],
  notes: String, // 🔥 ADDED: Support for contact notes
  marketingOptIn: { type: Boolean, default: true }, // Default true to allow testing/sending initially
  source: { type: String, default: "MANUAL" },
  lastMessage: String,
  lastMessageTime: Date,
  lastIncomingAt: Date, // 🔥 CRITICAL: For WhatsApp 24-hour window
  unreadCount: { type: Number, default: 0 },
  lastSender: { type: String, enum: ["customer", "admin", "bot", "ai"], default: "admin" },
  lastMessageType: { type: String, default: "text" },
  isOnline: { type: Boolean, default: false },
  isBlocked: { type: Boolean, default: false }, // 🔥 ADDED: Support for blocking contacts

  // 👥 ADVANCED CRM FIELDS
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  currentFlow: { type: mongoose.Schema.Types.ObjectId, ref: "AutomationFlow" },
  flowStatus: { type: String, enum: ["active", "completed", "none"], default: "none" },
  lastCampaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign" },
  campaignReplied: { type: Boolean, default: false },
  isHuman: { type: Boolean, default: false },

  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

ContactSchema.index({ userId: 1, phone: 1 }, { unique: true });
ContactSchema.index({ userId: 1, lastMessageTime: -1 });
ContactSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Contact", ContactSchema);
