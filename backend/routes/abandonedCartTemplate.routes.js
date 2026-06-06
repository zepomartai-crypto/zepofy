const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const AbandonedCart = require('../models/AbandonedCart');
const abandonedCartService = require('../services/abandonedCartService');


// Send abandoned cart template manually (for testing)
router.post('/send-template', auth, async (req, res) => {
    try {
        const { cartId, templateName } = req.body;

        if (!cartId) {
            return res.status(400).json({
                success: false,
                error: 'Cart ID is required'
            });
        }

        console.log(`🔍 Searching for cart: ${cartId}`);

        // FIX: Search by cart_id using regex pattern (not woo_order_id)
        // Frontend sends numeric ID like 48, but database stores "cart_48_1770789270141"
        let cart = await AbandonedCart.findOne({
            cart_id: { $regex: `^cart_${cartId}_` }
        }).sort({ created_at: -1 });

        // Fallback: try exact match
        if (!cart) {
            cart = await AbandonedCart.findOne({
                cart_id: String(cartId)
            }).sort({ created_at: -1 });
        }

        // Fallback: try woo_order_id for backwards compatibility
        if (!cart) {
            cart = await AbandonedCart.findOne({
                woo_order_id: cartId
            }).sort({ created_at: -1 });
        }

        if (!cart) {
            return res.status(404).json({
                success: false,
                error: `Abandoned cart not found. Searched: cart_${cartId}_*, ${cartId}, woo_order_id=${cartId}`
            });
        }

        console.log(`✅ Cart found: ${cart.cart_id}`);

        // 🔥 FIX: Do NOT hardcode template name
        // Use provided templateName or let service use dynamic loading
        console.log(`📋 Sending template: ${templateName || 'dynamic (from settings)'}`);

        const result = await abandonedCartService.sendAbandonedCartTemplate(cart, templateName || null);


        if (result.success) {
            res.json({
                success: true,
                message: 'Template sent successfully',
                data: {
                    cartId: cart.cart_id,
                    templateUsed: result.template,
                    language: result.language,
                    messageId: result.messageId
                }
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
                availableTemplates: result.availableTemplates,
                cartId: cart.cart_id
            });
        }

    } catch (error) {
        console.error('❌ Error sending abandoned cart template:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Send template to multiple abandoned carts
router.post('/send-bulk', auth, async (req, res) => {
    try {
        const { cartIds, templateName } = req.body;

        if (!cartIds || !Array.isArray(cartIds)) {
            return res.status(400).json({
                success: false,
                error: 'Cart IDs array is required'
            });
        }

        console.log(`📋 Bulk sending to ${cartIds.length} carts`);
        const results = [];

        for (const cartId of cartIds) {
            try {
                // FIX: Search by cart_id using regex pattern
                let cart = await AbandonedCart.findOne({
                    cart_id: { $regex: `^cart_${cartId}_` }
                }).sort({ created_at: -1 });

                // Fallback options
                if (!cart) {
                    cart = await AbandonedCart.findOne({
                        cart_id: String(cartId)
                    }).sort({ created_at: -1 });
                }

                if (!cart) {
                    cart = await AbandonedCart.findOne({
                        woo_order_id: cartId
                    }).sort({ created_at: -1 });
                }

                if (!cart) {
                    results.push({
                        cartId,
                        success: false,
                        error: 'Cart not found'
                    });
                    continue;
                }

                // 🔥 FIX: Use dynamic template name
                const result = await abandonedCartService.sendAbandonedCartTemplate(cart, templateName || null);

                results.push({
                    cartId: cart.cart_id,
                    success: result.success,
                    messageId: result.messageId,
                    template: result.template,
                    language: result.language,
                    error: result.error
                });

            } catch (cartError) {
                console.error(`❌ Error processing cart ${cartId}:`, cartError.message);
                results.push({
                    cartId,
                    success: false,
                    error: cartError.message
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        const failCount = results.length - successCount;

        res.json({
            success: true,
            message: `Processed ${results.length} carts | Success: ${successCount} | Failed: ${failCount}`,
            data: results
        });

    } catch (error) {
        console.error('❌ Error sending bulk abandoned cart templates:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
