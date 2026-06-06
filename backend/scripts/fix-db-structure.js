/* ==========================================================================
   FIX DB INDEX SCRIPT: DROP OLD INDEX AND RENAME FIELD
   Run using: node scripts/fix-db-structure.js
   ========================================================================== */
require('dotenv').config();
const mongoose = require('mongoose');

const fix = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Connected to MongoDB");

        const collection = mongoose.connection.collection('woocommerceintegrations');

        // 1. Drop the problematic unique index
        try {
            await collection.dropIndex('store_url_1');
            console.log("✅ Dropped index: store_url_1");
        } catch (e) {
            console.log("ℹ️ Index store_url_1 not found or already dropped:", e.message);
        }

        // 2. Rename store_url -> storeUrl for consistency with new Schema
        console.log("🔄 Renaming store_url to storeUrl in existing documents...");
        const result = await collection.updateMany(
            { store_url: { $exists: true } },
            { $rename: { "store_url": "storeUrl" } }
        );
        console.log(`✅ Renamed field in ${result.modifiedCount} documents.`);

        // 3. Ensure new index creation handled by Mongoose on restart
        console.log("🏁 Database structure fixed. Please restart the application.");
        process.exit(0);

    } catch (err) {
        console.error("❌ Migration Error:", err);
        process.exit(1);
    }
};

fix();
