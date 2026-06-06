const express = require('express');
const router = express.Router();
const woocommerceController = require('../controllers/woocommerce.controller');

/**
 * WooCommerce Webhook Routes
 * Base Path: /api/webhooks/woocommerce
 * 
 * This handles incoming webhooks from WooCommerce and GoKwik
 * No authentication required - webhooks are external calls
 */

// Webhook endpoint with userId parameter
router.post('/:userId', woocommerceController.webhookHandler);

// Fallback endpoint without userId (for backward compatibility)
router.post('/', woocommerceController.webhookHandler);

module.exports = router;
