const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, required: true },
  password: { type: String, select: false }, // Optional for OTP users
  phoneNumber: { type: String, unique: true, sparse: true },
  phoneVerified: { type: Boolean, default: false },
  loginMethod: {
    type: String,
    enum: ['otp', 'password', 'both'],
    default: 'otp'
  },
  isActive: { type: Boolean, default: true },

  // Legacy fields
  phone: String,
  photo: String,
  profileImage: String, // New dedicated avatar field
  company: String,
  role: {
    type: String,
    enum: ['user', 'admin', 'superadmin'],
    default: 'user'
  },
  status: {
    type: String,
    // enum: ["ACTIVE", "INACTIVE", "TEMP_BLOCKED", "PERMANENT_BLOCKED", "active", "inactive", "blocked"], // Relaxed enum or remove entirely for flexibility
    default: "ACTIVE"
  },
  // Blocking fields
  isBlocked: { type: Boolean, default: false }, // Replaces or aliases 'blocked'
  blocked: { type: Boolean, default: false },   // Keeping for backward compatibility
  blockType: {
    type: String,
    enum: ["TEMPORARY", "PERMANENT"],
    default: null
  },
  blockUntil: { type: Date, default: null },
  blockReason: { type: String, default: null },
  blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Keeping as Ref for better tracking
  integrationStatus: {
    type: String,
    enum: ["ACTIVE", "INACTIVE"],
    default: "INACTIVE"
  },
  // Permissions and Access Control
  permissions: {
    dashboard: { type: Boolean, default: true },
    contacts: { type: Boolean, default: true },
    appointments: { type: Boolean, default: true },
    templates: { type: Boolean, default: true },
    campaigns: { type: Boolean, default: true },
    automation: { type: Boolean, default: true },
    whatsappFlows: { type: Boolean, default: true },
    analytics: { type: Boolean, default: true },
    integrations: { type: Boolean, default: true },
    settings: { type: Boolean, default: true },
    aiTools: { type: Boolean, default: false }
  },

  // Allowed Integrations
  allowedIntegrations: {
    woocommerce: { type: Boolean, default: true },
    shopify: { type: Boolean, default: true },
    whatsappCloud: { type: Boolean, default: true },
    whatsappBusiness: { type: Boolean, default: true },
    webhooks: { type: Boolean, default: true },
    email: { type: Boolean, default: true }
  },

  // Integration Status and Expiry
  integrations: {
    woocommerce: {
      enabled: { type: Boolean, default: true },
      expiryDate: { type: Date, default: null }
    },
    shopify: {
      enabled: { type: Boolean, default: true },
      expiryDate: { type: Date, default: null }
    },
    whatsapp: {
      enabled: { type: Boolean, default: true },
      expiryDate: { type: Date, default: null }
    },
    whatsapp_commerce: {
      enabled: { type: Boolean, default: true },
      expiryDate: { type: Date, default: null }
    },
    facebook_instagram: {
      enabled: { type: Boolean, default: false },
      expiryDate: { type: Date, default: null }
    },
    ai_bot: {
      enabled: { type: Boolean, default: false },
      expiryDate: { type: Date, default: null }
    }
  },

  // Trial Management
  trial: {
    isActive: { type: Boolean, default: true },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, default: () => new Date(+new Date() + 15 * 24 * 60 * 60 * 1000) }, // Default 15 days
    isExtended: { type: Boolean, default: false },
    extendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },

  // Subscription and Limits
  plan: {
    type: String,
    default: "FREE"
  },
  subscriptionStartDate: { type: Date, default: null },
  accountExpiry: { type: Date, default: null },
  subscriptionStatus: {
    type: String,
    enum: ["ACTIVE", "EXPIRED"],
    default: "ACTIVE"
  },
  paymentProof: {
    type: String,
    default: null
  },
  limits: {
    templateLimit: { type: Number, default: 10 },
    campaignLimit: { type: Number, default: 5 },
    contactLimit: { type: Number, default: 100 },
    messageLimit: { type: Number, default: 1000 }, // Monthly limit
    apiLimit: { type: Number, default: 100 } // Daily API limit
  },
  usage: {
    templatesCreated: { type: Number, default: 0 },
    campaignsSent: { type: Number, default: 0 },
    messagesSent: { type: Number, default: 0 },
    contactsCount: { type: Number, default: 0 }
  },

  passwordResetAt: { type: Date, default: null },
  forceLogout: { type: Boolean, default: false },
  forceLogoutAt: { type: Date, default: null },
  lastLogin: { type: Date, default: null },
  sessionToken: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);
