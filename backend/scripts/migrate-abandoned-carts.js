/* ==========================================================================
   MIGRATION SCRIPT: Fix Missing UserIDs in Abandoned Carts
   Run using: node scripts/migrate-abandoned-carts.js
   ========================================================================== */
require('dotenv').config();
const mongoose = require('mongoose');
const WooCommerceIntegration = require('../models/WooCommerceIntegration');
const AbandonedCart = require('../models/AbandonedCart');

const migrate = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Connected to MongoDB");

        // 1. Find all Carts without userId
        const carts = await AbandonedCart.find({ userId: { $exists: false } });
        console.log(`🔍 Found ${carts.length} carts without userId`);

        for (const cart of carts) {
            if (!cart.store_url) {
                console.log(`⚠️ Skipping Cart ${cart.cart_id}: No store_url`);
                continue;
            }

            // Normalize
            const cleanUrl = cart.store_url.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();

            // Find Integration
            const integration = await WooCommerceIntegration.findOne({
                storeUrl: { $regex: new RegExp(`^https?://${cleanUrl}/?$`, 'i') }
            });

            if (integration) {
                cart.userId = integration.userId;
                cart.wooCommerceStoreId = integration._id;
                await cart.save();
                console.log(`✅ Migrated Cart ${cart.cart_id} -> User ${integration.userId}`);
            } else {
                console.log(`❌ No integration found for store: ${cart.store_url}`);
            }
        }

        console.log("🏁 Migration Complete");
        process.exit(0);

    } catch (err) {
        console.error("❌ Migration Error:", err);
        process.exit(1);
    }
};

migrate();
