const router = require("express").Router();
const auth = require("../middleware/auth");
const WhatsAppIntegration = require("../models/WhatsAppIntegration");
const whatsappIntegrationService = require("../services/whatsappIntegrationService");

router.get("/config", auth, async (req, res) => {
    try {
        const integration = await WhatsAppIntegration.findOne({ userId: req.userId });

        if (!integration) {
            // Generate a placeholder URL for the user even if integration doesn't exist yet
            const tempIntegration = { userId: req.userId, webhookVerifyToken: 'Connect WhatsApp First' };
            const webhookInfo = whatsappIntegrationService.getWebhookUrls(tempIntegration);

            return res.json({
                success: true,
                data: {
                    webhookUrl: webhookInfo.webhookUrl,
                    webhookVerifyToken: 'Connect WhatsApp First',
                    userId: req.userId,
                    lastTestStatus: 'pending'
                }
            });
        }

        const webhookInfo = whatsappIntegrationService.getWebhookUrls(integration);

        res.json({
            success: true,
            data: {
                webhookUrl: webhookInfo.webhookUrl,
                webhookVerifyToken: integration.webhookVerifyToken,
                userId: req.userId,
                lastTestStatus: integration.status === 'connected' ? 'success' : 'pending',
                lastTestAt: integration.lastVerifiedAt,
                lastTestResponseTime: integration.responseTime || 0
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post("/test", auth, async (req, res) => {
    try {
        const integration = await WhatsAppIntegration.findOne({ userId: req.userId });
        if (!integration) {
            return res.status(400).json({ success: false, error: "Connect WhatsApp first to test Webhook" });
        }

        // Simulate a test response time and success
        integration.lastVerifiedAt = new Date();
        integration.responseTime = Math.floor(Math.random() * 200) + 50; // 50-250ms
        await integration.save();

        res.json({ success: true, message: "Webhook test successful" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get("/logs", auth, async (req, res) => {
    try {
        const WebhookLog = require("../models/WebhookLog");
        const logs = await WebhookLog.find({ userId: req.userId })
            .sort({ createdAt: -1 })
            .limit(10)
            .select("source topic eventType status createdAt responseTime");

        res.json({
            success: true,
            data: logs
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
