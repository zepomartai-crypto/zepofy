const mongoose = require("mongoose");
const crypto = require("crypto");

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default32charkey1234567890123';
const IV_LENGTH = 16;

const aiIntegrationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    provider: {
      type: String,
      enum: ["gemini", "openai"],
      default: "gemini",
    },
    apiKey: {
      type: String,
      required: true,
      select: false,
    },
    model: {
      type: String,
      default: "gemini-1.5-flash",
    },
    enabled: {
      type: Boolean,
      default: false,
    },
    prompt: { type: String, default: "You are a helpful assistant for Zepofy. Answer customer questions politely and concisely." },
  knowledgeBase: { type: String, default: "" },
  features: {
    orderExtraction: { type: Boolean, default: false },
    campaignWriter: { type: Boolean, default: false },
    smartReplies: { type: Boolean, default: false }
  },
  createdAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["not_configured", "active", "paused", "error"],
      default: "not_configured",
    }
  },
  { timestamps: true }
);

/* ================= ENCRYPT / DECRYPT ================= */

aiIntegrationSchema.methods.encryptToken = function (token) {
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
    console.error('❌ AI Key Encryption failed:', error.message);
    throw new Error(`Key encryption failed: ${error.message}`);
  }
};

aiIntegrationSchema.methods.decryptToken = function () {
  if (!this.apiKey) return null;

  try {
    const parts = this.apiKey.split(":");
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
    console.error('❌ AI Key Decryption failed:', error.message);
    return null;
  }
};

/* ================= PRE SAVE ================= */

aiIntegrationSchema.pre("save", async function () {
  if (this.isModified("apiKey") && this.apiKey && !this.apiKey.includes(":")) {
    this.apiKey = this.encryptToken(this.apiKey);
  }
});

/* ================= STATIC HELPERS ================= */

aiIntegrationSchema.statics.findByUserIdWithKey = async function (userId) {
  const doc = await this.findOne({ userId }).select("+apiKey");
  if (doc && doc.apiKey) {
    doc.apiKey = doc.decryptToken();
  }
  return doc;
};

module.exports = mongoose.model("AIIntegration", aiIntegrationSchema);
