const express = require('express');
const router = express.Router();
const flowController = require('./flow.controller');
const flowRunController = require('../../controllers/flowRunController');
const auth = require("../../middleware/auth");

router.get('/triggers', auth, flowController.getTriggers);

// Make sure to use authentication
router.post('/', auth, flowController.saveFlow);
router.get('/', auth, flowController.getFlows);
router.get('/:id', auth, flowController.getFlowById);
router.put('/:id', auth, flowController.saveFlow);
router.patch('/:id/status', auth, flowController.updateFlowStatus);
router.delete('/:id', auth, flowController.deleteFlow);
router.get('/:id/sessions', auth, flowController.getFlowSessions);
router.post('/:id/unlock', auth, flowController.unlockFlow);
router.post('/:id/run', auth, flowRunController.startFlow);
router.post('/validate-keywords', auth, flowController.validateKeywords);

module.exports = router;
