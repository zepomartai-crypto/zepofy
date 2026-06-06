const express = require("express");
const router = express.Router();
const commerceController = require("../controllers/commerce.controller");
const auth = require("../middleware/auth");

// All routes are protected
router.use(auth);

// Products
router.get("/products", commerceController.getProducts);
router.get("/products/skus", commerceController.getProductSkus);
router.post("/products", commerceController.createProduct);
router.put("/products/:id", commerceController.updateProduct);
router.delete("/products/:id", commerceController.deleteProduct);

// Categories
router.get("/categories", commerceController.getCategories);
router.post("/categories", commerceController.createCategory);
router.put("/categories/:id", commerceController.updateCategory);
router.delete("/categories/:id", commerceController.deleteCategory);
router.post("/categories/:id/sync", commerceController.syncCategoryToMeta);

// Orders
router.get("/orders", commerceController.getOrders);
router.get("/orders/:id", commerceController.getOrderById);
router.patch("/orders/:id/status", commerceController.updateOrderStatus);
router.delete("/orders/:id", commerceController.deleteOrder);

// Sync
router.get("/sync-logs", commerceController.getSyncLogs);
router.post("/sync-product/:id", commerceController.syncProduct);
router.post("/sync-all", commerceController.syncAllProducts);
router.post("/connect-catalog", commerceController.connectMetaCatalog);
router.post("/manual-catalog", commerceController.saveManualCatalogId);
router.post("/refresh-statuses", commerceController.refreshProductStatuses);
router.post("/disconnect-catalog", commerceController.disconnectMetaCatalog);

// Import from Meta
router.post("/import-products", commerceController.importMetaProducts);
router.post("/import-categories", commerceController.importMetaCategories);

module.exports = router;
