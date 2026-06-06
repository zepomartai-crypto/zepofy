const express = require('express');
const router = express.Router();
const metaController = require('../controllers/meta.controller');
const auth = require('../middleware/auth');

// Protect all API routes with auth middleware
router.use(auth);

// Get all conversations
router.get('/conversations', metaController.getConversations);

// Get messages for a specific conversation
router.get('/messages/:conversationId', metaController.getMessages);

// Send a new message
router.post('/send-message', metaController.sendMessage);

module.exports = router;
