const mongoose = require('mongoose');

const AbandonedCartSchema = new mongoose.Schema({
    // User identification (CRITICAL for multi-tenant system)
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Store identification
    wooCommerceStoreId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WooCommerceIntegration',
        required: false,
        index: true
    },

    // Cart identification
    cart_id: {
        type: String,
        required: true,
        index: true
    },

    // Customer information
    customer_name: {
        type: String,
        trim: true
    },
    customer_email: {
        type: String,
        trim: true,
        lowercase: true,
        index: true
    },
    customer_phone: {
        type: String,
        trim: true
    },

    // Cart details
    cart_items: [{
        name: String,
        quantity: Number,
        price: Number,
        total: Number,
        image: String,
        url: String
    }],
    total_amount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        required: true,
        default: 'USD'
    },

    // WooCommerce order reference
    woo_order_id: {
        type: Number,
        index: true
    },
    woo_order_number: {
        type: String
    },

    // Payment information
    payment_url: {
        type: String
    },

    // Status tracking
    status: {
        type: String,
        required: true,
        default: 'active',
        enum: ['active', 'abandoned', 'recovered', 'converted', 'pending'] // Added pending/active for native flow support
    },

    // URLs and metadata
    store_url: {
        type: String,
        trim: true
    },
    recovery_url: {
        type: String,
        trim: true
    },
    checkout_started_at: {
        type: Date,
        default: Date.now
    },
    abandoned_at: {
        type: Date,
        required: true,
        default: Date.now,
        index: true
    },
    whatsapp_sent: {
        type: Boolean,
        default: false
    },
    whatsapp_sent_at: {
        type: Date
    },
    email_sent: {
        type: Boolean,
        default: false
    },
    email_sent_at: {
        type: Date
    },
    recovered: {
        type: Boolean,
        default: false
    },
    recovered_at: {
        type: Date
    },

    // Timestamps
    created_at: {
        type: Date,
        default: Date.now,
        index: true
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'abandoned_carts'
});

// Indexes for better query performance and multi-tenancy enforcement
// Compound index to ensure unique cart per user/store (cart_id repeats across stores but unique per store)
AbandonedCartSchema.index({ userId: 1, cart_id: 1 }, { unique: true });
AbandonedCartSchema.index({ userId: 1, status: 1 });
AbandonedCartSchema.index({ userId: 1, abandoned_at: -1 });

module.exports = mongoose.model('AbandonedCart', AbandonedCartSchema);
