const mongoose = require("mongoose");
const crypto = require("crypto");

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default32charkey1234567890123';
const IV_LENGTH = 16;

const shopifyIntegrationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true,
        },
        storeDomain: { type: String, required: true },
        shopId: { type: String, index: true }, // Added for robust identification
        accessToken: { type: String, select: false },
        clientId: { type: String, select: false },
        clientSecret: { type: String, select: false },
        scope: String,

        // Webhook secret for verifying signatures
        webhookSecret: { type: String, select: false },

        status: {
            type: String,
            enum: ["not_connected", "connected", "error"],
            default: "not_connected",
        },

        connectedAt: Date,
        lastSyncAt: Date,
        errorMessage: String,

        // Webhook tracking
        webhookStatus: {
            type: String,
            enum: ["active", "failed", "pending"],
            default: "pending"
        },
        webhooks: [{
            id: String,
            topic: String,
            address: String
        }],

        // Automation Settings
        settings: {
            abandonedCartDelay: { type: Number, default: 60 },
            enableAbandonedCart: { type: Boolean, default: false },
            abandonedCartTemplate: { type: mongoose.Schema.Types.ObjectId, ref: "Template" },
            enableOrderConfirmation: { type: Boolean, default: false },
            orderConfirmationTemplate: { type: mongoose.Schema.Types.ObjectId, ref: "Template" },
        }
    },
    { timestamps: true }
);

// Encryption methods
shopifyIntegrationSchema.methods.encrypt = function (text) {
    if (!text) return null;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
};

shopifyIntegrationSchema.methods.decrypt = function (text) {
    if (!text) return null;
    try {
        const parts = text.split(":");
        if (parts.length !== 2) return null;
        const iv = Buffer.from(parts[0], "hex");
        const encryptedText = Buffer.from(parts[1], "hex");
        const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
        const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
        return decrypted.toString("utf8");
    } catch (error) { return null; }
};

shopifyIntegrationSchema.index({ userId: 1 }, { unique: true });

// Pre-save hook: lowercase storeDomain & handle encryption
shopifyIntegrationSchema.pre("save", async function () {
    // Normalization
    if (this.storeDomain) {
        this.storeDomain = this.storeDomain.toLowerCase().trim().replace(/^https?:\/\//, '').split('/')[0];
    }

    const clean = (val) => {
        if (!val) return val;
        // Remove whitespace and hidden characters (Zero-width space, BOM, etc.)
        return val.trim().replace(/[\u200B-\u200D\uFEFF\r\n]/g, '');
    };

    if (this.isModified("accessToken") && this.accessToken) {
        this.accessToken = clean(this.accessToken);
        if (!this.accessToken.includes(":")) this.accessToken = this.encrypt(this.accessToken);
    }
    if (this.isModified("clientId") && this.clientId) {
        this.clientId = clean(this.clientId);
        if (!this.clientId.includes(":")) this.clientId = this.encrypt(this.clientId);
    }
    if (this.isModified("clientSecret") && this.clientSecret) {
        this.clientSecret = clean(this.clientSecret);
        if (!this.clientSecret.includes(":")) this.clientSecret = this.encrypt(this.clientSecret);
    }
    if (this.isModified("webhookSecret") && this.webhookSecret) {
        this.webhookSecret = clean(this.webhookSecret);
        if (!this.webhookSecret.includes(":")) this.webhookSecret = this.encrypt(this.webhookSecret);
    }

});

shopifyIntegrationSchema.statics.findByUserIdWithKeys = async function (userId) {
    const doc = await this.findOne({ userId }).select("+accessToken +clientId +clientSecret +webhookSecret");
    if (doc) {
        if (doc.accessToken && String(doc.accessToken).includes(':')) doc.accessToken = doc.decrypt(doc.accessToken);
        if (doc.clientId && String(doc.clientId).includes(':')) doc.clientId = doc.decrypt(doc.clientId);
        if (doc.clientSecret && String(doc.clientSecret).includes(':')) doc.clientSecret = doc.decrypt(doc.clientSecret);
        if (doc.webhookSecret && String(doc.webhookSecret).includes(':')) doc.webhookSecret = doc.decrypt(doc.webhookSecret);
    }
    return doc;
};

shopifyIntegrationSchema.statics.findByShopIdOrDomainWithKeys = async function (shopId, storeDomain) {
    const cleanDomain = storeDomain ? storeDomain.toLowerCase().trim() : null;

    // Primary match by shopId, fallback to domain, BUT strictly connected status
    const query = {
        $or: [
            { shopId: shopId },
            { storeDomain: cleanDomain }
        ].filter(q => q.shopId || q.storeDomain),
        status: "connected"
    };

    const doc = await this.findOne(query).select("+accessToken +clientId +clientSecret +webhookSecret");
    if (doc) {
        if (doc.accessToken && String(doc.accessToken).includes(':')) doc.accessToken = doc.decrypt(doc.accessToken);
        if (doc.clientId && String(doc.clientId).includes(':')) doc.clientId = doc.decrypt(doc.clientId);
        if (doc.clientSecret && String(doc.clientSecret).includes(':')) doc.clientSecret = doc.decrypt(doc.clientSecret);
        if (doc.webhookSecret && String(doc.webhookSecret).includes(':')) doc.webhookSecret = doc.decrypt(doc.webhookSecret);
    }
    return doc;
};

module.exports = mongoose.model("ShopifyIntegration", shopifyIntegrationSchema);
