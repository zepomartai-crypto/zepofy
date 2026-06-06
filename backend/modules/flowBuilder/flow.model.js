const mongoose = require("mongoose");

const FlowSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    name: {
      type: String,
      required: true
    },
    triggerType: {
      type: String,
      required: true,
      default: "Message Received"
    },
    platform: {
      type: String,
      enum: ["whatsapp", "instagram", "facebook"],
      default: "whatsapp"
    },
    keywords: {
      type: [String],
      default: []
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: false
    },
    cooldownHours: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ["draft", "active", "paused"],
      default: "active"
    },
    nodes: [
      {
        id: { type: String, required: true },
        type: { type: String },
        position: {
          x: { type: Number },
          y: { type: Number }
        },
        data: { type: mongoose.Schema.Types.Mixed, default: {} }
      }
    ],
    connections: [
      {
        id: { type: String },
        source: { type: String },
        target: { type: String },
        sourceHandle: { type: String },
        targetHandle: { type: String }
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model("AutomationFlow", FlowSchema);
