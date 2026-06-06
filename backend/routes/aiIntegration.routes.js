const express = require('express');
const router = express.Router();
const aiIntegrationController = require('../controllers/aiIntegration.controller');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/settings', aiIntegrationController.getSettings);
router.post('/settings', aiIntegrationController.updateSettings);
router.post('/test', aiIntegrationController.testConnection);
router.post('/analyze-order', aiIntegrationController.analyzeOrder);
router.post('/suggest-reply', aiIntegrationController.suggestReply);

module.exports = router;
