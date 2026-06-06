const WebhookLog = require("../../models/WebhookLog");
const mongoose = require('mongoose');

// 🔥 Enhanced Webhook Monitoring API
exports.getWebhookLogs = async (req, res) => {
    try {
        console.log('📡 [MASTER] Fetching webhook logs with filters');

        const {
            userId,
            source,
            status,
            eventType,
            startDate,
            endDate,
            page = 1,
            limit = 50
        } = req.query;

        // Build query with filters
        const query = {};

        if (userId) query.userId = mongoose.Types.ObjectId(userId);
        if (source) query.source = source;
        if (status) query.status = status;
        if (eventType) query.eventType = eventType;

        // Date range filter
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        console.log('🔍 [MASTER] Webhook logs query:', query);

        // Get logs with pagination
        const [logs, total] = await Promise.all([
            WebhookLog.find(query)
                .populate("userId", "name email status")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(parseInt(limit))
                .lean(),
            WebhookLog.countDocuments(query)
        ]);

        // Get statistics for the filtered data
        const stats = await WebhookLog.getStats({
            userId,
            source,
            status,
            startDate,
            endDate
        });

        // Process logs to add payload preview
        // Create payload preview (first 200 characters)
        const processedLogs = logs.map(log => {
            // Create payload preview (first 200 characters)
            let payloadPreview = '';
            if (log.payload) {
                const payloadStr = typeof log.payload === 'string'
                    ? log.payload
                    : JSON.stringify(log.payload);
                payloadPreview = payloadStr.substring(0, 200) + (payloadStr.length > 200 ? '...' : '');
            }

            return {
                ...log,
                payloadPreview
                // Keep raw payload if needed for detail view, or rely on fetchById
            };
        });

        console.log(`✅ [MASTER] Webhook logs fetched: ${logs.length} of ${total}`);

        res.json({
            success: true,
            data: {
                logs: processedLogs,
                statistics: stats,
                filters: {
                    userId,
                    source,
                    status,
                    eventType,
                    startDate,
                    endDate
                }
            },
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });

    } catch (err) {
        console.error('❌ [MASTER] Get Webhook Logs Error:', err);
        res.status(500).json({ success: false, error: "Failed to fetch webhook logs" });
    }
};

// 🔥 Get Single Webhook Log Details
exports.getWebhookLogById = async (req, res) => {
    try {
        const { id } = req.params;

        console.log(`🔍 [MASTER] Fetching webhook log details: ${id}`);

        const log = await WebhookLog.findById(id)
            .populate("userId", "name email status plan")
            .lean();

        if (!log) {
            return res.status(404).json({
                success: false,
                error: 'Webhook log not found'
            });
        }

        console.log(`✅ [MASTER] Webhook log details fetched: ${id}`);

        res.json({
            success: true,
            data: log
        });

    } catch (err) {
        console.error('❌ [MASTER] Get Webhook Log Details Error:', err);
        res.status(500).json({ success: false, error: "Failed to fetch webhook log details" });
    }
};

// 🔥 Get Webhook Statistics Dashboard
exports.getWebhookStats = async (req, res) => {
    try {
        console.log('📊 [MASTER] Fetching webhook statistics dashboard');

        const { startDate, endDate } = req.query;

        // Get overall stats
        const [
            totalLogs,
            successLogs,
            failedLogs,
            pendingLogs,
            sourceStats,
            recentLogs
        ] = await Promise.all([
            WebhookLog.countDocuments(),
            WebhookLog.countDocuments({ status: 'success' }),
            WebhookLog.countDocuments({ status: 'failed' }),
            WebhookLog.countDocuments({ status: 'pending' }),

            // Stats by source
            WebhookLog.aggregate([
                {
                    $group: {
                        _id: '$source',
                        count: { $sum: 1 },
                        success: {
                            $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
                        },
                        failed: {
                            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
                        }
                    }
                }
            ]),

            // Recent failed logs
            WebhookLog.find({ status: 'failed' })
                .populate('userId', 'name email')
                .sort({ createdAt: -1 })
                .limit(10)
                .lean()
        ]);

        const stats = {
            total: totalLogs,
            success: successLogs,
            failed: failedLogs,
            pending: pendingLogs,
            successRate: totalLogs > 0 ? ((successLogs / totalLogs) * 100).toFixed(2) : 0,
            failureRate: totalLogs > 0 ? ((failedLogs / totalLogs) * 100).toFixed(2) : 0
        };

        console.log('✅ [MASTER] Webhook statistics fetched:', stats);

        res.json({
            success: true,
            data: {
                summary: stats,
                bySource: sourceStats,
                recentFailures: recentLogs
            }
        });

    } catch (err) {
        console.error('❌ [MASTER] Get Webhook Stats Error:', err);
        res.status(500).json({ success: false, error: "Failed to fetch webhook statistics" });
    }
};

// 🔥 Clear Webhook Logs (Admin only)
exports.clearWebhookLogs = async (req, res) => {
    try {
        const { source, olderThan } = req.body;

        console.log('🗑️ [MASTER] Clearing webhook logs');

        let query = {};

        if (source) query.source = source;
        if (olderThan) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - parseInt(olderThan));
            query.createdAt = { $lt: cutoffDate };
        }

        const result = await WebhookLog.deleteMany(query);

        console.log(`✅ [MASTER] Cleared ${result.deletedCount} webhook logs`);

        res.json({
            success: true,
            message: `Deleted ${result.deletedCount} webhook logs`,
            deletedCount: result.deletedCount
        });

    } catch (err) {
        console.error('❌ [MASTER] Clear Webhook Logs Error:', err);
        res.status(500).json({ success: false, error: "Failed to clear webhook logs" });
    }
};
