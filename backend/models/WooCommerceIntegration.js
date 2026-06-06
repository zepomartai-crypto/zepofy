const mongoose = require("mongoose");
const crypto = require("crypto");

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default32charkey1234567890123'; // Exactly 32 chars
const IV_LENGTH = 16;

const wooCommerceIntegrationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        // ✅ FIXED FIELD NAME + NO GLOBAL UNIQUE
        storeUrl: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },
        consumerKey: { type: String, required: true, select: false },
        consumerSecret: { type: String, required: true, select: false },

        // Webhook secret for verifying signatures
        webhookSecret: { type: String, select: false },

        // ✅ SECURE TENANT MAPPING
        webhookToken: { type: String, unique: true, sparse: true, index: true, select: false },
        tenantId: { type: String, unique: true, sparse: true, index: true },
        webhookStatus: { type: String, enum: ["active", "inactive", "error"], default: "inactive" },

        status: {
            type: String,
            enum: ["not_connected", "connected", "error"],
            default: "not_connected",
        },

        connectedAt: Date,
        lastSyncAt: Date,
        errorMessage: String,

        // Automation Settings
        settings: {
            abandonedCartDelay: { type: Number, default: 60 }, // Minutes
            enableAbandonedCart: { type: Boolean, default: false },
            abandonedCartTemplate: { type: mongoose.Schema.Types.ObjectId, ref: "Template", default: null },

            enableOrderConfirmation: { type: Boolean, default: false },
            orderConfirmationTemplate: { type: mongoose.Schema.Types.ObjectId, ref: "Template", default: null },

            enableCodConfirmation: { type: Boolean, default: false },
            codConfirmationTemplate: { type: mongoose.Schema.Types.ObjectId, ref: "Template", default: null }
        }
    },
    { timestamps: true }
);

// Encryption methods
wooCommerceIntegrationSchema.methods.encrypt = function (text) {
    if (!text) return null;
    try {
        console.log("🔐 Starting encryption for text length:", text.length);
        console.log("🔑 ENCRYPTION_KEY length:", ENCRYPTION_KEY.length);

        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
        const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
        const result = iv.toString("hex") + ":" + encrypted.toString("hex");

        console.log("✅ Encryption successful, result length:", result.length);
        return result;
    } catch (error) {
        console.error('❌ Encryption failed:', error.message);
        console.error('❌ Encryption error details:', error);
        throw new Error(`Encryption failed: ${error.message}`);
    }
};

wooCommerceIntegrationSchema.methods.decrypt = function (text) {
    if (!text) return null;
    try {
        const parts = text.split(":");
        if (parts.length !== 2) return null;
        const iv = Buffer.from(parts[0], "hex");
        const encryptedText = Buffer.from(parts[1], "hex");
        const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
        const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
        return decrypted.toString("utf8");
    } catch (error) {
        console.error('❌ Decryption failed:', error.message);
        return null;
    }
};

// Pre-save hooks for encryption - DISABLED TEMPORARILY
// wooCommerceIntegrationSchema.pre("save", function (next) {
//     try {
//         console.log("🔐 Pre-save encryption hook triggered");
//         
//         if (this.isModified("consumerKey") && this.consumerKey && !this.consumerKey.includes(":")) {
//             console.log("🔑 Encrypting consumerKey");
//             this.consumerKey = this.encrypt(this.consumerKey);
//             console.log("✅ consumerKey encrypted");
//         }
//         if (this.isModified("consumerSecret") && this.consumerSecret && !this.consumerSecret.includes(":")) {
//             console.log("🔒 Encrypting consumerSecret");
//             this.consumerSecret = this.encrypt(this.consumerSecret);
//             console.log("✅ consumerSecret encrypted");
//         }
//         if (this.isModified("webhookSecret") && this.webhookSecret && !this.webhookSecret.includes(":")) {
//             console.log("🔐 Encrypting webhookSecret");
//             this.webhookSecret = this.encrypt(this.webhookSecret);
//             console.log("✅ webhookSecret encrypted");
//         }
//         
//         console.log("🔐 Encryption completed, proceeding to save");
//         next();
//     } catch (error) {
//         console.error("❌ Encryption error in pre-save hook:", error);
//         next(error);
//     }
// });

// Static helper to find by User ID and decrypt keys
wooCommerceIntegrationSchema.statics.findByUserIdWithKeys = async function (userId) {
    const doc = await this.findOne({ userId }).select("+consumerKey +consumerSecret +webhookSecret +webhookToken");
    if (doc) {
        if (doc.consumerKey) doc.consumerKey = doc.decrypt(doc.consumerKey);
        if (doc.consumerSecret) doc.consumerSecret = doc.decrypt(doc.consumerSecret);
        if (doc.webhookSecret) doc.webhookSecret = doc.decrypt(doc.webhookSecret);
    }
    return doc;
};

// Add multi-tenant indexes
wooCommerceIntegrationSchema.index({ storeUrl: 1, userId: 1 });
wooCommerceIntegrationSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model("WooCommerceIntegration", wooCommerceIntegrationSchema);
