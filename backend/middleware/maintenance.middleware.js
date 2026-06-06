const SystemSettings = require("../models/SystemSettings");

const checkMaintenanceMode = async (req, res, next) => {
    try {
        // Skip for superadmin (User auth might not be ready here, but if app structure allows)
        // Note: This middleware runs BEFORE auth in app.js, so req.user is undefined.
        // We cannot reliably skip maintenance for superadmin here without parsing token.
        // BUT, the login route is white-listed.
        // And once logged in, requests go to /api/master... which might be blocked?
        // If maintenance is ON, we block everything except login.
        // Superadmin needs a way to bypass.
        // Usually we check a header or query param, or we move this middleware AFTER auth for protected routes.
        // For now, let's leave it, but ensure login works.

        // Check if maintenance is enabled
        const setting = await SystemSettings.findOne({ key: 'maintenance' });
        if (setting && setting.value && setting.value.enabled) {

            // Allow login (critical for superadmin to get in)
            if (req.originalUrl.includes('/auth/login') || req.path.includes('/auth/login')) {
                return next();
            }

            // Allow master routes (so superadmin can disable maintenance)
            // This assumes /api/master is protected by auth/role middleware which will reject non-admins.
            if (req.originalUrl.includes('/master') || req.path.includes('/master')) {
                return next();
            }

            return res.status(503).json({
                success: false,
                error: 'Service Unavailable',
                message: setting.value.message || "System is under maintenance. Please try again later."
            });
        }

        next();
    } catch (err) {
        console.error("Maintenance Check Error:", err);
        next();
    }
};

module.exports = checkMaintenanceMode;
