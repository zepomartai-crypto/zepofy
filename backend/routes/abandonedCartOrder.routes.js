// Abandoned Cart Order Routes
// API endpoints for abandoned cart management

const express = require('express');
const router = express.Router();
const abandonedCartOrderController = require('../controllers/abandonedCartOrder.controller');

// GET /api/abandoned-carts - Get all abandoned carts
router.get('/', abandonedCartOrderController.getAbandonedCarts);

// GET /api/abandoned-carts/stats - Get abandoned cart statistics
router.get('/stats', abandonedCartOrderController.getAbandonedCartStats);

module.exports = router;
