const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const woocommerceController = require('../controllers/woocommerce.controller');
const woocommerceRepeatPurchaseController = require('../controllers/woocommerceRepeatPurchase.controller');
const { checkWooConnection } = require('../middleware/woocommerce.middleware');

/**
 * WooCommerce Integration & Orders API
 * Base Path: /api/woocommerce
 */

// ----------------------------------------------------------------
// Protected API Routes (Apply Auth Middleware)
// ----------------------------------------------------------------
router.use(authMiddleware.verifyToken.bind(authMiddleware));

// 1. Integration management (Always accessible to authenticated users)
router.get('/integration', woocommerceController.getStatus);
router.get('/status', woocommerceController.getStatus);
router.post('/integration', woocommerceController.connect);
router.post('/test', woocommerceController.test);
router.post('/disconnect', woocommerceController.disconnect);

// 2. Sensitive Action Routes (Require 'connected' status)
router.post('/settings', checkWooConnection, woocommerceController.saveSettings);
router.get('/orders', checkWooConnection, woocommerceController.getOrders);
router.get('/orders/stats', checkWooConnection, woocommerceController.getOrderStats);
router.get('/orders/:id', checkWooConnection, woocommerceController.getOrderById);
router.get('/abandoned-carts', checkWooConnection, woocommerceController.getAbandonedCarts);
router.get('/abandoned-carts/stats', checkWooConnection, woocommerceController.getAbandonedCartStats);
router.get('/abandoned-carts/:cartId', checkWooConnection, woocommerceController.getAbandonedCartById);
router.delete('/abandoned-carts/:cartId', checkWooConnection, woocommerceController.deleteAbandonedCart);
router.post('/abandoned-carts/:cartId/retry', checkWooConnection, woocommerceController.retryAbandonedCart);

router.delete('/orders/:id', checkWooConnection, woocommerceController.deleteOrder);

// 3. Repeat Purchase Automation Routes (Require 'connected' status)
router.get('/repeat-purchase', checkWooConnection, woocommerceRepeatPurchaseController.getOpportunities);
router.get('/repeat-purchase/stats', checkWooConnection, woocommerceRepeatPurchaseController.getStats);
router.post('/repeat-purchase/sync', checkWooConnection, woocommerceRepeatPurchaseController.syncOpportunities);
router.get('/repeat-purchase/settings', checkWooConnection, woocommerceRepeatPurchaseController.getSettings);
router.post('/repeat-purchase/settings', checkWooConnection, woocommerceRepeatPurchaseController.saveSettings);
router.post('/repeat-purchase/reminder/:id', checkWooConnection, woocommerceRepeatPurchaseController.sendReminder);

module.exports = router;
