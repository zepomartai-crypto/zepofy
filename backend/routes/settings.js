const router = require("express").Router();
const auth = require("../middleware/auth");
const ctrl = require("../controllers/settings.controller");

// Basic settings routes
router.get("/", auth, ctrl.getSettings);
router.post("/", auth, ctrl.saveSettings);
router.post("/test-webhook", auth, ctrl.testWebhook);

// Abandoned Cart Settings
router.post("/abandoned-cart", auth, ctrl.saveAbandonedCartSettings);

// WhatsApp Integration routes
router.get("/whatsapp/integration", auth, ctrl.getWhatsAppIntegration);
router.post("/whatsapp/connect", auth, ctrl.connectWhatsApp);
router.post("/whatsapp/disconnect", auth, ctrl.disconnectWhatsApp);
router.get("/whatsapp/status", auth, ctrl.getWhatsAppStatus);
router.post("/automation", auth, ctrl.saveAutomationSettings);

// WooCommerce Integration routes
router.post("/woocommerce/connect", auth, ctrl.connectWooCommerce);
router.post("/woocommerce/test", auth, ctrl.testWooCommerceConnection);
router.post("/woocommerce/disconnect", auth, ctrl.disconnectWooCommerce);
router.get("/woocommerce/status", auth, ctrl.getWooCommerceStatus);

// Shopify Integration routes
router.post("/shopify/connect", auth, ctrl.connectShopify);
router.post("/shopify/test", auth, ctrl.testShopifyConnection);
router.post("/shopify/disconnect", auth, ctrl.disconnectShopify);
router.get("/shopify/status", auth, ctrl.getShopifyStatus);

// API Key Management
router.get("/api-keys", auth, ctrl.getApiKeys);
router.post("/api-keys", auth, ctrl.createApiKey);
router.delete("/api-keys/:keyId", auth, ctrl.revokeApiKey);

// Settings Import/Export
router.get("/export", auth, ctrl.exportSettings);
router.post("/import", auth, ctrl.importSettings);

module.exports = router;