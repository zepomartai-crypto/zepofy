// Migration Script: Add userId to existing abandoned carts
// This script fixes the multi-tenant issue by linking carts to users via store_url

const mongoose = require('mongoose');
require('dotenv').config();

class AbandonedCartUserIdMigration {
    constructor() {
        this.mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/your-database';
    }

    async connect() {
        try {
            await mongoose.connect(this.mongoUri, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            });
            console.log('✅ Connected to MongoDB');
        } catch (error) {
            console.error('❌ MongoDB connection error:', error);
            process.exit(1);
        }
    }

    async disconnect() {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }

    // Main migration function
    async migrate() {
        try {
            console.log('🔄 Starting abandoned cart userId migration...');

            const AbandonedCart = require('../models/AbandonedCart');
            const WooCommerceIntegration = require('../models/WooCommerceIntegration');

            // Step 1: Find all abandoned carts without userId
            const cartsWithoutUserId = await AbandonedCart.find({ 
                userId: { $exists: false } 
            });

            console.log(`📊 Found ${cartsWithoutUserId.length} carts without userId`);

            if (cartsWithoutUserId.length === 0) {
                console.log('✅ All carts already have userId. Migration complete.');
                return;
            }

            // Step 2: Get all WooCommerce integrations for mapping
            const integrations = await WooCommerceIntegration.find({});
            console.log(`📋 Found ${integrations.length} WooCommerce integrations`);

            // Step 3: Create store_url -> userId mapping
            const storeUserMap = {};
            for (const integration of integrations) {
                if (integration.store_url) {
                    storeUserMap[integration.store_url.toLowerCase()] = integration.userId;
                }
            }

            console.log('🗺️ Store URL to User ID mapping created');

            // Step 4: Update carts without userId
            let updatedCount = 0;
            let failedCount = 0;

            for (const cart of cartsWithoutUserId) {
                try {
                    // Try to find userId from store_url
                    let userId = null;

                    if (cart.store_url) {
                        // Direct match
                        userId = storeUserMap[cart.store_url.toLowerCase()];
                        
                        // If not found, try partial matching (remove http/https, www, trailing slashes)
                        if (!userId) {
                            const normalizedStoreUrl = cart.store_url
                                .replace(/^https?:\/\//, '')
                                .replace(/^www\./, '')
                                .replace(/\/$/, '')
                                .toLowerCase();
                            
                            // Try to find matching integration
                            for (const [storeUrl, mappedUserId] of Object.entries(storeUserMap)) {
                                const normalizedIntegrationUrl = storeUrl
                                    .replace(/^https?:\/\//, '')
                                    .replace(/^www\./, '')
                                    .replace(/\/$/, '')
                                    .toLowerCase();
                                
                                if (normalizedStoreUrl === normalizedIntegrationUrl) {
                                    userId = mappedUserId;
                                    break;
                                }
                            }
                        }
                    }

                    if (userId) {
                        // Update the cart with userId
                        await AbandonedCart.updateOne(
                            { _id: cart._id },
                            { $set: { userId: userId } }
                        );
                        updatedCount++;
                        console.log(`✅ Updated cart ${cart.cart_id} with userId ${userId}`);
                    } else {
                        failedCount++;
                        console.log(`❌ Could not find userId for cart ${cart.cart_id} (store_url: ${cart.store_url})`);
                    }

                } catch (error) {
                    failedCount++;
                    console.error(`❌ Error updating cart ${cart.cart_id}:`, error.message);
                }
            }

            console.log('\n📈 Migration Summary:');
            console.log(`   Total carts without userId: ${cartsWithoutUserId.length}`);
            console.log(`   Successfully updated: ${updatedCount}`);
            console.log(`   Failed to update: ${failedCount}`);

            if (failedCount > 0) {
                console.log('\n⚠️  Some carts could not be updated.');
                console.log('   This might be because:');
                console.log('   - Store URL not found in WooCommerceIntegration');
                console.log('   - Store URL format mismatch');
                console.log('   - Integration missing userId');
            }

        } catch (error) {
            console.error('❌ Migration error:', error);
            throw error;
        }
    }

    // Verify migration results
    async verify() {
        try {
            console.log('🔍 Verifying migration results...');

            const AbandonedCart = require('../models/AbandonedCart');

            const totalCarts = await AbandonedCart.countDocuments();
            const cartsWithUserId = await AbandonedCart.countDocuments({ 
                userId: { $exists: true } 
            });
            const cartsWithoutUserId = await AbandonedCart.countDocuments({ 
                userId: { $exists: false } 
            });

            console.log('\n📊 Verification Results:');
            console.log(`   Total carts: ${totalCarts}`);
            console.log(`   Carts with userId: ${cartsWithUserId}`);
            console.log(`   Carts without userId: ${cartsWithoutUserId}`);

            if (cartsWithoutUserId === 0) {
                console.log('\n✅ Migration successful! All carts now have userId.');
            } else {
                console.log(`\n⚠️  ${cartsWithoutUserId} carts still missing userId.`);
                console.log('   You may need to manually update these or check your WooCommerceIntegration data.');
            }

            // Show sample of carts with userId
            const sampleCarts = await AbandonedCart.find({ 
                userId: { $exists: true } 
            }).limit(3).select('cart_id userId store_url');

            if (sampleCarts.length > 0) {
                console.log('\n📋 Sample carts with userId:');
                sampleCarts.forEach(cart => {
                    console.log(`   Cart: ${cart.cart_id} -> User: ${cart.userId} (Store: ${cart.store_url})`);
                });
            }

        } catch (error) {
            console.error('❌ Verification error:', error);
            throw error;
        }
    }

    // Show carts that still need userId
    async showOrphanedCarts() {
        try {
            console.log('👻 Showing orphaned carts (carts without userId)...');

            const AbandonedCart = require('../models/AbandonedCart');

            const orphanedCarts = await AbandonedCart.find({ 
                userId: { $exists: false } 
            }).select('cart_id store_url created_at');

            console.log(`\n📊 Found ${orphanedCarts.length} orphaned carts:`);

            if (orphanedCarts.length === 0) {
                console.log('   No orphaned carts found! ✅');
            } else {
                orphanedCarts.forEach((cart, index) => {
                    console.log(`   ${index + 1}. Cart: ${cart.cart_id}`);
                    console.log(`      Store: ${cart.store_url || 'Not specified'}`);
                    console.log(`      Created: ${cart.created_at}`);
                    console.log('');
                });
            }

        } catch (error) {
            console.error('❌ Error showing orphaned carts:', error);
            throw error;
        }
    }
}

// CLI Usage
async function main() {
    const migration = new AbandonedCartUserIdMigration();
    const command = process.argv[2];

    try {
        await migration.connect();

        switch (command) {
            case 'migrate':
                await migration.migrate();
                await migration.verify();
                break;
            case 'verify':
                await migration.verify();
                break;
            case 'orphaned':
                await migration.showOrphanedCarts();
                break;
            default:
                console.log('Usage:');
                console.log('  node migrate-abandoned-carts-userId.js migrate   # Run migration and verify');
                console.log('  node migrate-abandoned-carts-userId.js verify    # Verify migration results');
                console.log('  node migrate-abandoned-carts-userId.js orphaned  # Show carts without userId');
                console.log('');
                console.log('Example:');
                console.log('  node migrate-abandoned-carts-userId.js migrate');
                break;
        }

    } catch (error) {
        console.error('❌ Script failed:', error);
        process.exit(1);
    } finally {
        await migration.disconnect();
    }
}

if (require.main === module) {
    main();
}

module.exports = AbandonedCartUserIdMigration;
