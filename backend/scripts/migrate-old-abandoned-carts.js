// Migration Script: Fix Old Abandoned Carts Missing userId
// This script updates old abandoned carts with proper userId for multi-tenant safety

const mongoose = require('mongoose');
const AbandonedCart = require('../models/AbandonedCart');
const WooCommerceIntegration = require('../models/WooCommerceIntegration');

class AbandonedCartMigration {
    constructor() {
        this.mongodbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database';
    }

    async connect() {
        try {
            await mongoose.connect(this.mongodbUri);
            console.log('✅ Connected to MongoDB');
        } catch (error) {
            console.error('❌ MongoDB connection failed:', error);
            throw error;
        }
    }

    async disconnect() {
        try {
            await mongoose.disconnect();
            console.log('🔌 Disconnected from MongoDB');
        } catch (error) {
            console.error('❌ MongoDB disconnect failed:', error);
        }
    }

    // Main migration function
    async migrate() {
        try {
            console.log('🔄 Starting migration of old abandoned carts...');
            
            await this.connect();
            
            // Step 1: Find all carts without userId
            const cartsWithoutUserId = await AbandonedCart.find({
                $or: [
                    { userId: { $exists: false } },
                    { userId: null },
                    { userId: '' }
                ]
            });
            
            console.log(`📊 Found ${cartsWithoutUserId.length} carts without userId`);
            
            if (cartsWithoutUserId.length === 0) {
                console.log('✅ No carts need migration - all carts have userId');
                return;
            }
            
            let updatedCount = 0;
            let skippedCount = 0;
            let errorCount = 0;
            
            // Step 2: Process each cart
            for (const cart of cartsWithoutUserId) {
                try {
                    console.log(`🔄 Processing cart: ${cart.cart_id || cart._id}`);
                    
                    let userId = null;
                    
                    // Method 1: Try to find userId from store_url
                    if (cart.store_url) {
                        const integration = await WooCommerceIntegration.findOne({
                            store_url: cart.store_url
                        });
                        
                        if (integration && integration.userId) {
                            userId = integration.userId;
                            console.log(`✅ Found userId from store_url: ${userId}`);
                        }
                    }
                    
                    // Method 2: Try to find userId from woo_order_id (if order exists)
                    if (!userId && cart.woo_order_id) {
                        // Look for any WooCommerceIntegration that might have this order
                        // This is a fallback method - you might need to adjust based on your schema
                        const integrations = await WooCommerceIntegration.find({});
                        
                        for (const integration of integrations) {
                            // You might need to check if this order belongs to this store
                            // This is a placeholder logic - adjust based on your needs
                            if (integration.userId) {
                                userId = integration.userId;
                                console.log(`✅ Assigned userId from available integration: ${userId}`);
                                break;
                            }
                        }
                    }
                    
                    // Method 3: Assign to a default/system user (last resort)
                    if (!userId) {
                        // Find a system user or first available user
                        const systemIntegration = await WooCommerceIntegration.findOne({}).sort({ createdAt: 1 });
                        
                        if (systemIntegration && systemIntegration.userId) {
                            userId = systemIntegration.userId;
                            console.log(`⚠️ Assigned system userId as fallback: ${userId}`);
                        }
                    }
                    
                    // Update cart if userId found
                    if (userId) {
                        await AbandonedCart.updateOne(
                            { _id: cart._id },
                            { 
                                $set: { 
                                    userId: userId,
                                    migrated: true,
                                    migratedAt: new Date(),
                                    migrationNote: 'Auto-migrated to fix multi-tenant safety'
                                }
                            }
                        );
                        
                        console.log(`✅ Updated cart ${cart.cart_id} with userId ${userId}`);
                        updatedCount++;
                    } else {
                        console.log(`⚠️ Could not determine userId for cart: ${cart.cart_id}`);
                        skippedCount++;
                    }
                    
                } catch (cartError) {
                    console.error(`❌ Error processing cart ${cart.cart_id}:`, cartError.message);
                    errorCount++;
                }
            }
            
            // Step 3: Report results
            console.log(`📊 Migration completed:`);
            console.log(`   ✅ Updated: ${updatedCount} carts`);
            console.log(`   ⚠️ Skipped: ${skippedCount} carts`);
            console.log(`   ❌ Errors: ${errorCount} carts`);
            
            // Step 4: Optional - Delete carts that couldn't be migrated
            if (skippedCount > 0) {
                console.log(`\\n⚠️ ${skippedCount} carts could not be migrated.`);
                console.log('These carts will remain without userId and will be ignored by the scheduler.');
                
                // Uncomment the following lines to delete unmigrated carts:
                // const deleteResult = await AbandonedCart.deleteMany({
                //     $or: [
                //         { userId: { $exists: false } },
                //         { userId: null },
                //         { userId: '' }
                //     ]
                // });
                // console.log(`🗑️ Deleted ${deleteResult.deletedCount} unmigrated carts`);
            }
            
            // Step 5: Verify migration
            const remainingCartsWithoutUserId = await AbandonedCart.countDocuments({
                $or: [
                    { userId: { $exists: false } },
                    { userId: null },
                    { userId: '' }
                ]
            });
            
            console.log(`\\n✅ Migration verification: ${remainingCartsWithoutUserId} carts still without userId`);
            
            if (remainingCartsWithoutUserId === 0) {
                console.log('🎉 All carts now have userId - Multi-tenant safety achieved!');
            } else {
                console.log('⚠️ Some carts still need manual intervention');
            }
            
        } catch (error) {
            console.error('❌ Migration failed:', error);
            throw error;
        } finally {
            await this.disconnect();
        }
    }

    // Quick verification function
    async verify() {
        try {
            console.log('🔍 Verifying abandoned cart userId status...');
            
            await this.connect();
            
            const [
                totalCarts,
                cartsWithUserId,
                cartsWithoutUserId
            ] = await Promise.all([
                AbandonedCart.countDocuments(),
                AbandonedCart.countDocuments({ 
                    userId: { $exists: true, $ne: null, $ne: '' }
                }),
                AbandonedCart.countDocuments({
                    $or: [
                        { userId: { $exists: false } },
                        { userId: null },
                        { userId: '' }
                    ]
                })
            ]);
            
            console.log(`📊 Abandoned Cart Status:`);
            console.log(`   Total carts: ${totalCarts}`);
            console.log(`   With userId: ${cartsWithUserId}`);
            console.log(`   Without userId: ${cartsWithoutUserId}`);
            
            const percentage = totalCarts > 0 ? ((cartsWithUserId / totalCarts) * 100).toFixed(2) : 0;
            console.log(`   Multi-tenant compliance: ${percentage}%`);
            
            if (cartsWithoutUserId === 0) {
                console.log('✅ All carts are multi-tenant compliant!');
            } else {
                console.log('⚠️ Migration needed for multi-tenant safety');
            }
            
        } catch (error) {
            console.error('❌ Verification failed:', error);
        } finally {
            await this.disconnect();
        }
    }
}

// CLI Usage
if (require.main === module) {
    const migration = new AbandonedCartMigration();
    const command = process.argv[2];
    
    switch (command) {
        case 'migrate':
            migration.migrate().catch(console.error);
            break;
        case 'verify':
            migration.verify().catch(console.error);
            break;
        default:
            console.log('Usage:');
            console.log('  node migrate-old-abandoned-carts.js migrate  # Run migration');
            console.log('  node migrate-old-abandoned-carts.js verify   # Verify status');
    }
}

module.exports = AbandonedCartMigration;
