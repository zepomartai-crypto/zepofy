const express = require("express");
const router = express.Router();
const metaSocialController = require("../controllers/metaSocial.controller");
const auth = require("../middleware/auth");

// Protect all API routes with auth middleware
router.use(auth);

// GET /api/social/conversations
router.get("/conversations", metaSocialController.getConversations.bind(metaSocialController));

// GET /api/social/conversations/:id/messages
router.get("/conversations/:id/messages", metaSocialController.getMessages.bind(metaSocialController));

// POST /api/social/send-message
router.post("/send-message", metaSocialController.sendMessage.bind(metaSocialController));

module.exports = router;
