// models/MetaWebhookLog.js
// Scalable collection for logging raw webhook event payloads from Facebook & Instagram

const mongoose = require("mongoose");

const MetaWebhookLogSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ["facebook", "instagram"],
      required: true,
    },
    eventType: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    senderId: {
      type: String,
    },
    status: {
      type: String,
      enum: ["logged", "failed", "failed_signature"],
      default: "logged",
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true }
);

// Auto-delete webhook logs older than 30 days to optimize database size in production
MetaWebhookLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model("MetaWebhookLog", MetaWebhookLogSchema);
