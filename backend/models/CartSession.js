const mongoose = require("mongoose");

const CartSessionSchema = new mongoose.Schema({
    integrationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "WooCommerceIntegration",
        required: true,
        index: true
    },
    userId: { // References the user who owns the integration
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    // External Identifiers
    cartKey: { type: String, required: true, index: true }, // WC Session Key
    customerId: Number, // WC Customer ID if logged in

    // Customer Details
    customer: {
        firstName: String,
        lastName: String,
        email: String,
        phone: String,
    },

    // Cart Data
    items: [{
        productId: Number,
        name: String,
        quantity: Number,
        price: Number,
        total: Number,
        image: String,
        permalink: String
    }],
    currency: { type: String, default: "USD" },
    total: { type: Number, default: 0 },
    checkoutUrl: String,

    // Tracking
    status: {
        type: String,
        enum: ["active", "abandoned", "recovered", "converted"],
        default: "active",
        index: true
    },

    lastActiveAt: { type: Date, default: Date.now },
    abandonedAt: Date, // When was it marked as abandoned?
    recoveredAt: Date, // When did they come back/purchase?

    // Automation Logs
    messagesSent: [{
        templateId: { type: mongoose.Schema.Types.ObjectId, ref: "Template" },
        sentAt: { type: Date, default: Date.now },
        status: String, // queued, sent, failed
        messageId: String
    }],

    metadata: mongoose.Schema.Types.Mixed

}, { timestamps: true });

// Index for finding abandoned carts efficiently
CartSessionSchema.index({ status: 1, lastActiveAt: 1 });

module.exports = mongoose.model("CartSession", CartSessionSchema);
