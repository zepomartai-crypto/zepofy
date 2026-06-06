const mongoose = require('mongoose');

const ShopifyOrderSchema = new mongoose.Schema({
    // Multi-tenant isolation
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Order identification
    shopifyOrderId: {
        type: String, // Shopify usage strings for IDs often (GraphQL GIDs or just big numbers)
        required: true,
        index: true
    },
    orderNumber: {
        type: String, // e.g. "1001"
        required: true
    },

    // Order details
    orderStatus: { // financial_status or fulfillment_status or combined
        type: String,
        required: true,
        default: 'pending'
    },
    orderTotal: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        required: true,
        default: 'INR'
    },

    // Customer information
    customerName: {
        type: String,
        trim: true
    },
    customerEmail: {
        type: String,
        trim: true,
        lowercase: true,
        index: true
    },
    customerPhone: {
        type: String,
        trim: true
    },

    // Items
    items: [{
        title: String,
        quantity: Number,
        price: Number,
        sku: String
    }],

    // Tracking
    trackingLink: {
        type: String
    },
    fulfillmentStatus: {
        type: String
    },

    // Automation status
    whatsappSent: {
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

    // Raw Payload
    rawPayload: {
        type: mongoose.Schema.Types.Mixed
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    collection: 'shopify_orders'
});

// Unique Constraint
ShopifyOrderSchema.index({ userId: 1, shopifyOrderId: 1 }, { unique: true });

module.exports = mongoose.model('ShopifyOrder', ShopifyOrderSchema);
