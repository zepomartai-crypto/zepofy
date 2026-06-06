// Abandoned Cart API Routes
// API endpoints for frontend abandoned cart display

const express = require('express');
const router = express.Router();
const abandonedCartApiController = require('../controllers/abandonedCartApiController');
const authMiddleware = require('../middleware/auth.middleware');

// Apply auth middleware to ALL routes
// CRITICAL: Bind verifyToken to preserve 'this' context
router.use(authMiddleware.verifyToken.bind(authMiddleware));

// ✅ PRODUCTION: Static routes MUST come before dynamic routes in Express
// Stats route - /api/abandoned-carts/stats
router.get('/stats', abandonedCartApiController.getAbandonedCartStats);

// Normalize route - /api/abandoned-carts/normalize  
router.post('/normalize', abandonedCartApiController.normalizeAbandonedCartStatuses);

// Test WhatsApp templates - /api/abandoned-carts/test-templates
router.post('/test-templates', abandonedCartApiController.testWhatsAppTemplates);

// Save template settings - /api/abandoned-carts/save-settings
router.post('/save-settings', abandonedCartApiController.saveTemplateSettings);

// Trigger manual recovery - /api/abandoned-carts/trigger-recovery
router.post('/trigger-recovery', abandonedCartApiController.triggerRecoveryCycle);

// Get all abandoned carts - /api/abandoned-carts
router.get('/', abandonedCartApiController.getAbandonedCarts);

// Get abandoned cart details by ID - /api/abandoned-carts/:cartId (MUST be last)
router.get('/:cartId', abandonedCartApiController.getAbandonedCartById);

module.exports = router;
