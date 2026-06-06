const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/auth.middleware");
const checkSuperAdmin = require("../../middleware/checkSuperAdmin");

// Protect all routes under /api/master
router.use(authMiddleware.verifyToken.bind(authMiddleware));
router.use(checkSuperAdmin);

const userController = require("../../controllers/master/user.controller");

router.put("/profile", userController.updateProfile);

router.use("/dashboard", require("./dashboard.routes"));
router.use("/users", require("./user.routes"));
router.use("/webhooks", require("./webhook.routes"));
router.use("/integrations", require("./integration.routes"));
router.use("/system-logs", require("./systemLog.routes"));
router.use("/settings", require("./systemSettings.routes"));

module.exports = router;
