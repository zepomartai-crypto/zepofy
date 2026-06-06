// routes/metaSocialWebhook.routes.js
// Router configuration for multi-tenant Facebook Page and Instagram Webhook events

const express = require("express");
const router = express.Router({ mergeParams: true });
const metaSocialWebhookController = require("../controllers/metaSocialWebhook.controller");
const metaSocialSignature = require("../middleware/metaSocialSignature");

// Handshake verification endpoint (GET)
router.get("/:userId", metaSocialWebhookController.verifyWebhook.bind(metaSocialWebhookController));

// Live event processing endpoint (POST) - secured by HMAC SHA-256 App Secret signature verification
router.post("/:userId", metaSocialSignature, metaSocialWebhookController.handleWebhookEvents.bind(metaSocialWebhookController));

module.exports = router;
