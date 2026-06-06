const express = require('express');
const router = express.Router();
const {
  getIntegration,
  // saveIntegration,
  verifyToken,
  connectWhatsApp,
  disconnectWhatsApp,
  testConnection
} = require('../controllers/integrations.controller');
const auth = require('../middleware/auth');

// All routes require authentication
router.use(auth);

router.get('/status', require('../controllers/integrations.controller').getOverallStatus);

// WhatsApp integration routes
router.get('/whatsapp', getIntegration);
// router.post('/whatsapp/save', saveIntegration);
router.post('/whatsapp/verify-token', verifyToken);
router.post('/whatsapp/connect', connectWhatsApp);
router.post('/whatsapp/disconnect', disconnectWhatsApp);
router.post('/whatsapp/test', testConnection);
router.post('/whatsapp/regenerate-webhook-token', require('../controllers/integrations.controller').regenerateWebhookToken);

// Facebook & Instagram integration routes
const metaIntegrationController = require('../controllers/metaIntegration.controller');
router.get('/meta/config', metaIntegrationController.getMetaConfig.bind(metaIntegrationController));
router.post('/meta/connect', metaIntegrationController.connectMeta.bind(metaIntegrationController));
router.post('/meta/revoke', metaIntegrationController.revokeMetaConnection.bind(metaIntegrationController));
router.get('/meta/logs', metaIntegrationController.getWebhookLogs.bind(metaIntegrationController));

module.exports = router;
