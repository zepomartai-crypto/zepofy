// Abandoned Cart API Controller
// Handles API endpoints for frontend abandoned cart display with STRICT multi-tenant isolation

const AbandonedCart = require('../models/AbandonedCart');

class AbandonedCartApiController {
    // Get abandoned carts with exact frontend expected format
    async getAbandonedCarts(req, res) {
        try {
            const { page = 1, limit = 20, search } = req.query;
            const userId = req.userId;

            if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

            // Build query - ONLY for current user and ONLY abandoned carts
            let query = { userId, status: 'abandoned' };

            // Search functionality
            if (search) {
                query.$or = [
                    { customer_name: { $regex: search, $options: 'i' } },
                    { customer_email: { $regex: search, $options: 'i' } },
                    { cart_id: { $regex: search, $options: 'i' } }
                ];
            }

            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Fetch abandoned carts
            const [carts, total] = await Promise.all([
                AbandonedCart.find(query)
                    .sort({ abandoned_at: -1 })
                    .skip(skip)
                    .limit(parseInt(limit))
                    .lean(),
                AbandonedCart.countDocuments(query)
            ]);

            // Transform to match expected frontend format
            const transformedCarts = carts.map(cart => ({
                orderId: cart.woo_order_id || cart.cart_id,
                orderNumber: cart.woo_order_number || cart.cart_id,
                customerEmail: cart.customer_email,
                customerName: cart.customer_name,
                customerPhone: cart.customer_phone,
                total: cart.total_amount,
                currency: cart.currency,
                paymentUrl: cart.payment_url || cart.recovery_url,
                productNames: cart.cart_items ? cart.cart_items.map(item => item.name) : [],
                created_at: cart.created_at,
                updated_at: cart.updated_at,
                whatsapp_sent: cart.whatsapp_sent
            }));

            res.status(200).json({
                success: true,
                data: transformedCarts,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            });

        } catch (error) {
            console.error('❌ Error fetching abandoned carts:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    // Get abandoned cart statistics
    async getAbandonedCartStats(req, res) {
        try {
            const userId = req.userId;
            if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

            const [totalCarts, todayCarts, recoveredCarts] = await Promise.all([
                AbandonedCart.countDocuments({ userId, status: 'abandoned' }),
                AbandonedCart.countDocuments({
                    userId,
                    status: 'abandoned',
                    created_at: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
                }),
                AbandonedCart.countDocuments({ userId, status: 'converted' }) // Using 'converted' as per new schema
            ]);

            const recoveryRate = totalCarts > 0 ? ((recoveredCarts / totalCarts) * 100).toFixed(2) : 0;

            res.status(200).json({
                success: true,
                data: {
                    totalCarts,
                    todayCarts,
                    recoveredCarts,
                    recoveryRate: parseFloat(recoveryRate)
                }
            });

        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Get abandoned cart by ID
    async getAbandonedCartById(req, res) {
        try {
            const userId = req.userId;
            const cart = await AbandonedCart.findOne({
                userId,
                cart_id: req.params.cartId
            }).lean();

            if (!cart) return res.status(404).json({ success: false, error: 'Abandoned cart not found' });

            res.status(200).json({
                success: true,
                data: cart
            });

        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Normalize abandoned cart statuses
    async normalizeAbandonedCartStatuses(req, res) {
        try {
            const userId = req.userId;
            // Normalize checkout-draft/pending to abandoned
            await AbandonedCart.updateMany(
                { userId, status: { $in: ['pending', 'active'] } },
                { $set: { status: 'abandoned', updated_at: new Date() } }
            );

            res.status(200).json({ success: true, message: 'Normalized' });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Test WhatsApp templates
    async testWhatsAppTemplates(req, res) {
        try {
            const { phoneNumber } = req.body;
            if (!phoneNumber) return res.status(400).json({ success: false, error: 'Phone number required' });

            const abandonedCartService = require('../services/abandonedCartService');
            // This would need to be implemented or updated in the service
            res.status(200).json({ success: true, message: 'Feature pending service update' });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Save template settings
    async saveTemplateSettings(req, res) {
        try {
            const { templateName, templateLanguage } = req.body;
            const userId = req.userId;
            const Settings = require('../models/Settings');

            await Settings.findOneAndUpdate(
                { userId },
                { $set: { "abandonedCart.templateName": templateName, "abandonedCart.templateLanguage": templateLanguage } },
                { upsert: true }
            );

            res.status(200).json({ success: true, message: 'Saved' });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    // Trigger manual recovery cycle (on-demand scheduler run)
    async triggerRecoveryCycle(req, res) {
        try {
            const scheduler = require('../schedulers/abandonedCart.scheduler');
            // We call the internal check method once
            await scheduler.checkAbandonedCarts();
            res.status(200).json({ success: true, message: 'Recovery cycle finished' });
        } catch (error) {
            console.error('❌ Trigger Recovery Error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new AbandonedCartApiController();
