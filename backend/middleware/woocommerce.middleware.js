const WooCommerceIntegration = require("../models/WooCommerceIntegration");

/**
 * Middleware to check if user has a connected WooCommerce store.
 * Rejects with 403 if not connected.
 */
const checkWooConnection = async (req, res, next) => {
    try {
        const integration = await WooCommerceIntegration.findOne({
            userId: req.userId,
            status: "connected"
        });

        if (!integration) {
            return res.status(403).json({
                success: false,
                error: "WooCommerce not connected"
            });
        }

        // Attach the integration to req for downstream usage if needed
        req.wooIntegration = integration;
        next();
    } catch (err) {
        console.error("❌ WooCommerce Middleware Error:", err.message);
        res.status(500).json({ success: false, error: "Internal Server Error during connection check" });
    }
};

module.exports = { checkWooConnection };
