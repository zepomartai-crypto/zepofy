const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const { checkLimits, checkIntegrationAccess, checkPermission } = require("../middleware/resourceLimits.middleware.js");
const inboxController = require("../controllers/inboxController");
const notificationController = require("../controllers/notificationController");

router.use(auth);
router.use(checkPermission("dashboard"));

router.get("/customers", inboxController.getCustomers);
router.get("/messages/:id", inboxController.getMessages);
router.get("/media/:mediaId", inboxController.getMediaProxy); // 🔥 New Media Proxy
router.post("/send", checkIntegrationAccess("whatsapp"), checkLimits("message"), inboxController.sendMessage);

router.post("/send-template", checkIntegrationAccess("whatsapp"), checkLimits("message"), inboxController.sendTemplateMessage);
router.post("/send-media", checkIntegrationAccess("whatsapp"), checkLimits("message"), inboxController.sendMedia);
router.post("/mark-read", auth, inboxController.markRead);
router.delete("/clear/:id", auth, inboxController.clearChat);
router.delete("/messages/:id", inboxController.deleteMessage);

/* ================= NOTIFICATIONS ================= */
router.get("/notifications/unread-count", notificationController.getUnreadCount);
router.get("/notifications", notificationController.getNotifications);
router.post("/notifications/mark-read", notificationController.markAsRead);
router.post("/notifications/:notificationId/read", notificationController.markSingleAsRead);

module.exports = router;
