const mongoose = require("mongoose");

const FlowSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    flowId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "AutomationFlow",
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      required: false,
    },
    contactPhone: {
      type: String,
      required: true,
    },
    currentNodeId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "running", "waiting", "completed", "failed", "paused_for_delay"],
      default: "active",
    },
    variables: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    triggerData: {
      type: mongoose.Schema.Types.Mixed,
      default: {}, // Store Shopify/WooCommerce/Campaign payload here
    },
    waitingForInput: {
      type: Boolean,
      default: false,
    },
    lastEvent: {
      type: String, // 'message', 'button_click', 'shopify_event', etc.
    },
    lastInput: {
      type: String,
    },
    state: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    human: {
      type: Boolean,
      default: false,
    }
  },
  { timestamps: true }
);

// Unique index for active sessions per customer per flow per user
FlowSessionSchema.index({ contactPhone: 1, flowId: 1, userId: 1, status: 1 });

module.exports = mongoose.model("FlowSession", FlowSessionSchema);
