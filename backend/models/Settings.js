const mongoose = require("mongoose");

const SettingsSchema = new mongoose.Schema({

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    unique: true,
    required: true
  },

  // ======================
  // WHATSAPP CONFIG
  // ======================
  whatsapp: {
    status: {
      type: String,
      enum: ["connected", "not_connected", "pending", "suspended"],
      default: "not_connected"
    },
    phoneNumber: String,
    phoneNumberId: String,
    businessAccountId: String,
    webhookSecret: String,
    lastSyncAt: Date
  },

  // ======================
  // WEBHOOK CONFIG
  // ======================
  webhook: {
    url: String,
    events: [String],
    retries: { type: Number, default: 3 },
    timeout: { type: Number, default: 10000 },
    lastTestAt: Date,
    lastTestStatus: String
  },

  // ======================
  // NOTIFICATIONS
  // ======================
  notifications: {
    email: { enabled: { type: Boolean, default: true } },
    inApp: { enabled: { type: Boolean, default: true } }
  },

  // ======================
  // SECURITY
  // ======================
  security: {
    twoFactorAuth: {
      enabled: { type: Boolean, default: false },
      secret: String,
      backupCodes: [String]
    },
    apiKeys: [{
      name: String,
      key: String,
      permissions: [String],
      lastUsed: Date,
      createdAt: { type: Date, default: Date.now },
      expiresAt: Date,
      isActive: { type: Boolean, default: true }
    }],
    ipWhitelist: [String],
    sessionTimeout: {
      type: Number,
      min: 300,
      max: 86400,
      default: 3600
    }
  },
  
  appointments: {
    reminders: {
      enabled: { type: Boolean, default: true },
      confirmationEnabled: { type: Boolean, default: true },
      confirmationMessage: { 
        type: String, 
        default: "Hello {{patient_name}}, your appointment is confirmed for {{appointment_date}} at {{appointment_time}}."
      },
      reminderEnabled: { type: Boolean, default: true },
      reminderDaysBefore: { type: Number, default: 0 },
      reminderHoursBefore: { type: Number, default: 2 },
      reminderTime: { type: String, default: "09:00" },
      reminderMessage: { 
        type: String, 
        default: "Hello {{patient_name}}, this is a reminder for your appointment on {{appointment_date}} at {{appointment_time}}."
      }
    }
  },

  // ======================
  // MESSAGING CONFIG
  // ======================
  messaging: {
    autoReply: {
      enabled: { type: Boolean, default: false },
      templateId: { type: mongoose.Schema.Types.ObjectId, ref: "Template", default: null },
      delayMinutes: { type: Number, default: 1 },
      businessHoursOnly: { type: Boolean, default: true }
    },
    retries: { type: Number, default: 3 },
    rateLimiting: {
      enabled: { type: Boolean, default: true },
      messagesPerMinute: { type: Number, default: 30 }
    },
    templates: {
      defaultWelcome: { type: mongoose.Schema.Types.ObjectId, ref: "Template", default: null },
      defaultGoodbye: { type: mongoose.Schema.Types.ObjectId, ref: "Template", default: null },
      defaultError: { type: mongoose.Schema.Types.ObjectId, ref: "Template", default: null }
    },
    orderConfirmation: {
      enabled: { type: Boolean, default: true },
      templateId: { type: String } // Storing template name/ID as string for WhatsApp API
    }
  },

  // ======================
  // ECOMMERCE INTEGRATIONS
  // ======================
  woocommerce: {
    connected: { type: Boolean, default: false },
    storeUrl: String,
    consumerKey: String,
    consumerSecret: String,
    lastSync: Date,
    settings: mongoose.Schema.Types.Mixed
  },
  shopify: {
    connected: { type: Boolean, default: false },
    storeDomain: String,
    accessToken: String,
    lastSync: Date,
    settings: mongoose.Schema.Types.Mixed
  },

  // ======================
  // BUSINESS
  // ======================
  business: {
    name: String,
    timezone: { type: String, default: "UTC" }
  },

  // ======================
  // EMAIL CONFIG (IMPORTANT) - Supports both SMTP and API providers
  // ======================
  email: {
    provider: { type: String, enum: ['smtp', 'resend', 'sendgrid'], default: 'resend' },

    // API Provider fields (Resend, SendGrid, etc.)
    apiKey: String, // encrypted later

    // SMTP fields (legacy support)
    host: String,
    port: Number,
    username: String,
    password: String, // encrypted later
    secure: { type: Boolean, default: false },

    // Common fields for all providers
    fromEmail: String,
    fromName: String,
    isActive: { type: Boolean, default: false },
    connected: { type: Boolean, default: false },
    lastVerified: Date,
    lastTestAt: Date,
    lastTestSuccess: { type: Boolean, default: false }
  },

  // ======================
  // SMTP CONFIG (LEGACY - FOR MIGRATION)
  // ======================
  smtp: {
    host: String,
    port: Number,
    secure: { type: Boolean, default: false },
    username: String,
    password: String, // encrypted later
    fromEmail: String,
    fromName: String,
    isActive: { type: Boolean, default: false },
    connected: { type: Boolean, default: false },
    lastVerified: Date,
    lastTestAt: Date,
    lastTestSuccess: { type: Boolean, default: false }
  },

  // ======================
  // METADATA
  // ======================
  metadata: {
    lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    version: { type: Number, default: 1 },
    changelog: [{
      field: String,
      oldValue: mongoose.Schema.Types.Mixed,
      newValue: mongoose.Schema.Types.Mixed,
      modifiedAt: { type: Date, default: Date.now }
    }]
  }

}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform(doc, ret) {
      if (ret.security?.twoFactorAuth?.secret) {
        delete ret.security.twoFactorAuth.secret;
      }
      if (ret.smtp?.password) {
        delete ret.smtp.password;
      }
      return ret;
    }
  }
});

// ======================
// VIRTUALS
// ======================
SettingsSchema.virtual("isWhatsAppConnected").get(function () {
  return this.whatsapp.status === "connected";
});

SettingsSchema.virtual("isSmtpConnected").get(function () {
  return !!this.smtp?.connected;
});

SettingsSchema.virtual("isEmailConnected").get(function () {
  return !!this.email?.connected;
});

module.exports = mongoose.model("Settings", SettingsSchema);
