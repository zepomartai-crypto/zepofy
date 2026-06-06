/* ==========================================================================
   CLEAN MIGRATION SCRIPT: PURGE INVALID DATA
   Run using: node scripts/purge-invalid-carts.js
   ========================================================================== */
require('dotenv').config();
const mongoose = require('mongoose');
const AbandonedCart = require('../models/AbandonedCart');

const purge = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Connected to MongoDB");

        console.log("🔥 Starting Data Cleanup...");

        // 1. Delete carts with missing userId
        const res1 = await AbandonedCart.deleteMany({ userId: { $exists: false } });
        console.log(`🗑️  Deleted ${res1.deletedCount} carts missing userId`);

        // 2. Delete carts converted from Plugin that are junk (no store_url, no items)
        const res2 = await AbandonedCart.deleteMany({
            $or: [
                { store_url: { $exists: false } },
                { store_url: "" },
                { store_url: null }
            ]
        });
        console.log(`🗑️  Deleted ${res2.deletedCount} carts missing store_url`);

        // 3. Delete carts that are actually completed/processing orders but marked as abandoned incorrectly
        // (This is harder to detect without checking WC, but we can check if they have payment details and status abandoned)
        // For now, let's stick to the obvious schema violations.

        console.log("🏁 Cleanup Complete. Valid carts remain.");
        process.exit(0);

    } catch (err) {
        console.error("❌ Migration Error:", err);
        process.exit(1);
    }
};

purge();
