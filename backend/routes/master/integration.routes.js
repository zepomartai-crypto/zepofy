const express = require("express");
const router = express.Router();
const integrationController = require("../../controllers/master/integration.controller");
const { requireSuperAdmin } = require("../../middleware/roleMiddleware");

// 🔥 Apply Super Admin middleware to all master integration routes
router.use(requireSuperAdmin);

// Global integrations monitoring routes
router.get("/", integrationController.getGlobalIntegrations);
router.get("/stats", integrationController.getIntegrationStats);

module.exports = router;
