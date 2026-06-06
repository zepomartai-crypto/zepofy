const mongoose = require("mongoose");

const CampaignNumberSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
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
    source: {
      type: String,
      enum: ["manual", "csv", "contacts", "group"],
      required: true,
    },
  },
  { timestamps: true }
);

// Compound index to prevent duplicate phones per campaign
CampaignNumberSchema.index({ campaignId: 1, phone: 1 }, { unique: true });

module.exports = mongoose.model("CampaignNumber", CampaignNumberSchema);