const express = require("express");
const router = express.Router();
const dashboardController = require("../../controllers/master/dashboard.controller");
const analyticsController = require("../../controllers/master/analytics.controller");
const { requireSuperAdmin } = require("../../middleware/roleMiddleware");

// 🔥 Apply Super Admin middleware to all master dashboard routes
router.use(requireSuperAdmin);

// Dashboard analytics routes
router.get("/", dashboardController.getStats);
router.get("/analytics", analyticsController.getAnalytics);

// 🔥 Debug endpoint to test Super Admin access
router.get("/debug", async (req, res) => {
    try {
        console.log('🔍 [DEBUG] Super Admin debug endpoint');
        console.log('🔍 [DEBUG] Request user:', req.user);

        // Test basic database connection
        const User = require("../../models/User");
        const userCount = await User.countDocuments({ role: "user" });
        const activeUserCount = await User.countDocuments({ role: "user", status: "ACTIVE" });

        res.json({
            success: true,
            debug: {
                user: req.user,
                userRole: req.user?.role,
                userStatus: req.user?.status,
                totalUsersInDb: userCount,
                activeUsersInDb: activeUserCount,
                message: "Super Admin access confirmed",
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('❌ [DEBUG] Debug endpoint error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            debug: {
                user: req.user,
                userRole: req.user?.role,
                userStatus: req.user?.status
            }
        });
    }
});

module.exports = router;
