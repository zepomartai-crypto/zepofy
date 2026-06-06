const mongoose = require("mongoose");
const User = require("../../models/User");
const WooCommerceIntegration = require("../../models/WooCommerceIntegration");
const WhatsAppIntegration = require("../../models/WhatsAppIntegration");
const ShopifyIntegration = require("../../models/ShopifyIntegration");
const Template = require("../../models/Template");
const Campaign = require("../../models/Campaign");
const WooCommerceOrder = require("../../models/WooCommerceOrder");
const SystemLog = require("../../models/SystemLog");

// 🔥 Super Admin Dashboard - Role-based Data Logic
exports.getStats = async (req, res) => {
    try {
        console.log('📊 [MASTER] Dashboard stats requested');
        console.log('👤 [MASTER] User role:', req.user?.role);
        console.log('👤 [MASTER] Full user object:', JSON.stringify(req.user, null, 2));

        // Check if this is a Super Admin request
        const isSuperAdmin = req.user && req.user.role === 'superadmin';

        console.log(`🔍 [MASTER] IsSuperAdmin: ${isSuperAdmin}`);

        if (!isSuperAdmin) {
            console.log('❌ [MASTER] User is not Super Admin, returning error');
            return res.status(403).json({
                success: false,
                error: 'Super Admin access required'
            });
        }

        console.log('🌍 [MASTER] Super Admin confirmed - fetching GLOBAL system-wide data');

        let totalUsers, activeUsers, inactiveUsers, blockedUsers;
        let totalWooCommerce, totalWhatsApp, totalShopify, totalTemplates, totalCampaigns;
        let totalOrders, totalMessages;

        if (isSuperAdmin) {
            console.log('🌍 [MASTER] Fetching GLOBAL system-wide data');

            // Super Admin: Global queries (no userId filter)
            const results = await Promise.all([
                // Users
                User.countDocuments({ role: "user" }),
                User.countDocuments({ role: "user", status: "ACTIVE" }),
                User.countDocuments({ role: "user", status: "INACTIVE" }),
                User.countDocuments({ role: "user", status: "TEMP_BLOCKED" }),
                User.countDocuments({ role: "user", status: "PERMANENT_BLOCKED" }),

                // Integrations
                WooCommerceIntegration.countDocuments({ status: "connected" }),
                WhatsAppIntegration.countDocuments({ status: "connected" }),
                ShopifyIntegration.countDocuments({ status: "connected" }),

                // Templates & Campaigns
                Template.countDocuments(),
                Campaign.countDocuments(),

                // Orders & Messages
                WooCommerceOrder.countDocuments(),
                Campaign.aggregate([
                    { $group: { _id: null, totalMessages: { $sum: "$sentCount" } } }
                ]),

                // System Errors
                SystemLog.countDocuments({
                    level: "ERROR",
                    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                })
            ]);

            [
                totalUsers,
                activeUsers,
                inactiveUsers,
                tempBlockedUsers,
                permanentBlockedUsers,
                totalWooCommerce,
                totalWhatsApp,
                totalShopify,
                totalTemplates,
                totalCampaigns,
                totalOrders,
                totalMessages,
                systemErrors
            ] = results;

            // Extract total messages from aggregation
            totalMessages = totalMessages[0]?.totalMessages || 0;

            console.log('✅ [MASTER] Global query results:', {
                totalUsers,
                activeUsers,
                inactiveUsers,
                tempBlockedUsers,
                permanentBlockedUsers,
                totalWooCommerce,
                totalWhatsApp,
                totalShopify,
                totalTemplates,
                totalCampaigns,
                totalOrders,
                totalMessages,
                systemErrors
            });

        } else {
            console.log('👤 [MASTER] Fetching TENANT-SPECIFIC data for user:', req.user?._id);

            // Normal User: Tenant-specific queries (filter by userId)
            const userId = new mongoose.Types.ObjectId(req.user._id);

            const results = await Promise.all([
                // For normal users, these represent their own stats
                Promise.resolve(1), // User themselves
                Promise.resolve(req.user.status === 'active' ? 1 : 0),
                Promise.resolve(req.user.status === 'inactive' ? 1 : 0),
                Promise.resolve(req.user.status === 'blocked' ? 1 : 0),

                // User's integrations
                WooCommerceIntegration.countDocuments({ userId, status: "connected" }),
                WhatsAppIntegration.countDocuments({ userId, status: "connected" }),
                ShopifyIntegration.countDocuments({ userId, status: "connected" }),

                // User's templates & campaigns
                Template.countDocuments({ userId }),
                Campaign.countDocuments({ userId }),

                // User's orders & messages
                WooCommerceOrder.countDocuments({ userId }),
                Campaign.aggregate([
                    { $match: { userId } },
                    { $group: { _id: null, totalMessages: { $sum: "$sentCount" } } }
                ])
            ]);

            [
                totalUsers, // will be 1
                activeUsers,
                inactiveUsers,
                blockedUsers,
                totalWooCommerce,
                totalWhatsApp,
                totalShopify,
                totalTemplates,
                totalCampaigns,
                totalOrders,
                totalMessages
            ] = results;

            // Extract total messages from aggregation
            totalMessages = totalMessages[0]?.totalMessages || 0;

            // These are not applicable for tenant view but needed for variable definition
            tempBlockedUsers = 0;
            permanentBlockedUsers = 0;
            systemErrors = 0;
        }

        const responseData = {
            totalUsers,
            activeUsers,
            inactiveUsers,
            tempBlockedUsers: tempBlockedUsers || 0,
            permanentBlockedUsers: permanentBlockedUsers || 0,
            totalOrders,
            totalMessages,
            totalTemplates,
            totalCampaigns,
            totalWooCommerce,
            totalWhatsApp,
            totalShopify,
            systemErrors: systemErrors || 0,
            isSuperAdmin // Include role info for frontend
        };

        console.log(`✅ [MASTER] Dashboard stats fetched:`, {
            totalUsers,
            activeUsers,
            totalOrders,
            totalMessages,
            isSuperAdmin
        });

        res.json({
            success: true,
            data: responseData
        });

    } catch (err) {
        console.error("❌ [MASTER] Dashboard Error:", err);
        res.status(500).json({ success: false, error: "Failed to fetch dashboard statistics" });
    }
};
