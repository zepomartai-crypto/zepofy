const express = require('express');
const router = express.Router();
const shopifyController = require('../controllers/shopify.controller');
const auth = require('../middleware/auth');

// --- Direct Token Generation (Botbiz Style) ---
router.post('/generate-access-token', auth, shopifyController.generateAccessToken.bind(shopifyController));

// --- Protected Dashboard Management ---
router.get('/integration', auth, shopifyController.getIntegrationStatus.bind(shopifyController));
router.get('/status', auth, shopifyController.getIntegrationStatus.bind(shopifyController));
router.get('/analytics', auth, shopifyController.getAnalytics.bind(shopifyController));
router.get('/orders', auth, shopifyController.getOrders.bind(shopifyController));
router.get('/orders/:id', auth, shopifyController.getOrderById.bind(shopifyController));
router.get('/abandoned', auth, shopifyController.getAbandonedCheckouts.bind(shopifyController));
router.get('/abandoned/:checkoutId', auth, shopifyController.getAbandonedCheckoutById.bind(shopifyController));
router.post('/settings', auth, shopifyController.updateSettings.bind(shopifyController));
router.post('/sync', auth, shopifyController.manualSync.bind(shopifyController));
router.get('/webhook-health', auth, shopifyController.checkWebhookHealth.bind(shopifyController));
router.post('/abandoned-checkouts/:checkoutId/retry', auth, shopifyController.retryAbandonedCheckout.bind(shopifyController));

router.post('/disconnect', auth, async (req, res) => {
    try {
        const ShopifyIntegration = require('../models/ShopifyIntegration');
        const Settings = require('../models/Settings');
        const userId = req.userId || req.user?._id;

        await ShopifyIntegration.findOneAndDelete({ userId });
        await Settings.findOneAndUpdate({ userId }, { "shopify.connected": false });

        res.json({ success: true, message: 'Disconnected' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
