const router = require("express").Router();
const webhookController = require("../controllers/webhook.controller");
const metaSignature = require("../middleware/metaSignature");

// Meta verification
router.get("/", webhookController.verify);
router.get("/:userId", webhookController.verify);

// Incoming events
router.post("/", metaSignature, webhookController.handleWebhook);
router.post("/:userId", metaSignature, webhookController.handleWebhook);

module.exports = router;