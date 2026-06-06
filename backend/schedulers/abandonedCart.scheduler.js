const AbandonedCart = require('../models/AbandonedCart');
const { sendAbandonedCartTemplate } = require('../services/abandonedCartService');

class AbandonedCartScheduler {
    constructor() {
        this.isRunning = false;
        this.isProcessing = false; // ✅ Execution lock
        this.interval = null;
        this.CHECK_INTERVAL = 10 * 60 * 1000; // ✅ Run every 10 minutes
        this.TEMPLATE_DELAY_MINUTES = 5; // Send template 5 minutes after abandonment
    }

    start() {
        if (this.isRunning) {
            console.warn('⚠️ Abandoned Cart Scheduler already running');
            return;
        }

        this.isRunning = true;
        console.log('🚀 Abandoned Cart Scheduler started');

        // Initial run
        this.checkAbandonedCarts();

        // Periodic run
        this.interval = setInterval(() => {
            this.checkAbandonedCarts();
        }, this.CHECK_INTERVAL);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            this.isRunning = false;
            console.log('🛑 Abandoned Cart Scheduler stopped');
        }
    }

    async checkAbandonedCarts() {
        if (!this.isRunning || this.isProcessing) {
            if (this.isProcessing) console.log('⏳ Scheduler already in progress, skipping this sweep');
            return;
        }

        this.isProcessing = true; // Lock

        try {
            console.log('🕐 Running Abandoned Cart Scheduler...');

            // PRODUCTION: Find carts that meet criteria for sending template
            const now = new Date();
            const delayMs = this.TEMPLATE_DELAY_MINUTES * 60 * 1000;
            const delayTime = new Date(now.getTime() - delayMs);

            // BUG FIX 2: Query for carts that:
            // 1. Status === "abandoned" (not pending)
            // 2. WhatsApp NOT yet sent
            // 3. Were abandoned before delay threshold
            // 4. STRICT: Must have userId (multi-tenant safe)
            const cartsToProcess = await AbandonedCart.find({
                userId: { $exists: true },
                status: 'abandoned',
                whatsapp_sent: false,
                abandoned_at: { $lte: delayTime }
            }).lean();

            console.log(`📊 Found ${cartsToProcess.length} abandoned carts eligible for WhatsApp template`);

            if (cartsToProcess.length === 0) {
                console.log('✅ No carts to process at this time');
                return;
            }

            // PRODUCTION: Process each cart
            let successCount = 0;
            let failCount = 0;

            for (const cart of cartsToProcess) {
                try {
                    // Double-check cart hasn't been updated since query
                    const currentCart = await AbandonedCart.findById(cart._id);

                    // Skip if already sent or recovered
                    if (currentCart.whatsapp_sent || currentCart.recovered) {
                        console.log(`⏭️  Skipping cart ${currentCart.cart_id} - already processed`);
                        continue;
                    }

                    let phoneNumber = currentCart.customer_phone;

                    if (!phoneNumber) {
                        console.warn(`⚠️ Missing phone number for cart ${currentCart.cart_id}`);
                        failCount++;
                        continue;
                    }

                    // BUG FIX 2: Format phone number properly
                    // If starts with 91 and length 10, prefix with +91 (making it 919XXXXXXXXX with +)
                    // Final format must be: 919XXXXXXXXX (no + prefix for WhatsApp API)
                    phoneNumber = phoneNumber.trim().replace(/\D/g, ''); // Remove non-digits

                    if (phoneNumber.length === 10 && phoneNumber.startsWith('9')) {
                        // Add country code for India
                        phoneNumber = '91' + phoneNumber;
                    } else if (phoneNumber.length === 12 && phoneNumber.startsWith('91')) {
                        // Already has country code, keep as is
                        phoneNumber = phoneNumber;
                    } else if (phoneNumber.startsWith('+')) {
                        // Remove + if present
                        phoneNumber = phoneNumber.substring(1);
                    }

                    console.log(`📤 Sending abandoned cart template to: ${phoneNumber}`);

                    // PRODUCTION: Send WhatsApp template using improved service
                    let result;
                    try {
                        // Do NOT hardcode template name - let service handle it dynamically
                        result = await sendAbandonedCartTemplate(currentCart, null);
                    } catch (sendError) {
                        console.error(`❌ Error sending template to ${phoneNumber}:`, sendError.message);
                        result = { success: false, error: sendError.message };
                    }

                    if (result && result.success) {
                        // PRODUCTION: Update cart with whatsapp_sent flag
                        try {
                            await AbandonedCart.findByIdAndUpdate(
                                currentCart._id,
                                {
                                    whatsapp_sent: true,
                                    whatsapp_sent_at: now,
                                    updated_at: now
                                },
                                { new: true }
                            );

                            console.log(`✅ Template sent successfully to ${phoneNumber} | Cart: ${currentCart.cart_id}`);
                            console.log(`✅ Template used: ${result.template} | Language: ${result.language}`);
                            successCount++;
                        } catch (updateError) {
                            console.error(`❌ Failed to update cart ${currentCart.cart_id} after sending:`, updateError.message);
                            failCount++;
                        }
                    } else {
                        console.error(`❌ Error sending template to ${phoneNumber}`);

                        // ✅ Prevent infinite spam: Mark as sent if error is permanent (template mismatch)
                        // Or simply stop retrying this cart after one failed attempt to save CPU
                        await AbandonedCart.findByIdAndUpdate(currentCart._id, {
                            whatsapp_sent: true,
                            whatsapp_status: 'failed',
                            error_message: result?.error
                        });

                        failCount++;
                    }

                } catch (cartError) {
                    console.error(`❌ Error processing cart ${cart.cart_id}:`, cartError.message);
                    failCount++;
                }
            }

            console.log(`📈 Scheduler cycle completed | Success: ${successCount} | Failed: ${failCount} | Total processed: ${successCount + failCount}`);

        } catch (error) {
            console.error('❌ Error in Abandoned Cart Scheduler:', error.message);
        } finally {
            this.isProcessing = false; // ✅ Release lock
        }
    }
}

module.exports = new AbandonedCartScheduler();
