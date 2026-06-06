const express = require("express");
const router = express.Router();
const systemLogController = require("../../controllers/master/systemLog.controller");
const { requireSuperAdmin } = require("../../middleware/roleMiddleware");

// 🔥 Apply Super Admin middleware to all master system log routes
router.use(requireSuperAdmin);

router.get("/", systemLogController.getSystemLogs);

module.exports = router;
