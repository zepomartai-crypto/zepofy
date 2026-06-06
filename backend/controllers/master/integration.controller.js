const WooCommerceIntegration = require("../../models/WooCommerceIntegration");
const WhatsAppIntegration = require("../../models/WhatsAppIntegration");
const ShopifyIntegration = require("../../models/ShopifyIntegration");
const MetaIntegration = require("../../models/MetaIntegration");
const AIIntegration = require("../../models/AIIntegration");
const User = require("../../models/User");

// 🔥 Global Integrations API - Grouped by User
exports.getGlobalIntegrations = async (req, res) => {
    try {
        console.log('🔗 [MASTER] Fetching global integrations grouped by user');

        // Get all users with their integrations
        const users = await User.find({ role: 'user' })
            .select('_id name email status plan integrations')
            .lean();

        const usersWithIntegrations = await Promise.all(users.map(async (user) => {
            const [wooCommerceIntegration, whatsappIntegration, shopifyIntegration, metaIntegration, aiIntegration] = await Promise.all([
                WooCommerceIntegration.findOne({ userId: user._id }).lean(),
                WhatsAppIntegration.findOne({ userId: user._id }).lean(),
                ShopifyIntegration.findOne({ userId: user._id }).lean(),
                MetaIntegration.findOne({ userId: user._id }).lean(),
                AIIntegration.findOne({ userId: user._id }).select('+apiKey').lean()
            ]);

            const isWooCommerceConnected = wooCommerceIntegration?.status === 'connected';
            const isWhatsAppConnected = whatsappIntegration?.status === 'connected';
            const isShopifyConnected = shopifyIntegration?.status === 'connected';
            const isFacebookInstagramConnected = metaIntegration?.isActive === true;
            const isAiBotConnected = !!aiIntegration && !!aiIntegration.apiKey;

            return {
                userId: user._id,
                userName: user.name,
                email: user.email,
                userStatus: user.status,
                plan: user.plan || 'basic',
                // WooCommerce Data
                woocommerce: {
                    connected: isWooCommerceConnected,
                    storeUrl: wooCommerceIntegration?.storeUrl || wooCommerceIntegration?.store_url || null,
                    connectedAt: wooCommerceIntegration?.createdAt || null,
                    status: wooCommerceIntegration?.status || 'disconnected'
                },
                // WhatsApp Data
                whatsapp: {
                    connected: isWhatsAppConnected,
                    phone: whatsappIntegration?.phoneNumberId || null, // Using ID/Phone if available
                    connectedAt: whatsappIntegration?.createdAt || null,
                    status: whatsappIntegration?.status || 'disconnected'
                },
                // Shopify Data
                shopify: {
                    connected: isShopifyConnected,
                    storeUrl: shopifyIntegration?.storeUrl || shopifyIntegration?.store_url || null,
                    connectedAt: shopifyIntegration?.createdAt || null,
                    status: shopifyIntegration?.status || 'disconnected'
                },
                // AI Data
                ai_bot: {
                    connected: isAiBotConnected,
                },
                // Facebook & Instagram Data
                facebook_instagram: {
                    connected: isFacebookInstagramConnected,
                }
            };
        }));

        // Calculate summary statistics
        const totalUsers = usersWithIntegrations.length;
        const usersWithWooCommerce = usersWithIntegrations.filter(u => u.woocommerce.connected).length;
        const usersWithWhatsApp = usersWithIntegrations.filter(u => u.whatsapp.connected).length;
        const usersWithShopify = usersWithIntegrations.filter(u => u.shopify.connected).length;
        const usersWithAiBot = usersWithIntegrations.filter(u => u.ai_bot.connected).length;
        const usersWithFacebookInstagram = usersWithIntegrations.filter(u => u.facebook_instagram.connected).length;
        
        // Count how many integrations each user has
        const countIntegrations = (u) => (u.woocommerce.connected ? 1 : 0) + (u.whatsapp.connected ? 1 : 0) + (u.shopify.connected ? 1 : 0) + (u.ai_bot.connected ? 1 : 0) + (u.facebook_instagram.connected ? 1 : 0);
        
        const usersWithZero = usersWithIntegrations.filter(u => countIntegrations(u) === 0).length;
        const usersWithOne = usersWithIntegrations.filter(u => countIntegrations(u) === 1).length;
        const usersWithBoth = usersWithIntegrations.filter(u => countIntegrations(u) > 1).length;

        // Group by integration count
        const integrationStats = {
            disconnected: usersWithZero,
            single: usersWithOne,
            dual: usersWithBoth, // Using dual for anything > 1 for backward compatibility
            totalWooCommerce: usersWithWooCommerce,
            totalWhatsApp: usersWithWhatsApp,
            totalShopify: usersWithShopify,
            totalAiBot: usersWithAiBot,
            totalFacebookInstagram: usersWithFacebookInstagram
        };

        console.log(`✅ [MASTER] Global integrations fetched: ${totalUsers} users, ${usersWithWooCommerce} WC, ${usersWithWhatsApp} WA`);

        res.json({
            success: true,
            data: {
                summary: {
                    totalUsers,
                    ...integrationStats
                },
                users: usersWithIntegrations
            }
        });

    } catch (err) {
        console.error('❌ [MASTER] Get Global Integrations Error:', err);
        res.status(500).json({ success: false, error: "Failed to fetch global integrations" });
    }
};

// 🔥 Get Integration Statistics
exports.getIntegrationStats = async (req, res) => {
    try {
        console.log('📊 [MASTER] Fetching integration statistics');

        const [
            totalWooCommerceIntegrations,
            activeWooCommerceIntegrations,
            totalWhatsAppIntegrations,
            activeWhatsAppIntegrations,
            totalShopifyIntegrations,
            activeShopifyIntegrations,
            totalUsers,
            activeUsers
        ] = await Promise.all([
            WooCommerceIntegration.countDocuments(),
            WooCommerceIntegration.countDocuments({ status: 'connected' }),
            WhatsAppIntegration.countDocuments(),
            WhatsAppIntegration.countDocuments({ status: 'connected' }),
            ShopifyIntegration.countDocuments(),
            ShopifyIntegration.countDocuments({ status: 'connected' }),
            User.countDocuments({ role: 'user' }),
            User.countDocuments({ role: 'user', status: 'active' })
        ]);

        const stats = {
            wooCommerce: {
                total: totalWooCommerceIntegrations,
                active: activeWooCommerceIntegrations,
                inactive: totalWooCommerceIntegrations - activeWooCommerceIntegrations
            },
            whatsapp: {
                total: totalWhatsAppIntegrations,
                active: activeWhatsAppIntegrations,
                inactive: totalWhatsAppIntegrations - activeWhatsAppIntegrations
            },
            shopify: {
                total: totalShopifyIntegrations,
                active: activeShopifyIntegrations,
                inactive: totalShopifyIntegrations - activeShopifyIntegrations
            },
            users: {
                total: totalUsers,
                active: activeUsers,
                inactive: totalUsers - activeUsers
            }
        };

        console.log('✅ [MASTER] Integration stats fetched:', stats);

        res.json({
            success: true,
            data: stats
        });

    } catch (err) {
        console.error('❌ [MASTER] Get Integration Stats Error:', err);
        res.status(500).json({ success: false, error: "Failed to fetch integration statistics" });
    }
};
