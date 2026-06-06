const express = require("express");
const router = express.Router();
const webhookController = require("../../controllers/master/webhook.controller");
const { requireSuperAdmin } = require("../../middleware/roleMiddleware");

// 🔥 Apply Super Admin middleware to all master webhook routes
router.use(requireSuperAdmin);

// Webhook monitoring routes
router.get("/logs", webhookController.getWebhookLogs);
router.get("/logs/:id", webhookController.getWebhookLogById);
router.get("/stats", webhookController.getWebhookStats);
router.delete("/clear", webhookController.clearWebhookLogs);

module.exports = router;
