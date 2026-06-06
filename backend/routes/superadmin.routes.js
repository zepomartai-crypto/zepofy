const express = require("express");
const router = express.Router();
const superAdminController = require("../controllers/superadmin.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Secure all superadmin routes
router.use(authMiddleware.verifyToken.bind(authMiddleware));
router.use(authMiddleware.isSuperAdmin.bind(authMiddleware));

// 🔥 Dashboard & Metrics
router.get("/dashboard", superAdminController.getDashboardMetrics);
router.get("/subscription-metrics", superAdminController.getSubscriptionMetrics);
router.get("/growth", superAdminController.getGrowthMetrics);

// 🔥 Logging & Monitoring
router.get("/webhooks", superAdminController.getWebhookLogs);
router.get("/system-logs", superAdminController.getSystemLogs);

// 🔥 Integration Central
router.get("/integrations", superAdminController.getAllIntegrations);

// 🔥 Plan Management
router.get("/plans", superAdminController.getAllPlans);
router.post("/plans", superAdminController.createPlan);
router.put("/plans/:id", superAdminController.updatePlan);
router.delete("/plans/:id", superAdminController.deletePlan);

const { upload } = require("../middleware/upload");

// 🔥 Tenant Management
router.get("/users", superAdminController.getAllUsers);
router.post("/users/create", superAdminController.createUser);
router.get("/users/:id", superAdminController.getUserById);
router.patch("/users/:id/status", superAdminController.updateUserStatus);
router.patch("/users/:id/plan", (req, res, next) => { req.uploadType = 'payments'; next(); }, upload.single('proof'), superAdminController.updateUserPlan);
router.post("/users/bulk-plan", superAdminController.bulkUpdateUserPlan);
router.patch("/users/:id/permissions", superAdminController.updateUserPermissions);
router.patch("/users/:id/integrations", superAdminController.updateAllowedIntegrations);
router.patch("/users/:id/trial", superAdminController.updateUserTrial);
router.patch("/users/:id/limits", superAdminController.updateUsageLimits);
router.post("/users/:id/impersonate", superAdminController.impersonateUser);
router.delete("/users/:id", superAdminController.deleteUser);

// 🔥 Security & Direct Actions (Matching Step 2)
router.post("/block/:id", superAdminController.blockUser);
router.post("/reset-password/:id", superAdminController.resetPassword);

// 🔥 Admin Self Management
router.put("/profile", superAdminController.updateProfile);

// 🔥 System Settings
router.get("/settings/maintenance", superAdminController.getMaintenanceMode);
router.post("/settings/maintenance", superAdminController.updateMaintenanceMode);

// Debug
router.get("/debug", (req, res) => res.json({ success: true, active: true }));

module.exports = router;
