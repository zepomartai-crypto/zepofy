const SystemLog = require('../models/SystemLog');
const WebhookLog = require('../models/WebhookLog');

/**
 * 🔥 Centralized Logging Service
 * Handles all system events, webhook logs, and audit trails
 */
class LogService {
    
    /**
     * Log system events
     */
    static async logEvent(data) {
        try {
            const {
                type,
                userId,
                message,
                severity = 'info',
                metadata = {},
                ip,
                userAgent
            } = data;

            const logEntry = {
                type,
                userId,
                message,
                severity,
                metadata,
                ip,
                userAgent,
                timestamp: new Date()
            };

            const log = await SystemLog.create(logEntry);
            
            console.log(`📝 [LOG] ${severity.toUpperCase()}: ${type} - ${message}`);
            
            return log;
        } catch (error) {
            console.error('❌ [LOG] Failed to log event:', error);
            throw error;
        }
    }

    /**
     * Log user authentication events
     */
    static async logAuth(data) {
        const { userId, email, action, success, ip, userAgent } = data;
        
        await this.logEvent({
            type: 'auth',
            userId,
            message: `User ${action}: ${email} - ${success ? 'SUCCESS' : 'FAILED'}`,
            severity: success ? 'info' : 'warning',
            metadata: { email, action, success },
            ip,
            userAgent
        });
    }

    /**
     * Log user management events
     */
    static async logUserManagement(data) {
        const { userId, targetUserId, action, details, performedBy } = data;
        
        await this.logEvent({
            type: 'user_management',
            userId: performedBy || userId,
            message: `User ${action}: ${targetUserId} - ${details}`,
            severity: action === 'blocked' ? 'warning' : 'info',
            metadata: { targetUserId, action, details, performedBy }
        });
    }

    /**
     * Log integration events
     */
    static async logIntegration(data) {
        const { userId, integrationType, action, status, details } = data;
        
        await this.logEvent({
            type: 'integration',
            userId,
            message: `${integrationType} integration ${action}: ${status}`,
            severity: status === 'connected' ? 'info' : 'warning',
            metadata: { integrationType, action, status, details }
        });
    }

    /**
     * Log webhook events
     */
    static async logWebhook(data) {
        try {
            const {
                source,
                userId,
                status,
                topic,
                payload,
                headers,
                error,
                responseTime,
                ip
            } = data;

            // Create payload preview
            let payloadPreview = '';
            if (payload) {
                const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
                payloadPreview = payloadStr.substring(0, 500) + (payloadStr.length > 500 ? '...' : '');
            }

            const webhookLog = {
                source,
                userId,
                status,
                topic,
                payload,
                payloadPreview,
                headers,
                error: error?.message || error,
                responseTime,
                ip,
                timestamp: new Date()
            };

            const log = await WebhookLog.create(webhookLog);
            
            console.log(`📡 [WEBHOOK] ${source} ${status}: ${topic || 'N/A'}`);
            
            // Also log to system logs for important events
            if (status === 'failed') {
                await this.logEvent({
                    type: 'webhook_error',
                    userId,
                    message: `Webhook failed: ${source} - ${topic}`,
                    severity: 'error',
                    metadata: { source, topic, error: error?.message }
                });
            }
            
            return log;
        } catch (error) {
            console.error('❌ [LOG] Failed to log webhook:', error);
            throw error;
        }
    }

    /**
     * Log template sending events
     */
    static async logTemplate(data) {
        const { userId, templateName, recipient, status, messageId, error } = data;
        
        await this.logEvent({
            type: 'template_send',
            userId,
            message: `Template "${templateName}" ${status}: ${recipient}`,
            severity: status === 'sent' ? 'info' : 'error',
            metadata: { templateName, recipient, status, messageId, error: error?.message }
        });
    }

    /**
     * Log API access events
     */
    static async logApiAccess(data) {
        const { userId, method, endpoint, statusCode, responseTime, ip } = data;
        
        // Only log important API events (errors, admin access, etc.)
        const shouldLog = statusCode >= 400 || 
                         endpoint.includes('/admin') || 
                         endpoint.includes('/master') ||
                         responseTime > 5000; // Slow requests

        if (shouldLog) {
            await this.logEvent({
                type: 'api_access',
                userId,
                message: `API ${method} ${endpoint} - ${statusCode}`,
                severity: statusCode >= 400 ? 'warning' : 'info',
                metadata: { method, endpoint, statusCode, responseTime },
                ip
            });
        }
    }

    /**
     * Get system statistics
     */
    static async getSystemStats(filters = {}) {
        try {
            const { startDate, endDate, userId, type } = filters;
            
            const matchStage = {};
            if (startDate || endDate) {
                matchStage.timestamp = {};
                if (startDate) matchStage.timestamp.$gte = new Date(startDate);
                if (endDate) matchStage.timestamp.$lte = new Date(endDate);
            }
            if (userId) matchStage.userId = userId;
            if (type) matchStage.type = type;

            const stats = await SystemLog.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: '$severity',
                        count: { $sum: 1 },
                        lastOccurrence: { $max: '$timestamp' }
                    }
                }
            ]);

            return stats;
        } catch (error) {
            console.error('❌ [LOG] Failed to get system stats:', error);
            throw error;
        }
    }

    /**
     * Get recent system logs
     */
    static async getRecentLogs(filters = {}) {
        try {
            const { limit = 100, type, severity, userId } = filters;
            
            const query = {};
            if (type) query.type = type;
            if (severity) query.severity = severity;
            if (userId) query.userId = userId;

            const logs = await SystemLog.find(query)
                .populate('userId', 'name email')
                .sort({ timestamp: -1 })
                .limit(limit)
                .lean();

            return logs;
        } catch (error) {
            console.error('❌ [LOG] Failed to get recent logs:', error);
            throw error;
        }
    }

    /**
     * Clean old logs (maintenance)
     */
    static async cleanOldLogs(daysToKeep = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            const [systemLogsResult, webhookLogsResult] = await Promise.all([
                SystemLog.deleteMany({ timestamp: { $lt: cutoffDate } }),
                WebhookLog.deleteMany({ createdAt: { $lt: cutoffDate } })
            ]);

            console.log(`🧹 [LOG] Cleaned old logs: ${systemLogsResult.deletedCount} system, ${webhookLogsResult.deletedCount} webhook`);
            
            return {
                systemLogsDeleted: systemLogsResult.deletedCount,
                webhookLogsDeleted: webhookLogsResult.deletedCount
            };
        } catch (error) {
            console.error('❌ [LOG] Failed to clean old logs:', error);
            throw error;
        }
    }
}

module.exports = LogService;
