const Template = require("../models/Template");
const Contact = require("../models/Contact");
const Campaign = require("../models/Campaign");
const Message = require("../models/Message");
const SystemLog = require("../models/SystemLog");
const User = require("../models/User");

/**
 * 🛡️ LOG ONLY LIMIT CHECKER (ISSUE 2 & 3 FIX)
 * This middleware now attaches limit info but DOES NOT block the request.
 * This allows the system to continue in Fallback Mode (Local messages).
 */
exports.checkLimits = (resourceType) => {
    return async (req, res, next) => {
        try {
            let user = req.user;
            if (!user) {
                const userId = req.userId || req.headers['x-user-id'];
                if (userId) user = await User.findById(userId).lean();
            }

            if (!user) return next();

            // Super Admin can bypass
            if (user.role === 'superadmin' || user.role === 'SUPER_ADMIN') return next();

            const limits = user.limits || {};
            let limitReached = false;
            let reason = "";

            // 0. Trial Expiry Check
            if (user.trial && user.trial.isActive) {
                if (new Date() > new Date(user.trial.endDate)) {
                    limitReached = true;
                    reason = "Trial period expired";
                }
            }

            // 1. Template Limit Check
            if (!limitReached && resourceType === 'template') {
                const count = await Template.countDocuments({ userId: user._id });
                if (count >= (limits.templateLimit || 10)) {
                    limitReached = true;
                    reason = "Template limit reached";
                }
            }

            // 2. Monthly Message Limit Check
            if (!limitReached && resourceType === 'message') {
                const startOfMonth = new Date();
                startOfMonth.setDate(1);
                startOfMonth.setHours(0, 0, 0, 0);

                const count = await Message.countDocuments({
                    userId: user._id,
                    direction: 'outgoing',
                    createdAt: { $gte: startOfMonth }
                });

                if (count >= (limits.messageLimit || 1000)) {
                    limitReached = true;
                    reason = "Monthly message limit reached";
                }
            }

            req.limitReached = limitReached;
            req.limitReason = reason;

            if (limitReached) {
                console.log(`⚠️ Limit Check: ${reason} for ${user.email}. System fallback will be used.`);
                await exports.logLimitExceeded(user, resourceType, reason);
            }

            next();
        } catch (error) {
            console.error("Limit Check Middleware Error:", error);
            next();
        }
    };
};

/**
 * 🛡️ NON-BLOCKING INTEGRATION ACCESS
 */
exports.checkIntegrationAccess = (integrationName) => {
    return async (req, res, next) => {
        try {
            let user = req.user;
            if (!user) {
                const userId = req.userId || req.headers['x-user-id'];
                if (userId) user = await User.findById(userId).lean();
            }

            if (!user) return next();
            if (user.role === 'superadmin') return next();

            const WhatsAppIntegration = require("../models/WhatsAppIntegration");
            const integration = await WhatsAppIntegration.findOne({ userId: user._id });

            if (!integration || integration.status !== 'connected') {
                req.whatsappInactive = true;
                console.log(`⚠️ WhatsApp inactive for ${user.email}. Fallback mode active.`);
            }

            next();
        } catch (error) {
            next();
        }
    };
};

exports.logLimitExceeded = async (user, action, reason) => {
    try {
        await SystemLog.create({
            userId: user._id,
            userEmail: user.email,
            level: 'WARNING',
            category: 'LIMIT_EXCEEDED',
            action,
            message: `${reason} - Using system fallbacks.`,
        });
    } catch (err) { }
};

/**
 * 🛠️ DEPRECATED BLOCKING HELPERS (Simplified to Always Allow)
 * Logic is now handled gracefully inside dispatchers via Fallback mechanism.
 */
exports.canSendMessage = async () => true;
exports.hasIntegrationAccess = async () => true;
exports.checkPermission = () => (req, res, next) => next();
