const router = require("express").Router();
const auth = require("../middleware/auth");
const ctrl = require("../controllers/settings.controller");

// Route: /api/whatsapp/integration
router.get("/integration", auth, ctrl.getWhatsAppIntegration);
router.post("/integration", auth, ctrl.connectWhatsApp);
router.post("/disconnect", auth, ctrl.disconnectWhatsApp);

// Route: /api/whatsapp/settings (Added for appointment reminders)
router.get("/settings", auth, ctrl.getSettings);
router.post("/settings", auth, ctrl.saveSettings);

module.exports = router;
