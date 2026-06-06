const express = require('express');
const router = express.Router();
const aiChatController = require('../controllers/aiChatController');
const auth = require('../middleware/auth');

router.post('/ask', auth, aiChatController.ask);
router.get('/history', auth, aiChatController.getHistory);
router.post('/rate', auth, aiChatController.rateResponse);

module.exports = router;
