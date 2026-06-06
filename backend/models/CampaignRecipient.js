const mongoose = require("mongoose");

const CampaignRecipientSchema = new mongoose.Schema({
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  phone: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        // E.164 format: 10 to 15 digits (including CC)
        const clean = v.replace(/\+/g, "");
        return /^\d{10,15}$/.test(clean);
      },
      message: 'Phone must be a valid international format (10-15 digits)'
    }
  },
  name: String,
  status: {
    type: String,
    enum: ["pending", "sent", "delivered", "read", "failed"],
    default: "pending",
  },
  messageId: String, // Store the WhatsApp message ID for status updates
  source: {
    type: String,
    enum: ["group", "manual", "csv", "contacts"],
    required: true,
  },
  sentAt: Date,
  deliveredAt: Date,
  readAt: Date,
  repliedAt: Date,
  failedAt: Date,
  failureReason: String,
}, { timestamps: true });

CampaignRecipientSchema.index({ campaignId: 1, phone: 1 }, { unique: true });

module.exports = mongoose.model("CampaignRecipient", CampaignRecipientSchema);
