// models/WhatsAppIntegration.js
// Multi-tenant WhatsApp Integration Model (FINAL FIXED)

const mongoose = require("mongoose");
const crypto = require("crypto");

/* ================= ENCRYPTION CONFIG ================= */

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default32charkey1234567890123'; // Exactly 32 chars
const IV_LENGTH = 16;

// Validate encryption key
if (!ENCRYPTION_KEY || typeof ENCRYPTION_KEY !== 'string') {
  console.error("❌ ENCRYPTION_KEY missing or invalid in .env");
  process.exit(1);
}

if (Buffer.from(ENCRYPTION_KEY).length !== 32) {
  console.error("❌ ENCRYPTION_KEY must be exactly 32 characters");
  console.error("Current length:", Buffer.from(ENCRYPTION_KEY).length);
  process.exit(1);
}

console.log("✅ ENCRYPTION_KEY validated successfully");

/* ================= SCHEMA ================= */

const whatsappIntegrationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    wabaId: { type: String, required: true },
    phoneNumberId: { type: String, required: true },
    businessPhoneNumber: { type: String, required: true },

    accessToken: {
      type: String,
      required: true,
      select: false,
    },

    appId: String,

    metaApiVersion: {
      type: String,
      default: "v19.0",
    },

    status: {
      type: String,
      enum: ["not_connected", "connected", "error"],
      default: "not_connected",
    },

    connectedAt: Date,
    lastVerifiedAt: Date,
    errorMessage: String,

    webhookVerifyToken: {
      type: String,
      unique: true,
      sparse: true,
    },

    webhookConfigured: {
      type: Boolean,
      default: false,
    },
    catalogId: {
      type: String, // Meta Catalog ID for commerce
    },
    catalogConnected: {
      type: Boolean,
      default: false,
    },
    catalogName: {
      type: String,
    },
    commerceSettings: {
      isActive: { type: Boolean, default: false },
      autoReplyOnSelection: { type: Boolean, default: true },
    },
    coexistenceEnabled: {
      type: Boolean,
      default: false,
    },
    connectionType: {
      type: String,
      default: 'standard',
    },
    lastPermCheck: {
      type: Date,
    },
    flowPrivateKey: {
      type: String, // Stores the RSA private key for decrypting Flow responses
      select: false,
    },
  },
  { timestamps: true }
);

/* ================= ENCRYPT / DECRYPT ================= */

whatsappIntegrationSchema.methods.encryptToken = function (token) {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      "aes-256-cbc",
      Buffer.from(ENCRYPTION_KEY),
      iv
    );
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
  } catch (error) {
    console.error('❌ Encryption failed:', error.message);
    throw new Error(`Token encryption failed: ${error.message}`);
  }
};

whatsappIntegrationSchema.methods.decryptToken = function () {
  if (!this.accessToken) return null;

  try {
    const parts = this.accessToken.split(":");
    if (parts.length !== 2) return null;

    const iv = Buffer.from(parts[0], "hex");
    const encryptedText = Buffer.from(parts[1], "hex");
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      Buffer.from(ENCRYPTION_KEY),
      iv
    );

    const decrypted = Buffer.concat([
      decipher.update(encryptedText),
      decipher.final()
    ]);

    return decrypted.toString("utf8");
  } catch (error) {
    console.error('❌ Decryption failed:', error.message);
    return null;
  }
};

/* ================= PRE SAVE ================= */

whatsappIntegrationSchema.pre("save", async function () {
  if (this.isModified("accessToken") && this.accessToken && !this.accessToken.includes(":")) {
    this.accessToken = this.encryptToken(this.accessToken);
  }
});

/* ================= STATIC HELPERS ================= */

whatsappIntegrationSchema.statics.findByUserIdWithToken = async function (
  userId
) {
  const doc = await this.findOne({ userId }).select("+accessToken");
  if (doc && doc.accessToken) {
    doc.accessToken = doc.decryptToken();
  }
  return doc;
};

whatsappIntegrationSchema.statics.findByPhoneNumberId = async function (phoneNumberId) {
  const doc = await this.findOne({ phoneNumberId }).select("+accessToken");
  if (doc && doc.accessToken) {
    doc.accessToken = doc.decryptToken();
  }
  return doc;
};

whatsappIntegrationSchema.statics.findByWebhookToken = async function (webhookVerifyToken) {
  return await this.findOne({ webhookVerifyToken });
};

whatsappIntegrationSchema.virtual("maskedAccessToken").get(function () {
  if (!this.accessToken) return null;
  const d = this.decryptToken();
  return d ? d.slice(0, 6) + "******" + d.slice(-4) : null;
});

whatsappIntegrationSchema.set("toJSON", { virtuals: true });
whatsappIntegrationSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model(
  "WhatsAppIntegration",
  whatsappIntegrationSchema
);
