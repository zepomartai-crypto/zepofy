const express = require("express");
const router = express.Router();
const systemSettingsController = require("../../controllers/master/systemSettings.controller");

router.get("/maintenance", systemSettingsController.getMaintenanceMode);
router.post("/maintenance", systemSettingsController.updateMaintenanceMode);

module.exports = router;
