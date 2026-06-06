// models/MetaWebhookDebugLog.js
// Temporary database model for capturing raw webhook requests, headers, and signature analysis.
// This is strictly for deep debugging of signature mismatches.

const mongoose = require("mongoose");

const MetaWebhookDebugLogSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: false,
    },
    metaAppId: {
      type: String, // Extracted from payload.object or payload.entry
    },
    headers: {
      type: mongoose.Schema.Types.Mixed,
    },
    rawBodyPreview: {
      type: String, // The stringified buffer content
    },
    expectedSignature: {
      type: String,
    },
    receivedSignature: {
      type: String,
    },
    signatureMatched: {
      type: Boolean,
      required: true,
    },
    appSecretPrefix: {
      type: String,
    },
  },
  { timestamps: true }
);

// Auto-delete debug logs after 24 hours to prevent db bloat
MetaWebhookDebugLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

module.exports = mongoose.model("MetaWebhookDebugLog", MetaWebhookDebugLogSchema);
