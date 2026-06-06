// routes/webhooks.routes.js
// ✅ Production-ready webhook endpoints

const express = require("express");
const router = express.Router();

// Controllers
// Use the updated woocommerce.controller.js which contains the generic webhookHandler
// Controllers
// Use the updated woocommerce.controller.js which contains the generic webhookHandler
const woocommerceWebhookController = require("../controllers/woocommerce.controller");
const shopifyController = require("../controllers/shopify.controller"); // ✅ Unified Controller
const metaWebhookController = require("../controllers/metaWebhook.controller");

// Multer for multipart/form-data handling
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

/**
 * IMPORTANT:
 * Webhooks require RAW body
 * Do NOT use express.json() here
 */

// --------------------
// --------------------
// WooCommerce/Third-Party Webhook
// URL: /api/webhooks/woocommerce
// SECURE: Supports Token Authentication (?token=...) 
// FALLBACK: Supports legacy GoKwik/Third-party payloads without token
// SUPPORTS: 
//   - Official WooCommerce Webhooks (Authenticated via Token)
//   - Third-Party Abandoned Cart Checkout
//   - Generic JSON payloads
//
// Expected Format:
// {
//   "data": [
//     {
//       "id": "cart_id",
//       "is_abandoned": true,
//       "total_price": 100,
//       "items": [...],
//       "Customer.phone": "phone",
//       "Customer.email": "email",
//       "Address.firstname": "first",
//       "Address.lastname": "last",
//       ...
//     }
//   ]
// }
// --------------------
// --------------------
// WooCommerce/Third-Party Webhook
// URL: /api/webhooks/woocommerce
// --------------------
router.post(
  "/woocommerce",
  woocommerceWebhookController.webhookHandler
);

router.post(
  "/woocommerce/:userId",
  woocommerceWebhookController.webhookHandler
);

// --------------------
// Shopify Webhook (NEW SYSTEM - PHASE 2)
// URL: /api/webhooks/shopify/:topic/:userId
// --------------------
router.post(
  "/shopify/orders-create/:userId",
  shopifyController.handleOrderWebhook.bind(shopifyController)
);

router.post(
  "/shopify/orders-updated/:userId",
  shopifyController.handleOrderUpdatedWebhook.bind(shopifyController)
);

router.post(
  "/shopify/checkouts-update/:userId",
  shopifyController.handleCheckoutWebhook.bind(shopifyController)
);

router.post(
  "/shopify/app-uninstalled/:userId",
  shopifyController.handleAppUninstalledWebhook.bind(shopifyController)
);

// --------------------
// Meta (WhatsApp) Webhook
// URL: /api/webhooks/meta
// --------------------
router.get(
  "/meta",
  metaWebhookController.handleWebhook.bind(metaWebhookController)
);

router.post(
  "/meta",
  metaWebhookController.handleWebhook.bind(metaWebhookController)
);

// --------------------
// REMOVED: Abandoned Cart Plugin Webhook
// We now strictly use Native WooCommerce Order Webhooks
// --------------------

// --------------------
// Health Check
// --------------------
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Webhooks are running",
    timestamp: new Date().toISOString(),
    endpoints: {
      woocommerce: {
        url: "/api/webhooks/woocommerce",
        method: "POST",
        description: "Third-party abandoned cart webhook (simplified - no auth)",
        payload_format: {
          data: "array of abandoned carts",
          example: {
            id: "cart_id",
            is_abandoned: true,
            total_price: 100,
            items: "product items array",
            "Customer.phone": "customer phone",
            "Customer.email": "customer email",
            "Address.firstname": "customer first name",
            "Address.lastname": "customer last name"
          }
        }
      },
      shopify: {
        url: "/api/webhooks/shopify",
        events: ["orders/create", "orders/updated", "customers/create"],
        method: "POST"
      },
      meta: {
        url: "/api/webhooks/meta",
        events: ["messages", "message_statuses"],
        method: "POST"
      }
    }
  });
});

module.exports = router;
