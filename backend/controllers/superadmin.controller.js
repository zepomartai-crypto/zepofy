const User = require("../models/User");
const Campaign = require("../models/Campaign");
const Message = require("../models/Message");
const Template = require("../models/Template");
const AdminLog = require("../models/AdminLog");
const WebhookLog = require("../models/WebhookLog");
const SystemLog = require("../models/SystemLog");
const WooCommerceIntegration = require("../models/WooCommerceIntegration");
const WhatsAppIntegration = require("../models/WhatsAppIntegration");
const WooCommerceOrder = require("../models/WooCommerceOrder");
const ShopifyIntegration = require("../models/ShopifyIntegration");
const SystemSettings = require("../models/SystemSettings");
const Plan = require("../models/Plan");
const AIIntegration = require("../models/AIIntegration");
const MetaIntegration = require("../models/MetaIntegration");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

/**
 * 📊 Get Dashboard Metrics
 */
exports.getDashboardMetrics = async (req, res) => {
    try {
        console.log('📊 [SUPERADMIN] Dashboard metrics requested');
        const [
            totalUsers, activeUsers, inactiveUsers, tempBlocked, permanentBlocked,
            totalWoo, totalWa, totalShopify, totalTemplates, totalCampaigns, totalOrders,
            totalMessagesResult, systemErrors
        ] = await Promise.all([
            User.countDocuments({ role: "user" }),
            User.countDocuments({ role: "user", status: "ACTIVE" }),
            User.countDocuments({ role: "user", status: "INACTIVE" }),
            User.countDocuments({ role: "user", status: "TEMP_BLOCKED" }),
            User.countDocuments({ role: "user", status: "PERMANENT_BLOCKED" }),
            WooCommerceIntegration.countDocuments({ status: "connected" }),
            WhatsAppIntegration.countDocuments({ status: "connected" }),
            ShopifyIntegration.countDocuments({ status: "connected" }),
            Template.countDocuments(),
            Campaign.countDocuments(),
            WooCommerceOrder.countDocuments(),
            Campaign.aggregate([{ $group: { _id: null, totalMessages: { $sum: "$sentCount" } } }]),
            SystemLog.countDocuments({ type: 'error', createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } })
        ]);

        res.json({
            success: true,
            data: {
                totalUsers, activeUsers, inactiveUsers, tempBlockedUsers: tempBlocked, permanentBlockedUsers: permanentBlocked,
                totalWooCommerce: totalWoo, totalWhatsApp: totalWa, totalShopify, totalTemplates, totalCampaigns, totalOrders,
                totalMessages: totalMessagesResult[0]?.totalMessages || 0, systemErrors, isSuperAdmin: true
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: "Dashboard failure" });
    }
};

/**
 * 📈 Get Subscription Metrics
 */
exports.getSubscriptionMetrics = async (req, res) => {
    try {
        const now = new Date();
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const [activeAccounts, expiredPlans, expiringSoon] = await Promise.all([
            User.countDocuments({ role: "user", subscriptionStatus: "ACTIVE", accountExpiry: { $gt: now } }),
            User.countDocuments({ role: "user", $or: [{ subscriptionStatus: "EXPIRED" }, { accountExpiry: { $lte: now } }] }),
            User.countDocuments({ role: "user", subscriptionStatus: "ACTIVE", accountExpiry: { $gt: now, $lte: sevenDaysFromNow } })
        ]);

        res.json({
            success: true,
            data: { activeAccounts, expiredPlans, expiringSoon }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: "Subscription metrics failure" });
    }
};

/**
 * 👥 Get All Users
 */
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find({ role: "user" }).select("-password").sort({ createdAt: -1 }).lean();
        const enriched = await Promise.all(users.map(async (u) => {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const [tCount, cCount, contactCount, messageCount, woo, wa, shopify, ai, meta] = await Promise.all([
                Template.countDocuments({ userId: u._id }),
                Campaign.countDocuments({ userId: u._id }),
                require("../models/Contact").countDocuments({ userId: u._id }),
                Message.countDocuments({
                    userId: u._id,
                    direction: 'outgoing',
                    createdAt: { $gte: startOfMonth }
                }),
                WooCommerceIntegration.findOne({ userId: u._id }).lean(),
                WhatsAppIntegration.findOne({ userId: u._id }).lean(),
                ShopifyIntegration.findOne({ userId: u._id }).lean(),
                AIIntegration.findOne({ userId: u._id }).lean(),
                MetaIntegration.findOne({ userId: u._id }).lean()
            ]);

            const daysLeft = u.accountExpiry 
                ? Math.max(0, Math.ceil((new Date(u.accountExpiry) - new Date()) / (1000 * 60 * 60 * 24)))
                : 0;

            // Auto-inactivate and mark as EXPIRED in response if past due
            const isExpired = u.accountExpiry && new Date() > new Date(u.accountExpiry);
            const currentStatus = isExpired 
                ? 'INACTIVE' 
                : (u.status || (u.blocked ? 'PERMANENT_BLOCKED' : 'ACTIVE'));
            
            const currentSubscriptionStatus = isExpired ? 'EXPIRED' : (u.subscriptionStatus || 'ACTIVE');

            return {
                ...u,
                templateCount: tCount,
                campaignCount: cCount,
                contactCount: contactCount,
                messageCount: messageCount,
                hasWooCommerce: woo?.status === 'connected',
                hasWhatsApp: wa?.status === 'connected',
                hasWhatsAppCommerce: wa?.catalogConnected || wa?.commerceSettings?.isActive,
                hasShopify: shopify?.status === 'connected',
                hasAiBot: ai?.status === 'active' || ai?.enabled === true,
                hasFacebookInstagram: meta?.isActive === true || meta?.webhookStatus === 'active',
                daysLeft,
                status: currentStatus,
                subscriptionStatus: currentSubscriptionStatus,
                permissions: u.permissions || {},
                allowedIntegrations: u.allowedIntegrations || {},
                trial: u.trial || {},
                limits: u.limits || {},
                usage: {
                    templatesCreated: tCount,
                    campaignsSent: cCount,
                    contactsCount: contactCount,
                    messagesSent: messageCount
                }
            };
        }));
        console.log(`✅ [SUPERADMIN] Found ${users.length} users, enriched ${enriched.length}`);
        res.json({ success: true, data: enriched });
    } catch (err) {
        console.error("Superadmin getAllUsers error:", err);
        res.status(500).json({ success: false, error: "User fetch failure: " + err.message });
    }
};

/**
 * 👤 Get User By ID
 */
exports.getUserById = async (req, res) => {
    try {
        const u = await User.findById(req.params.id).select("-password").lean();
        if (!u) return res.status(404).json({ success: false, error: "Not found" });

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const [woo, wa, shopify, ai, meta, tCount, cCount, contactCount, messageCount] = await Promise.all([
            WooCommerceIntegration.findOne({ userId: u._id }).lean(),
            WhatsAppIntegration.findOne({ userId: u._id }).lean(),
            ShopifyIntegration.findOne({ userId: u._id }).lean(),
            AIIntegration.findOne({ userId: u._id }).lean(),
            MetaIntegration.findOne({ userId: u._id }).lean(),
            Template.countDocuments({ userId: u._id }),
            Campaign.countDocuments({ userId: u._id }),
            require("../models/Contact").countDocuments({ userId: u._id }),
            Message.countDocuments({
                userId: u._id,
                direction: 'outgoing',
                createdAt: { $gte: startOfMonth }
            }),
        ]);

        res.json({
            success: true,
            data: {
                ...u,
                hasWooCommerce: woo?.status === 'connected',
                hasWhatsApp: wa?.status === 'connected',
                hasWhatsAppCommerce: wa?.catalogConnected || wa?.commerceSettings?.isActive,
                hasShopify: shopify?.status === 'connected',
                hasAiBot: ai?.status === 'active' || ai?.enabled === true,
                hasFacebookInstagram: meta?.isActive === true || meta?.webhookStatus === 'active',
                wooCommerceDetails: woo,
                whatsappDetails: wa,
                shopifyDetails: shopify,
                aiDetails: ai,
                metaDetails: meta,
                usage: {
                    templatesCreated: tCount,
                    campaignsSent: cCount,
                    contactsCount: contactCount,
                    messagesSent: messageCount
                }
            }
        });
    } catch (err) {
        console.error("Superadmin getUserById error:", err);
        res.status(500).json({ success: false, error: "Detail fetch failure" });
    }
};

/**
 * 🔗 Get Integrations
 */
exports.getAllIntegrations = async (req, res) => {
    try {
        const users = await User.find({ role: 'user' }).select('_id name email status plan integrations').lean();
        let stats = { totalUsers: users.length, totalWooCommerce: 0, totalWhatsApp: 0, totalShopify: 0, totalAiBot: 0, totalFbInsta: 0, dual: 0, single: 0, disconnected: 0 };
        const usersWithInt = await Promise.all(users.map(async (user) => {
            const [woo, wa, shopify, ai, meta] = await Promise.all([
                WooCommerceIntegration.findOne({ userId: user._id }).lean(),
                WhatsAppIntegration.findOne({ userId: user._id }).lean(),
                ShopifyIntegration.findOne({ userId: user._id }).lean(),
                AIIntegration.findOne({ userId: user._id }).lean(),
                MetaIntegration.findOne({ userId: user._id }).lean()
            ]);
            const hasWoo = woo?.status === 'connected';
            const hasWa = wa?.status === 'connected';
            const hasWaComm = wa?.catalogConnected || wa?.commerceSettings?.isActive;
            const hasShopify = shopify?.status === 'connected';
            const hasAiBot = ai?.status === 'active' || ai?.enabled === true;
            const hasFbInsta = meta?.isActive === true || meta?.webhookStatus === 'active';

            if (hasWoo) stats.totalWooCommerce++;
            if (hasWa) stats.totalWhatsApp++;
            if (hasShopify) stats.totalShopify++;
            if (hasAiBot) stats.totalAiBot++;
            if (hasFbInsta) stats.totalFbInsta++;

            let connectedCount = (hasWoo ? 1 : 0) + (hasWa ? 1 : 0) + (hasShopify ? 1 : 0) + (hasAiBot ? 1 : 0) + (hasFbInsta ? 1 : 0);
            if (connectedCount >= 2) stats.dual++;
            else if (connectedCount === 1) stats.single++;
            else stats.disconnected++;

            return {
                userId: user._id,
                userName: user.name,
                email: user.email,
                userStatus: user.status,
                plan: user.plan || 'basic',
                integrations_config: user.integrations || {},
                woocommerce: { connected: hasWoo, status: woo?.status || 'disconnected' },
                whatsapp: { connected: hasWa, status: wa?.status || 'disconnected' },
                whatsappCommerce: { connected: hasWaComm, status: hasWaComm ? 'connected' : 'disconnected' },
                shopify: { connected: hasShopify, status: shopify?.status || 'disconnected' },
                aiBot: { connected: hasAiBot, status: ai?.status || (ai?.enabled ? 'active' : 'disconnected') },
                facebookInstagram: { connected: hasFbInsta, status: meta?.isActive ? 'active' : 'disconnected' }
            };
        }));
        res.json({ success: true, data: { users: usersWithInt, summary: stats } });
    } catch (err) {
        console.error("Superadmin getAllIntegrations error:", err);
        res.status(500).json({ success: false, error: "Integration fail" });
    }
};

/**
 * 📡 Get Webhooks
 */
exports.getWebhookLogs = async (req, res) => {
    try {
        const { page = 1, limit = 50, status, source } = req.query;
        const query = {};
        if (status) query.status = status;
        if (source) query.source = source;
        const [logs, total] = await Promise.all([
            WebhookLog.find(query).populate("userId", "name email").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit)).lean(),
            WebhookLog.countDocuments(query)
        ]);
        res.json({ success: true, data: { logs, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) } } });
    } catch (err) {
        res.status(500).json({ success: false, error: "Webhook fail" });
    }
};

/**
 * 📜 Get System Logs
 */
exports.getSystemLogs = async (req, res) => {
    try {
        const { page = 1, limit = 50, type } = req.query;
        const query = type ? { type } : {};
        const [logs, total] = await Promise.all([
            SystemLog.find(query).populate("userId", "name email").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit)).lean(),
            SystemLog.countDocuments(query)
        ]);
        res.json({ success: true, data: { logs, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) } } });
    } catch (err) {
        res.status(500).json({ success: false, error: "System log fail" });
    }
};

/**
 * 📈 Growth Metrics
 */
exports.getGrowthMetrics = async (req, res) => {
    try {
        let range = parseInt(req.query.range) || 7;
        const startDate = new Date(); startDate.setDate(startDate.getDate() - range); startDate.setHours(0, 0, 0, 0);
        const labels = []; for (let i = 0; i <= range; i++) { const d = new Date(startDate); d.setDate(startDate.getDate() + i); labels.push(d.toISOString().split('T')[0]); }
        const getDailyCount = async (model, filter = {}) => {
            const results = await model.aggregate([{ $match: { createdAt: { $gte: startDate }, ...filter } }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } }]);
            const map = results.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {});
            return labels.map(label => map[label] || 0);
        };
        const [dU, dM, dC] = await Promise.all([getDailyCount(User, { role: 'user' }), getDailyCount(Message, { direction: 'outgoing' }), getDailyCount(Campaign)]);
        res.json({ success: true, data: { labels, users: dU, messages: dM, campaigns: dC } });
    } catch (err) {
        res.status(500).json({ success: false, error: "Growth fail" });
    }
};

/**
 * Security & Management
 */
exports.blockUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { blocked, blockReason, blockType = 'PERMANENT', blockDuration = 24 } = req.body;

        const updateData = {
            isBlocked: !!blocked,
            blocked: !!blocked,
            blockReason: blocked ? (blockReason || 'Blocked by Super Admin') : null,
            forceLogout: !!blocked,
            forceLogoutAt: blocked ? new Date() : null,
            status: blocked ? (blockType === 'TEMPORARY' ? 'TEMP_BLOCKED' : 'PERMANENT_BLOCKED') : 'ACTIVE'
        };

        if (blocked && blockType === 'TEMPORARY') {
            const until = new Date();
            until.setHours(until.getHours() + parseInt(blockDuration));
            updateData.blockUntil = until;
            updateData.blockType = 'TEMPORARY';
        } else if (blocked) {
            updateData.blockUntil = null;
            updateData.blockType = 'PERMANENT';
        } else {
            updateData.blockUntil = null;
            updateData.blockType = null;
            updateData.isBlocked = false;
            updateData.blocked = false;
            updateData.forceLogout = false;
        }

        const u = await User.findByIdAndUpdate(id, updateData, { new: true });
        await AdminLog.create({
            adminId: req.userId,
            action: blocked ? 'BLOCK_USER' : 'UNBLOCK_USER',
            targetUserId: id,
            details: `${blocked ? 'Blocked' : 'Unblocked'}. Type: ${blockType}. Reason: ${updateData.blockReason}`,
            ip: req.ip
        });
        res.json({ success: true, data: u });
    } catch (err) {
        console.error("Block User Error:", err);
        res.status(500).json({ success: false, error: "Block fail" });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { id } = req.params; const { password } = req.body;
        const newPwd = password || Math.random().toString(36).slice(-10);
        const salt = await bcrypt.genSalt(10); const hashedPassword = await bcrypt.hash(newPwd, salt);
        await User.findByIdAndUpdate(id, { password: hashedPassword, forceLogout: true });
        await AdminLog.create({ adminId: req.userId, action: 'RESET_PASSWORD', targetUserId: id, details: 'Manual reset' });
        res.json({ success: true, data: { newPassword: newPwd } });
    } catch (err) { res.status(500).json({ success: false, error: "Reset fail" }); }
};

// Helper: Normalize Phone (E.164 without +)
const normalizePhone = (phone) => {
    if (!phone) return null;
    let clean = phone.toString().replace(/\D/g, '');
    // Auto-append 91 if 10 digits (Default to India)
    if (clean.length === 10) {
        clean = '91' + clean;
    }
    return clean;
};

exports.createUser = async (req, res) => {
    try {
        const { email, phoneNumber: rawPhone } = req.body;
        const phoneNumber = normalizePhone(rawPhone);
        
        // Check for existing user
        const existing = await User.findOne({ 
            $or: [
                { email }, 
                { phoneNumber: phoneNumber }
            ] 
        });

        if (existing) {
            return res.status(400).json({ 
                success: false, 
                error: existing.email === email ? "Email already registered" : "Phone number already registered with another account" 
            });
        }

        const salt = await bcrypt.genSalt(10); 
        const hashedPassword = await bcrypt.hash(req.body.password, salt);
        const u = await User.create({ 
            ...req.body, 
            phoneNumber, 
            password: hashedPassword, 
            role: 'user', 
            status: 'ACTIVE' 
        });
        res.status(201).json({ success: true, data: u });
    } catch (err) { 
        console.error("Create User Error:", err);
        res.status(500).json({ success: false, error: err.message || "Create fail" }); 
    }
};

exports.updateUserStatus = async (req, res) => {
    try { const u = await User.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true }); res.json({ success: true, data: u }); }
    catch (err) { res.status(500).json({ success: false, error: "Status update fail" }); }
};

exports.updateUserPlan = async (req, res) => {
    try {
        const { id } = req.params;
        const { plan, expiryDate, paymentMethod, paymentId, paymentProof } = req.body;

        const dbPlan = await Plan.findOne({ name: plan });
        const limits = dbPlan ? dbPlan.limits : {
            templateLimit: 10,
            campaignLimit: 5,
            contactLimit: 100,
            messageLimit: 1000,
            apiLimit: 100
        };

        const updateData = {
            plan,
            limits,
            subscriptionStartDate: new Date(),
            accountExpiry: expiryDate ? new Date(expiryDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            subscriptionStatus: "ACTIVE",
            paymentMethod: paymentMethod || 'MANUAL',
            paymentId: paymentId || '',
            paymentProof: req.file ? req.file.path : (paymentProof || null)
        };

        const u = await User.findByIdAndUpdate(id, updateData, { new: true });

        await AdminLog.create({
            adminId: req.userId,
            action: 'UPDATE_PLAN',
            targetUserId: id,
            details: `Plan assigned: ${plan}. Method: ${paymentMethod}. ID: ${paymentId}. Proof: ${paymentProof}`,
            ip: req.ip
        });

        res.json({ success: true, data: u });
    } catch (err) {
        res.status(500).json({ success: false, error: "Plan update fail" });
    }
};

exports.bulkUpdateUserPlan = async (req, res) => {
    try {
        const { userIds, plan, expiryDate } = req.body;
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ success: false, error: "No users selected" });
        }

        const dbPlan = await Plan.findOne({ name: plan });
        const limits = dbPlan ? dbPlan.limits : {
            templateLimit: 10,
            campaignLimit: 5,
            contactLimit: 100,
            messageLimit: 1000,
            apiLimit: 100
        };

        const updateData = {
            plan,
            limits,
            subscriptionStartDate: new Date(),
            accountExpiry: expiryDate ? new Date(expiryDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            subscriptionStatus: "ACTIVE",
            paymentMethod: 'BULK_MANUAL',
            paymentId: 'BULK_' + Date.now()
        };

        await User.updateMany(
            { _id: { $in: userIds } },
            { $set: updateData }
        );

        await AdminLog.create({
            adminId: req.userId,
            action: 'BULK_UPDATE_PLAN',
            details: `Bulk plan assigned: ${plan} to ${userIds.length} users.`,
            ip: req.ip
        });

        res.json({ success: true, message: `Successfully updated ${userIds.length} users` });
    } catch (err) {
        console.error("Bulk Plan Update Error:", err);
        res.status(500).json({ success: false, error: "Bulk plan update fail" });
    }
};

exports.updateUserPermissions = async (req, res) => {
    try {
        const { id } = req.params;
        const { permissions } = req.body;

        const u = await User.findByIdAndUpdate(id, { permissions }, { new: true });

        await AdminLog.create({
            adminId: req.userId,
            action: 'UPDATE_PERMISSIONS',
            targetUserId: id,
            details: `Updated permissions for ${u.email}`,
            ip: req.ip
        });

        res.json({ success: true, data: u });
    } catch (err) {
        res.status(500).json({ success: false, error: "Permissions update fail" });
    }
};

/**
 * 🔗 Update Allowed Integrations & Access
 */
exports.updateAllowedIntegrations = async (req, res) => {
    try {
        const { id } = req.params;
        const { allowedIntegrations, integrations } = req.body;

        const updateData = {};
        if (allowedIntegrations) updateData.allowedIntegrations = allowedIntegrations;
        if (integrations) updateData.integrations = integrations;

        const u = await User.findByIdAndUpdate(id, { $set: updateData }, { new: true });

        await AdminLog.create({
            adminId: req.userId,
            action: 'UPDATE_INTEGRATIONS_CONFIG',
            targetUserId: id,
            details: `Updated integrations config and expiry for ${u.email}`,
            ip: req.ip
        });

        res.json({ success: true, data: u });
    } catch (err) {
        res.status(500).json({ success: false, error: "Integrations update fail" });
    }
};

/**
 * ⏳ Update Trial Status
 */
exports.updateUserTrial = async (req, res) => {
    try {
        const { id } = req.params;
        const { trial } = req.body;

        const u = await User.findByIdAndUpdate(id, { trial }, { new: true });

        await AdminLog.create({
            adminId: req.userId,
            action: 'UPDATE_TRIAL',
            targetUserId: id,
            details: `Updated trial status for ${u.email}`,
            ip: req.ip
        });

        res.json({ success: true, data: u });
    } catch (err) {
        res.status(500).json({ success: false, error: "Trial update fail" });
    }
};

/**
 * 📊 Update Usage Limits Manually
 */
exports.updateUsageLimits = async (req, res) => {
    try {
        const { id } = req.params;
        const { limits } = req.body;

        const u = await User.findByIdAndUpdate(id, { limits }, { new: true });

        await AdminLog.create({
            adminId: req.userId,
            action: 'UPDATE_USAGE_LIMITS',
            targetUserId: id,
            details: `Updated usage limits for ${u.email}`,
            ip: req.ip
        });

        res.json({ success: true, data: u });
    } catch (err) {
        res.status(500).json({ success: false, error: "Limits update fail" });
    }
};

exports.impersonateUser = async (req, res) => {
    try {
        const u = await User.findById(req.params.id).lean();
        const token = jwt.sign({ userId: u._id, role: u.role, email: u.email }, process.env.JWT_SECRET, { expiresIn: "1h" });
        res.json({ success: true, token, user: u });
    } catch (err) { res.status(500).json({ success: false, error: "Impersonation fail" }); }
};

exports.deleteUser = async (req, res) => {
    try { await User.findByIdAndDelete(req.params.id); res.json({ success: true }); }
    catch (err) { res.status(500).json({ success: false, error: "Delete fail" }); }
};

exports.updateProfile = async (req, res) => {
    try {
        const { name, email, password } = req.body; const update = { name, email };
        if (password) { const salt = await bcrypt.genSalt(10); update.password = await bcrypt.hash(password, salt); }
        const u = await User.findByIdAndUpdate(req.userId, update, { new: true }).select("-password");
        res.json({ success: true, data: u });
    } catch (err) { res.status(500).json({ success: false, error: "Profile fail" }); }
};

exports.getMaintenanceMode = async (req, res) => {
    try {
        const s = await SystemSettings.findOne({ key: 'maintenance' });
        res.json({ success: true, data: s ? s.value : { enabled: false, message: "" } });
    } catch (err) { res.status(500).json({ success: false, error: "Maintenance fetch fail" }); }
};

exports.updateMaintenanceMode = async (req, res) => {
    try {
        const { enabled, message } = req.body;
        const s = await SystemSettings.findOneAndUpdate({ key: 'maintenance' }, { value: { enabled, message }, updatedBy: req.userId }, { upsert: true, new: true });
        res.json({ success: true, data: s.value });
    } catch (err) { res.status(500).json({ success: false, error: "Maintenance update fail" }); }
};

/**
 * 📦 Plan Management
 */
exports.getAllPlans = async (req, res) => {
    try {
        const plans = await Plan.find().sort({ price: 1 });
        res.json({ success: true, data: plans });
    } catch (err) { res.status(500).json({ success: false, error: "Plan fetch failure" }); }
};

exports.updatePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const u = await Plan.findByIdAndUpdate(id, req.body, { new: true });
        res.json({ success: true, data: u });
    } catch (err) { res.status(500).json({ success: false, error: "Plan update failure" }); }
};

exports.createPlan = async (req, res) => {
    try {
        const u = await Plan.create(req.body);
        res.status(201).json({ success: true, data: u });
    } catch (err) { res.status(500).json({ success: false, error: "Plan create failure" }); }
};

exports.deletePlan = async (req, res) => {
    try {
        await Plan.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Plan deleted successfully" });
    } catch (err) {
        res.status(500).json({ success: false, error: "Plan delete failure" });
    }
};
