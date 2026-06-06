const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const groupMessageController = require('../controllers/groupMessageController');

// Add members to group (Legacy)
router.post('/add-members', auth, groupMessageController.addMembers);

// Add contacts to group
router.post('/add-contacts', auth, groupMessageController.addContacts);

// Create group + Add contacts
router.post('/create-with-contacts', auth, groupMessageController.createWithContacts);

// Send template to group
router.post('/send-template', auth, groupMessageController.sendTemplateToGroup);

// Get group message status
router.get('/:groupId/messages/status', auth, groupMessageController.getGroupMessageStatus);

module.exports = router;
