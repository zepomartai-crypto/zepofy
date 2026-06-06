const Product = require("../models/Product");
const Category = require("../models/Category");
const Order = require("../models/Order");
const SyncLog = require("../models/SyncLog");
const WhatsAppIntegration = require("../models/WhatsAppIntegration");
const metaCatalogService = require("../services/metaCatalog.service");
const cloudinary = require("../config/cloudinary"); // Integrated Cloudinary

// --- PRODUCTS ---

exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find({ userId: req.userId }).populate("categoryId").sort("-createdAt");
    
    // Calculate stats for dashboard
    const stats = {
      total: products.length,
      outOfStock: products.filter(p => p.stock <= 0).length,
      synced: products.filter(p => p.syncStatus === 'synced').length,
      inCategories: products.filter(p => p.categoryId).length
    };

    res.json({ success: true, products, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Handle Image Uploads to Cloudinary
 */
async function handleImageUpload(imageUrl) {
  if (imageUrl && imageUrl.startsWith("data:image")) {
    console.log("☁️ [CLOUDINARY] Uploading base64 image...");
    try {
      const upload = await cloudinary.uploader.upload(imageUrl, {
        folder: "zepofy_products",
      });
      console.log("✅ [CLOUDINARY] Upload successful:", upload.secure_url);
      return upload.secure_url;
    } catch (err) {
      console.error("❌ [CLOUDINARY] Upload failed:", err.message);
      throw new Error(`Image upload failed: ${err.message}`);
    }
  }
  return imageUrl;
}

exports.createProduct = async (req, res) => {
  try {
    const integration = await WhatsAppIntegration.findOne({ userId: req.userId });

    // 🛡️ STRICT GUARD: NO CONNECTION = NO PRODUCTS
    if (!integration || !integration.catalogId || integration.catalogConnected !== true) {
      return res.status(400).json({
        success: false,
        message: "Please connect a valid Meta Catalog before adding products."
      });
    }

    const productData = { ...req.body, userId: req.userId };

    // 🛡️ STRICT VALIDATION (Rule #5)
    if (!productData.googleCategory) {
      return res.status(400).json({ success: false, error: "Category is mandatory for Meta Catalog compatibility" });
    }
    if (!productData.price || productData.price <= 0) {
      return res.status(400).json({ success: false, error: "Price must be greater than 0" });
    }
    if (!productData.sku) {
      return res.status(400).json({ success: false, error: "SKU (Retailer ID) is required" });
    }

    // 🛡️ SKU UNIQUENESS CHECK (Rule #5)
    const existingSku = await Product.findOne({ userId: req.userId, sku: productData.sku });
    if (existingSku) {
      return res.status(400).json({ success: false, error: `SKU '${productData.sku}' already exists. Please use a unique ID.` });
    }

    // 1. Critical: Image Handling (Convert base64 to Cloudinary URL)
    productData.imageUrl = await handleImageUpload(productData.imageUrl);
    if (!productData.imageUrl) {
      return res.status(400).json({ success: false, error: "Public Image URL is mandatory" });
    }

    const product = await Product.create(productData);

    // 2. Auto Sync Pipeline
    await exports.syncSingleProductInternal(req.userId, product);

    res.status(201).json({ success: true, product });
  } catch (err) {
    console.error("❌ [CREATE PRODUCT] Error:", err.message);
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const integration = await WhatsAppIntegration.findOne({ userId: req.userId });

    // 🛡️ STRICT GUARD: NO CONNECTION = NO UPDATES
    if (!integration || !integration.catalogId || integration.catalogConnected !== true) {
      return res.status(400).json({
        success: false,
        message: "Your Meta Catalog is disconnected. Please re-verify connection in Settings."
      });
    }

    const productData = { ...req.body };

    // 🛡️ STRICT VALIDATION
    if (productData.price !== undefined && productData.price <= 0) {
      return res.status(400).json({ success: false, error: "Price must be greater than 0" });
    }

    // 🛡️ SKU UNIQUENESS CHECK
    if (productData.sku) {
      const existingSku = await Product.findOne({
        userId: req.userId,
        sku: productData.sku,
        _id: { $ne: req.params.id }
      });
      if (existingSku) {
        return res.status(400).json({ success: false, error: `SKU '${productData.sku}' is already taken by another product.` });
      }
    }

    // 1. Critical: Image Handling (Convert base64 to Cloudinary URL)
    if (productData.imageUrl?.startsWith("data:image")) {
      productData.imageUrl = await handleImageUpload(productData.imageUrl);
    }

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      productData,
      { new: true }
    );
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });

    // 2. Auto Sync Pipeline
    await exports.syncSingleProductInternal(req.userId, product);

    res.json({ success: true, product });
  } catch (err) {
    console.error("❌ [UPDATE PRODUCT] Error:", err.message);
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, userId: req.userId });
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });

    // Delete from Meta if synced
    if (product.metaProductId || product.syncStatus === 'synced') {
      const integration = await WhatsAppIntegration.findByUserIdWithToken(req.userId);
      if (integration && integration.catalogId) {
        await metaCatalogService.deleteProduct(integration, product).catch(console.error);
      }
    }

    await Product.deleteOne({ _id: product._id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// --- CATEGORIES ---

exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ userId: req.userId }).sort("name");
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const category = await Category.create({ ...req.body, userId: req.userId });
    res.status(201).json({ success: true, category });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const category = await Category.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true }
    );
    if (!category) return res.status(404).json({ success: false, error: "Category not found" });
    res.json({ success: true, category });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findOne({ _id: req.params.id, userId: req.userId });
    if (!category) return res.status(404).json({ success: false, error: "Category not found" });

    // Optional: Check if products are using this category
    const productCount = await Product.countDocuments({ categoryId: category._id });
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete category. ${productCount} products are assigned to it.`
      });
    }

    await Category.deleteOne({ _id: category._id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// --- ORDERS ---

exports.getOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const orders = await Order.find({ userId: req.userId })
      .populate("items.productId")
      .sort("-createdAt")
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments({ userId: req.userId });

    res.json({
      success: true,
      orders,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.userId })
      .populate("items.productId");
    
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { status },
      { new: true }
    );

    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    // 🔥 NEW: Trigger Flow Builder for status changes
    console.log(`🌊 [Commerce] Status changed to ${status}. Triggering flow for ${order.customerPhone}`);
    const flowEngine = require("../modules/flowBuilder/flow.engine");
    await flowEngine.handleIncomingEvent(
      req.userId,
      order.customerPhone,
      `order_${status}`,
      null,
      { orderId: order._id, status }
    ).catch(e => console.error("Flow status trigger error:", e));

    // Notify Admin via socket for real-time list update
    if (global.io) {
      global.io.to(req.userId.toString()).emit("order_status_updated", {
        orderId: order._id,
        status: order.status
      });
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    const result = await Order.deleteOne({ _id: req.params.id, userId: req.userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Notify Admin via socket
    if (global.io) {
      global.io.to(req.userId.toString()).emit("order_deleted", { orderId: req.params.id });
    }

    res.json({ success: true, message: "Order deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// --- SYNC LOGS ---

exports.getSyncLogs = async (req, res) => {
  try {
    const logs = await SyncLog.find({ userId: req.userId })
      .sort("-timestamp")
      .limit(50);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// --- CATEGORY SYNC ---

exports.syncCategoryToMeta = async (req, res) => {
  try {
    const category = await Category.findOne({ _id: req.params.id, userId: req.userId });
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });

    const integration = await WhatsAppIntegration.findByUserIdWithToken(req.userId);
    if (!integration || !integration.catalogConnected) {
      return res.status(400).json({ success: false, message: "Catalog not connected" });
    }

    const result = await metaCatalogService.syncProductSet(integration, category);
    res.json({ success: true, message: "Category synced to Meta Product Set", data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// --- INTERNAL HELPERS ---

exports.syncSingleProductInternal = async (userId, product) => {
  const integration = await WhatsAppIntegration.findByUserIdWithToken(userId);

  const catalogId = integration?.catalogId?.trim();

  // 🛡️ STRICT GUARD: NO CONNECTION = NO SYNC CALLS
  if (!integration || !catalogId || integration.catalogConnected !== true) {
    product.syncStatus = 'failed';
    product.syncError = "Please connect catalog first";
    await product.save();
    return { success: false, message: product.syncError };
  }

  try {
    const response = await metaCatalogService.syncProduct(integration, product);

    product.syncStatus = 'synced';
    product.metaStatus = 'pending'; // Set to pending until next status check
    product.lastSyncAt = new Date();
    product.syncError = null;

    // Attempt to extract Meta ID if available
    if (response.data?.id) {
      product.metaProductId = response.data.id;
    }

    await product.save();
    return { success: true, message: "Product synced successfully", data: response.data };
  } catch (err) {
    const rawError = metaCatalogService.getRawMetaError(err);
    const code = rawError.code;
    const subcode = rawError.error_subcode;

    // 🚨 SMART DISCONNECT Logic
    // Only disconnect if the error is fatal (Catalog not found or Permission denied)
    // Code 100/Subcode 33: Object does not exist
    // Code 200: Permission errors
    if (code === 200 || (code === 100 && subcode === 33)) {
      console.warn(`🚨 [SMART DISCONNECT] Fatal Meta Error Code ${code}:${subcode}. Disconnecting Catalog for user ${userId}`);
      integration.catalogConnected = false;
      await integration.save();
    } else {
      console.log(`📡 [SYNC] Transient Meta Error ${code} - Keeping catalog connected.`);
    }

    product.syncStatus = 'failed';
    product.syncError = metaCatalogService.mapMetaError(err);
    await product.save();
    return { success: false, message: product.syncError };
  }
};

// --- SYNC ALL ---

exports.syncAllProducts = async (req, res) => {
  try {
    const products = await Product.find({ userId: req.userId });
    const integration = await WhatsAppIntegration.findByUserIdWithToken(req.userId);

    if (!integration || !integration.catalogId || integration.catalogConnected !== true) {
      return res.status(400).json({ success: false, message: "Catalog not connected" });
    }

    console.log(`🚀 [BULK SYNC] Starting for ${products.length} products`);

    let successCount = 0;
    let failCount = 0;

    for (const prod of products) {
      const result = await exports.syncSingleProductInternal(req.userId, prod);
      if (result.success) successCount++;
      else failCount++;
    }

    res.json({
      success: true,
      message: `Bulk sync complete: ${successCount} success, ${failCount} failed.`,
      successCount,
      failCount
    });
  } catch (err) {
    console.error("❌ [BULK SYNC] Error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

const whatsappIntegrationService = require("../services/whatsappIntegrationService");

// --- CATALOG ---

exports.connectMetaCatalog = async (req, res) => {
  try {
    const result = await whatsappIntegrationService.connectMetaCatalog(req.userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.syncProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, userId: req.userId });
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    console.log(`🔄 [MANUAL SYNC] Triggered for SKU: ${product.sku}`);
    const result = await exports.syncSingleProductInternal(req.userId, product);
    res.json(result);
  } catch (err) {
    console.error("❌ [MANUAL SYNC] Error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.saveManualCatalogId = async (req, res) => {
  try {
    let { catalogId } = req.body;
    if (!catalogId) {
      return res.status(400).json({ success: false, message: "Catalog ID is required" });
    }

    catalogId = catalogId.trim();

    const integration = await WhatsAppIntegration.findByUserIdWithToken(req.userId);
    if (!integration) {
      return res.status(400).json({ success: false, message: "WhatsApp not connected" });
    }

    console.log(`🔍 [MANUAL CATALOG] Strictly Validating ID: ${catalogId}`);

    // 🛡️ ZERO TRUST: Validate BEFORE saving to integration document
    const testIntegration = {
      catalogId,
      accessToken: integration.accessToken,
      metaApiVersion: integration.metaApiVersion
    };

    try {
      // 1. Perform Real Meta Validation
      const format = await metaCatalogService.validateCatalog(testIntegration);

      // 2. ID Type Validation: Catalogs must have a vertical (e.g., commerce)
      if (!format.data?.vertical) {
        console.warn(`⚠️ [MANUAL CATALOG] ID ${catalogId} is a valid Meta object but NOT a Catalog (Vertical missing)`);
        return res.status(400).json({
          success: false,
          message: "This ID belongs to a Dataset/Pixel, not a Catalog. Please use a Catalog ID from Commerce Manager Settings."
        });
      }

      // 3. Granular Permission Check
      const permReport = await metaCatalogService.validatePermissions(integration);
      if (!permReport.catalog) {
        return res.status(400).json({
          success: false,
          message: "Permission Missing: your token cannot manage catalogs. Please re-run Embedded Signup.",
          details: permReport
        });
      }

      // 4. SUCCESS -> Perform Atomic Update
      integration.catalogId = catalogId;
      integration.catalogName = format.data?.name || "Linked Catalog";
      integration.catalogConnected = true;
      integration.status = 'connected';
      integration.lastVerified = new Date();
      await integration.save();

      console.log('✅ [MANUAL CATALOG] Linked successfully:', integration.catalogName);

      return res.json({
        success: true,
        message: "Connected ✅",
        catalogName: integration.catalogName,
        permissions: permReport
      });
    } catch (valErr) {
      console.error('❌ [MANUAL CATALOG] Validation Failed:', valErr.message);

      // Ensure we don't accidentally leave it as "connected" if it was before
      integration.catalogConnected = false;
      await integration.save();

      return res.status(400).json({
        success: false,
        message: "Catalog not connected. Invalid ID or missing permissions",
        error: metaCatalogService.mapMetaError(valErr)
      });
    }
  } catch (err) {
    console.error('❌ [MANUAL CATALOG] Error:', err.message);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

exports.disconnectMetaCatalog = async (req, res) => {
  try {
    const integration = await WhatsAppIntegration.findOne({ userId: req.userId });
    if (!integration) {
      return res.status(404).json({ success: false, message: "Integration not found" });
    }

    integration.catalogConnected = false;
    integration.catalogId = null;
    integration.catalogName = null;
    await integration.save();

    res.json({ success: true, message: "Catalog disconnected successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Lightweight endpoint to fetch SKUs and Names for template catalog mapping
 */
exports.getProductSkus = async (req, res) => {
  try {
    const products = await Product.find({ userId: req.userId, syncStatus: "synced" }, "sku name price image_url")
      .sort("name")
      .lean();

    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * 🔄 Refresh all product statuses from Meta
 */
exports.refreshProductStatuses = async (req, res) => {
  try {
    const integration = await WhatsAppIntegration.findByUserIdWithToken(req.userId);
    if (!integration || !integration.catalogConnected) {
      return res.status(400).json({ success: false, message: "Catalog not connected" });
    }

    const metaProducts = await metaCatalogService.fetchProductStatuses(integration);
    if (!metaProducts || metaProducts.length === 0) {
      return res.json({ success: true, message: "No products found in Meta catalog" });
    }

    const updates = [];
    for (const mp of metaProducts) {
      const localStatus = metaCatalogService.mapReviewStatus(mp.review_status);
      updates.push(
        Product.updateOne(
          { userId: req.userId, sku: mp.retailer_id },
          {
            metaStatus: localStatus,
            metaProductId: mp.id,
            lastStatusCheck: new Date()
          }
        )
      );
    }

    await Promise.all(updates);

    res.json({
      success: true,
      message: `Status refresh complete. Processed ${metaProducts.length} items.`
    });
  } catch (err) {
    console.error("❌ [STATUS REFRESH] Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// --- IMPORT FROM META ---

/**
 * 🔄 Pull all products from Meta Catalog to local DB
 */
exports.importMetaProducts = async (req, res) => {
  try {
    const integration = await WhatsAppIntegration.findByUserIdWithToken(req.userId);
    if (!integration || !integration.catalogConnected) {
      return res.status(400).json({ success: false, message: "Catalog not connected" });
    }

    const metaProducts = await metaCatalogService.fetchCatalogProducts(integration);
    if (!metaProducts || metaProducts.length === 0) {
      return res.json({ success: true, message: "No products found in Meta catalog", count: 0 });
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const mp of metaProducts) {
      // Find by SKU (retailer_id)
      let product = await Product.findOne({ userId: req.userId, sku: mp.retailer_id });
      
      const productData = {
        userId: req.userId,
        name: mp.name,
        description: mp.description,
        price: parseFloat(mp.price) / 100, // Meta stores in minor units
        imageUrl: mp.image_url,
        stock: mp.availability === 'in stock' ? 100 : 0,
        metaProductId: mp.id,
        metaStatus: metaCatalogService.mapReviewStatus(mp.review_status),
        syncStatus: 'synced',
        lastSyncAt: new Date()
      };

      if (product) {
        await Product.updateOne({ _id: product._id }, productData);
        updatedCount++;
      } else {
        await Product.create({ ...productData, sku: mp.retailer_id });
        createdCount++;
      }
    }

    res.json({ 
      success: true, 
      message: `Import complete: ${createdCount} created, ${updatedCount} updated.`,
      created: createdCount,
      updated: updatedCount
    });
  } catch (err) {
    console.error("❌ [IMPORT PRODUCTS] Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * 🔄 Pull all Product Sets (Categories) from Meta
 */
exports.importMetaCategories = async (req, res) => {
  try {
    const integration = await WhatsAppIntegration.findByUserIdWithToken(req.userId);
    if (!integration || !integration.catalogConnected) {
      return res.status(400).json({ success: false, message: "Catalog not connected" });
    }

    const metaSets = await metaCatalogService.fetchProductSets(integration);
    if (!metaSets || metaSets.length === 0) {
      return res.json({ success: true, message: "No product sets found in Meta", count: 0 });
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const set of metaSets) {
      let category = await Category.findOne({ userId: req.userId, metaCategoryId: set.id });
      
      if (!category) {
        category = await Category.findOne({ userId: req.userId, name: set.name });
      }

      const categoryData = {
        userId: req.userId,
        name: set.name,
        metaCategoryId: set.id,
        isSynced: true,
        syncStatus: 'synced'
      };

      if (category) {
        await Category.updateOne({ _id: category._id }, categoryData);
        updatedCount++;
      } else {
        await Category.create(categoryData);
        createdCount++;
      }
    }

    res.json({ 
      success: true, 
      message: `Categories import complete: ${createdCount} created, ${updatedCount} updated.`,
      created: createdCount,
      updated: updatedCount
    });
  } catch (err) {
    console.error("❌ [IMPORT CATEGORIES] Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
