const mongoose = require('mongoose');

const WooCommerceRepeatPurchaseSchema = new mongoose.Schema({
  // Multi-tenant isolation
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Customer information
  customerId: {
    type: String,
    required: true,
    index: true
  },
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  customerEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true
  },
  customerPhone: {
    type: String,
    trim: true
  },

  // Product information
  productId: {
    type: String,
    required: true,
    index: true
  },
  productName: {
    type: String,
    required: true,
    trim: true
  },
  productCategory: {
    type: String,
    trim: true
  },

  // Last order details
  lastOrderId: {
    type: Number,
    required: true
  },
  lastOrderNumber: {
    type: String,
    required: true
  },
  lastOrderDate: {
    type: Date,
    required: true,
    index: true
  },

  // Reorder estimation & tracking
  reorderCycleDays: {
    type: Number,
    default: 30
  },
  reorderDueDate: {
    type: Date,
    required: true,
    index: true
  },
  reminderCount: {
    type: Number,
    default: 0
  },
  couponGenerated: {
    type: String,
    trim: true
  },
  recoveredOrderId: {
    type: Number,
    index: true
  },
  revenueGenerated: {
    type: Number,
    default: 0
  },

  // Automation Statuses
  automationStatus: {
    type: String,
    enum: ['pending', 'sent', 'converted', 'paused', 'failed'],
    default: 'pending',
    index: true
  },
  whatsappDeliveryStatus: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'delivered', 'read'],
    default: 'pending'
  },

  // Additional helper fields
  city: {
    type: String,
    trim: true
  },
  totalSpend: {
    type: Number,
    default: 0
  },
  totalOrders: {
    type: Number,
    default: 1
  },
  vipStatus: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  collection: 'woocommerce_repeat_purchases'
});

// STRICTOR unique index so a customer can have one active reorder flow per product
WooCommerceRepeatPurchaseSchema.index({ userId: 1, customerEmail: 1, productId: 1 }, { unique: true });
WooCommerceRepeatPurchaseSchema.index({ userId: 1, automationStatus: 1 });
WooCommerceRepeatPurchaseSchema.index({ userId: 1, reorderDueDate: 1 });

module.exports = mongoose.model('WooCommerceRepeatPurchase', WooCommerceRepeatPurchaseSchema);
