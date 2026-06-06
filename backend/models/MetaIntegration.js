// models/MetaIntegration.js
// Multi-tenant Meta (Facebook Page & Instagram Business) Integration Model

const mongoose = require("mongoose");
const crypto = require("crypto");

/* ================= ENCRYPTION CONFIG ================= */
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default32charkey1234567890123'; // Exactly 32 chars
const IV_LENGTH = 16;

// Validate encryption key
if (Buffer.from(ENCRYPTION_KEY).length !== 32) {
  console.error("❌ ENCRYPTION_KEY must be exactly 32 characters in .env");
  process.exit(1);
}

/* ================= SCHEMA ================= */
const MetaIntegrationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    facebookPageId: {
      type: String,
      required: true,
    },
    facebookPageName: {
      type: String,
    },
    instagramBusinessId: {
      type: String,
      required: true,
    },
    instagramUsername: {
      type: String,
    },
    appId: {
      type: String,
      required: true,
    },
    appSecret: {
      type: String,
      required: true,
    },
    accessToken: {
      type: String,
      required: true,
      select: false,
    },
    verifyToken: {
      type: String,
      unique: true,
      sparse: true,
    },
    webhookStatus: {
      type: String,
      enum: ["active", "inactive"],
      default: "inactive",
    },
    lastSync: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

/* ================= ENCRYPT / DECRYPT METHODS ================= */
MetaIntegrationSchema.methods.encryptToken = function (token) {
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
    console.error('❌ Meta Token Encryption failed:', error.message);
    throw new Error(`Token encryption failed: ${error.message}`);
  }
};

MetaIntegrationSchema.methods.decryptToken = function () {
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
    console.error('❌ Meta Token Decryption failed:', error.message);
    return null;
  }
};

/* ================= PRE-SAVE MIDDLEWARE ================= */
MetaIntegrationSchema.pre("save", async function () {
  if (this.isModified("accessToken") && this.accessToken && !this.accessToken.includes(":")) {
    this.accessToken = this.encryptToken(this.accessToken);
  }
});

/* ================= STATIC HELPERS ================= */
MetaIntegrationSchema.statics.findByUserIdWithToken = async function (userId) {
  const doc = await this.findOne({ userId }).select("+accessToken");
  if (doc && doc.accessToken) {
    doc.accessToken = doc.decryptToken();
  }
  return doc;
};

MetaIntegrationSchema.statics.findByVerifyToken = async function (verifyToken) {
  return await this.findOne({ verifyToken });
};

MetaIntegrationSchema.virtual("maskedAccessToken").get(function () {
  if (!this.accessToken) return null;
  const d = this.decryptToken();
  return d ? d.slice(0, 6) + "******" + d.slice(-4) : null;
});

MetaIntegrationSchema.set("toJSON", { virtuals: true });
MetaIntegrationSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("MetaIntegration", MetaIntegrationSchema);
