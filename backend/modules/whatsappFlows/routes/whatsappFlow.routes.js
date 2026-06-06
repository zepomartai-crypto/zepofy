const express = require('express');
const router = express.Router();
const whatsappFlowController = require('../controllers/whatsappFlow.controller');
const { verifyToken } = require('../../../middleware/auth.middleware');

// Meta Data Endpoint for Dynamic WhatsApp Flows (Public route, NO auth token)
router.post('/data', whatsappFlowController.handleFlowDataEndpoint);

// Apply auth middleware to all routes
router.use(verifyToken);

// Create a new WhatsApp Flow
router.post('/', whatsappFlowController.createFlow);

// Get all WhatsApp Flows
router.get('/', whatsappFlowController.getFlows);

// Get Integrated Channels
router.get('/integrations', whatsappFlowController.getIntegratedChannels);

// Send Flow to Customer
router.post('/send', whatsappFlowController.sendFlowToCustomer);

// Get a single WhatsApp Flow by ID
router.get('/:id', whatsappFlowController.getFlowById);

// Update a WhatsApp Flow by ID
router.put('/:id', whatsappFlowController.updateFlow);

// Sync Flow with Meta
router.post('/:id/sync', whatsappFlowController.syncFlowWithMeta);

// Publish Flow to Meta
router.post('/:id/publish', whatsappFlowController.publishFlow);

// Delete a WhatsApp Flow by ID
router.delete('/:id', whatsappFlowController.deleteFlow);

module.exports = router;
