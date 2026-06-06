const mongoose = require('mongoose');

const ShopifyAbandonedCheckoutSchema = new mongoose.Schema({
    // Multi-tenant isolation
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Checkout identification (The checkout ID or Abandoned Cart ID)
    checkoutId: {
        type: String, // Likely a GID or large number
        required: true,
        index: true
    },

    // Customer info
    customerPhone: {
        type: String,
        required: true
    },
    customerEmail: {
        type: String,
        lowercase: true,
        trim: true
    },
    customerName: {
        type: String,
        trim: true
    },

    // Cart Value
    cartValue: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        required: true,
        default: 'INR'
    },

    // Products
    products: [{
        title: String,
        quantity: Number,
        price: Number,
        imageUrl: String,
        url: String
    }],

    // URL
    checkoutUrl: {
        type: String,
        required: true
    },

    // Status
    status: {
        type: String,
        enum: ['pending', 'recovered', 'active', 'lost', 'failed', 'converted'], // 'converted' == 'recovered' probably
        default: 'pending'
    },

    // Automation tracking
    whatsappSent: {
        type: Boolean,
        default: false
    },
    reminder_sent: {
        type: Boolean,
        default: false
    },
    whatsappSentAt: {
        type: Date
    },
    whatsappStatus: {
        type: String,
        enum: ['pending', 'sent', 'failed'],
        default: 'pending'
    },

    // Recovery status
    recoveredAt: {
        type: Date
    },
    recoveryRate: { // Optional, tracking
        type: Number
    },

    // Raw Payload
    rawPayload: {
        type: mongoose.Schema.Types.Mixed
    },

    // Timestamps
    abandonedAt: { // When checkout was last active or detected as abandoned
        type: Date,
        default: Date.now,
        index: true
    },
    createdAt: { // When we first saw it
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    collection: 'shopify_abandoned_checkouts'
});

// Unique Checkouts per User
ShopifyAbandonedCheckoutSchema.index({ userId: 1, checkoutId: 1 }, { unique: true });

module.exports = mongoose.model('ShopifyAbandonedCheckout', ShopifyAbandonedCheckoutSchema);
