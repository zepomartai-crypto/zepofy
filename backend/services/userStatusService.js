const User = require('../models/User');
const WhatsAppIntegration = require('../models/WhatsAppIntegration');
const ShopifyIntegration = require('../models/ShopifyIntegration');
const WooCommerceIntegration = require('../models/WooCommerceIntegration');
const Settings = require('../models/Settings');

/**
 * Service to manage and sync user global status based on their integrations
 */
class UserStatusService {
    /**
     * Updates the global integration status for a user.
     * If any major integration (WhatsApp, WooCommerce, Shopify) is active,
     * the user's integrationStatus is set to 'ACTIVE'.
     * 
     * @param {string} userId - ID of the user to update
     */
    async updateUserIntegrationStatus(userId) {
        try {
            console.log(`🔄 Syncing integration status for user: ${userId}`);

            // 1. Check WhatsApp
            const whatsapp = await WhatsAppIntegration.findOne({ userId, status: 'connected' });

            // 2. Check Shopify
            const shopify = await ShopifyIntegration.findOne({ userId, status: 'connected' });

            // 3. Check WooCommerce
            const woo = await WooCommerceIntegration.findOne({ userId, status: 'connected' });

            // 4. Check Settings (Backup/Legacy sync)
            const settings = await Settings.findOne({ userId });
            const isWooConnectedInSettings = settings?.woocommerce?.connected || false;
            const isShopifyConnectedInSettings = settings?.shopify?.connected || false;
            const isWhatsappConnectedInSettings = settings?.isWhatsAppConnected || false;

            const isAnyConnected = !!whatsapp || !!shopify || !!woo || isWooConnectedInSettings || isShopifyConnectedInSettings || isWhatsappConnectedInSettings;

            const newStatus = isAnyConnected ? 'ACTIVE' : 'INACTIVE';

            const updatedUser = await User.findByIdAndUpdate(
                userId,
                { integrationStatus: newStatus },
                { new: true }
            );

            console.log(`✅ User ${userId} integration status updated to: ${newStatus}`);
            return updatedUser;
        } catch (error) {
            console.error(`❌ Failed to update user integration status for ${userId}:`, error.message);
            // We don't throw here to avoid crashing the main flow if just status sync fails
            return null;
        }
    }
}

module.exports = new UserStatusService();
