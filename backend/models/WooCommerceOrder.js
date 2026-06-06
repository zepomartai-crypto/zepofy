const mongoose = require('mongoose');

const WooCommerceOrderSchema = new mongoose.Schema({
  // Multi-tenant isolation
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Order identification
  orderId: {
    type: Number,
    required: true,
    index: true
  },
  orderNumber: {
    type: String,
    required: true
  },

  // Order details (flexible - no strict enum validation)
  status: {
    type: String,
    required: true
  },
  totalAmount: {
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
    required: true,
    trim: true
  },
  customerEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  customerPhone: {
    type: String,
    trim: true
  },

  // Raw WooCommerce data (stored as-is)
  billing: {
    type: mongoose.Schema.Types.Mixed
  },
  shipping: {
    type: mongoose.Schema.Types.Mixed
  },
  lineItems: {
    type: mongoose.Schema.Types.Mixed
  },
  metaData: {
    type: mongoose.Schema.Types.Mixed
  },

  // Complete raw payload for debugging
  rawPayload: {
    type: mongoose.Schema.Types.Mixed
  },

  // Automation status
  whatsapp_sent: {
    type: Boolean,
    default: false
  },
  whatsapp_sent_at: {
    type: Date
  },
  whatsappStatus: {
    type: String,
    enum: ['pending', 'sent', 'failed'],
    default: 'pending'
  },
  email_sent: {
    type: Boolean,
    default: false
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
  collection: 'woocommerce_orders',
  strict: false // Allow flexible schema for additional fields
});

// STRTCT Multi-tenant Unique Constraint
WooCommerceOrderSchema.index({ userId: 1, orderId: 1 }, { unique: true });

// Other indexes for query performance
WooCommerceOrderSchema.index({ createdAt: -1 });
WooCommerceOrderSchema.index({ status: 1 });
WooCommerceOrderSchema.index({ customerEmail: 1 });

module.exports = mongoose.model('WooCommerceOrder', WooCommerceOrderSchema);
