const mongoose = require("mongoose");

const WebhookLogSchema = new mongoose.Schema({
    // Source identification
    source: {
        type: String,
        required: true,
        enum: ['woocommerce', 'whatsapp', 'shopify', 'meta', 'gokwik'],
        index: true
    },
    
    // User identification (multi-tenant)
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true,
        index: true 
    },
    
    // Webhook status
    status: {
        type: String,
        required: true,
        enum: ['success', 'failed', 'pending', 'retried'],
        default: 'pending',
        index: true
    },
    
    // Event details
    topic: {
        type: String,
        index: true
    },
    
    eventType: {
        type: String,
        index: true
    },
    
    // Payload information
    payload: {
        type: mongoose.Schema.Types.Mixed
    },
    
    payloadPreview: {
        type: String // Store a preview for quick viewing
    },
    
    // Request details
    headers: {
        type: mongoose.Schema.Types.Mixed
    },
    
    // Error information
    error: {
        type: String
    },
    
    errorMessage: {
        type: String
    },
    
    errorCode: {
        type: String
    },
    
    // Performance metrics
    responseTime: {
        type: Number // in milliseconds
    },
    
    processingTime: {
        type: Number // in milliseconds
    },
    
    // Network information
    ip: {
        type: String
    },
    
    userAgent: {
        type: String
    },
    
    // Response details
    responseStatus: {
        type: Number
    },
    
    responseBody: {
        type: String
    },
    
    // Additional metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed
    }
}, { 
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    collection: 'webhook_logs'
});

// Indexes for performance
WebhookLogSchema.index({ source: 1, status: 1 });
WebhookLogSchema.index({ userId: 1, createdAt: -1 });
WebhookLogSchema.index({ source: 1, userId: 1, createdAt: -1 });
WebhookLogSchema.index({ status: 1, createdAt: -1 });
WebhookLogSchema.index({ topic: 1, createdAt: -1 });
WebhookLogSchema.index({ eventType: 1, createdAt: -1 });

// Static method to log webhook events
WebhookLogSchema.statics.logWebhook = async function(data) {
    try {
        const log = new this(data);
        await log.save();
        console.log(`📝 [WEBHOOK LOG] ${data.source} webhook logged: ${data.status}`);
        return log;
    } catch (error) {
        console.error('❌ [WEBHOOK LOG] Failed to log webhook:', error);
        throw error;
    }
};

// Static method to get webhook statistics
WebhookLogSchema.statics.getStats = async function(filters = {}) {
    const matchStage = {};
    
    if (filters.source) matchStage.source = filters.source;
    if (filters.userId) matchStage.userId = mongoose.Types.ObjectId(filters.userId);
    if (filters.status) matchStage.status = filters.status;
    if (filters.startDate || filters.endDate) {
        matchStage.createdAt = {};
        if (filters.startDate) matchStage.createdAt.$gte = new Date(filters.startDate);
        if (filters.endDate) matchStage.createdAt.$lte = new Date(filters.endDate);
    }
    
    const stats = await this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                lastOccurrence: { $max: '$createdAt' },
                avgResponseTime: { $avg: '$responseTime' }
            }
        }
    ]);
    
    return stats;
};

module.exports = mongoose.model("WebhookLog", WebhookLogSchema);
