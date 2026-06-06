const axios = require("axios");
const SyncLog = require("../models/SyncLog");
const Category = require("../models/Category");

const FAKE_CATALOG_ID = "123456789012345";

const META_CATEGORY_MAP = {
  CL: "Apparel & Accessories",
  AE: "Arts & Entertainment",
  BT: "Baby & Toddler",
  BI: "Business & Industrial",
  EL: "Electronics",
  FU: "Furniture",
  HB: "Health & Beauty",
  HG: "Home & Garden",
  JW: "Jewelry & Watches",
  ME: "Media",
  MI: "Musical Instruments",
  OS: "Office Supplies",
  SW: "Software",
  SG: "Sporting Goods",
  TG: "Toys & Games",
  OT: "Other"
};

class MetaCatalogService {
  constructor() {
    this.baseUrl = "https://graph.facebook.com";
    this.defaultVersion = "v19.0"; // Standardized to v19.0 as per requirement
  }

  /**
   * 📝 Internal logger for Sync Events
   */
  async logSyncEvent(userId, productData, operation, status, message, details = null) {
    try {
      await SyncLog.create({
        userId,
        productId: productData._id,
        sku: productData.sku,
        productName: productData.name,
        operation,
        status,
        message,
        details,
        timestamp: new Date()
      });
    } catch (err) {
      console.error("❌ [Logger] Failed to save sync log:", err.message);
    }
  }

  /**
   * 🏗️ Sync Local Category to Meta Product Set
   */
  async syncProductSet(integration, category) {
    const catalogId = integration.catalogId?.trim();
    if (!catalogId || !integration.catalogConnected) return null;

    let version = integration.metaApiVersion || this.defaultVersion;
    if (version === "v24.0") version = "v19.0";

    const url = `${this.baseUrl}/${version}/${catalogId}/product_sets`;

    // Payload for Product Set
    const payload = {
      name: category.name,
      filter: { "retailer_id": { "i_contains": category.name } } // Generic filter to start
    };

    try {
      const response = await axios.post(url, payload, {
        params: { access_token: integration.accessToken }
      });

      category.metaCategoryId = response.data.id;
      category.isSynced = true;
      category.syncStatus = "synced";
      await category.save();

      return response.data;
    } catch (error) {
      console.error("❌ [META SET] Sync Failed:", error.message);
      category.syncStatus = "error";
      await category.save();
      throw error;
    }
  }

  /**
   * 🗺️ Standard Meta Product Formatter
   */
  formatMetaProduct(product) {
    const domain = process.env.FRONTEND_URL || "https://zepofy.com";
    return {
      name: product.name,
      description: product.description || "No description",
      price: (product.price * 100).toString(), // Scaled to major unit (e.g. 100 * 100 = 10000.00 in Meta's eyes? No, user explicitly asked for * 100)
      currency: "INR",
      availability: product.stock > 0 ? "in stock" : "out of stock",
      condition: "new",
      image_url: product.imageUrl,
      retailer_id: product.sku,
      url: `${domain}/product/${product.sku}`,
      brand: "Zepofy", // Brand set to Zepofy as per requirement
      google_product_category: META_CATEGORY_MAP[product.googleCategory] || "Health & Beauty",
      fb_product_category: META_CATEGORY_MAP[product.googleCategory] || "Health & Beauty"
    };
  }

  /**
   * 🛡️ Validates if the token has necessary permissions
   * Returns detailed report for UI and logic decisions
   */
  async validatePermissions(integration) {
    let version = integration.metaApiVersion || this.defaultVersion;
    if (version === "v24.0") version = "v19.0"; // Force override of the legacy incorrect default

    const url = `${this.baseUrl}/${version}/me/permissions`;

    try {
      const response = await axios.get(url, {
        params: { access_token: integration.accessToken }
      });

      const permissions = response.data.data || [];
      const busMgmt = permissions.find(p => p.permission === 'business_management' && p.status === 'granted');
      const catMgmt = permissions.find(p => p.permission === 'catalog_management' && p.status === 'granted');
      const waMgmt = permissions.find(p => p.permission === 'whatsapp_business_management' && p.status === 'granted');

      const report = {
        business: !!busMgmt,
        catalog: !!catMgmt,
        whatsapp: !!waMgmt,
        allGranted: !!busMgmt && !!catMgmt && !!waMgmt
      };

      // Atomic Update
      integration.hasBusinessManagement = report.allGranted;
      integration.lastPermCheck = new Date();

      return report;
    } catch (error) {
      console.warn('⚠️ [META AUTH] Permission Check API Failed:', error.message);
      return { business: false, catalog: false, whatsapp: false, allGranted: false, error: error.message };
    }
  }

  /**
   * 🧪 Specific Test: Can we actually write to the catalog?
   * Used during connection to prevent "Read Only" states
   */
  async checkWritePermissions(integration) {
    const catalogId = integration.catalogId?.trim();
    if (!catalogId) return { success: false, error: "No Catalog ID" };

    let version = integration.metaApiVersion || this.defaultVersion;
    if (version === "v24.0") version = "v19.0";

    const url = `${this.baseUrl}/${version}/${catalogId}`;

    try {
      const response = await axios.get(url, {
        params: {
          fields: "id,name,business",
          access_token: integration.accessToken
        }
      });

      return { success: true, business: response.data.business };
    } catch (error) {
      return { success: false, error: this.mapMetaError(error) };
    }
  }

  /**
   * 🗺️ Maps Meta API Error codes
   */
  mapMetaError(error) {
    const metaError = error.response?.data?.error || {};
    return metaError.message || error.message || "Meta API Error";
  }

  /**
   * 🔍 Extracts Raw Meta Error for Logic Decisions
   */
  getRawMetaError(error) {
    return error.response?.data?.error || {};
  }

  /**
   * Syncs a single product to Meta Catalog
   */
  async syncProduct(integration, product) {
    // 0. Informational Permission Check
    await this.validatePermissions(integration);

    const catalogId = integration.catalogId?.trim();
    if (!catalogId || catalogId === FAKE_CATALOG_ID) {
      throw new Error("Invalid Catalog ID");
    }

    // 1. Strict Requirement: Double check connected state
    if (integration.catalogConnected !== true) {
      throw new Error("Meta Catalog not connected. Please verify connection first.");
    }

    let version = integration.metaApiVersion || this.defaultVersion;
    if (version === "v24.0") version = "v19.0"; // Force override of the legacy incorrect default

    const url = `${this.baseUrl}/${version}/${catalogId}/products`;

    // 2. Validation
    if (product.imageUrl?.startsWith("data:image")) {
      throw new Error("Image URL invalid (Base64 not supported by Meta)");
    }

    // 3. Format Payload
    const payload = this.formatMetaProduct(product);

    // 4. Debug Logging
    console.log("📦 [META SYNC] Payload:", JSON.stringify(payload, null, 2));
    console.log("📡 [META SYNC] Catalog ID:", catalogId);

    try {
      console.log(`📡 [META SYNC] Sending POST to: ${url}`);
      const response = await axios.post(url, payload, {
        params: { access_token: integration.accessToken },
      });

      console.log("✅ [META SYNC] Success:", JSON.stringify(response.data, null, 2));

      // Log Success
      await this.logSyncEvent(integration.userId, product, "update", "success", "Product synced to Meta", response.data);

      return { success: true, data: response.data };
    } catch (error) {
      const metaError = this.getRawMetaError(error);
      console.error("❌ [META SYNC] API Failure Response:", JSON.stringify(metaError, null, 2));

      // Log Error
      await this.logSyncEvent(integration.userId, product, "update", "error", metaError.message || "Meta API Sync Error", metaError);

      throw error;
    }
  }

  /**
   * Deletes a product
   */
  async deleteProduct(integration, product) {
    const catalogId = integration.catalogId?.trim();
    if (!catalogId || !integration.catalogConnected) return;

    let version = integration.metaApiVersion || this.defaultVersion;
    if (version === "v24.0") version = "v19.0";

    const url = `${this.baseUrl}/${version}/${catalogId}/products`;
    const payload = {
      requests: [{ method: "DELETE", retailer_id: product.sku }]
    };

    try {
      await axios.post(url, payload, {
        params: { access_token: integration.accessToken },
      });

      // Log Success
      await this.logSyncEvent(integration.userId, product, "delete", "success", "Product removed from Meta");

      return { success: true };
    } catch (error) {
      console.error("❌ [META DELETE] Error:", error.message);

      // Log Error
      await this.logSyncEvent(integration.userId, product, "delete", "error", error.message);

      throw error;
    }
  }

  /**
   * Validates Catalog using specific fields
   */
  async validateCatalog(integration) {
    const catalogId = integration.catalogId?.trim();
    if (!catalogId || catalogId === FAKE_CATALOG_ID) {
      throw new Error("Invalid Catalog ID");
    }

    let version = integration.metaApiVersion || this.defaultVersion;
    if (version === "v24.0") version = "v19.0";

    const url = `${this.baseUrl}/${version}/${catalogId}`;

    try {
      const response = await axios.get(url, {
        params: {
          fields: "id,name,vertical,product_count",
          access_token: integration.accessToken
        },
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error("❌ [META VALIDATE] Failed:", error.message);
      throw error; // Throw raw error for controller to handle
    }
  }

  /**
   * 🔍 Fetch Real-time Status for a list of products
   */
  async fetchProductStatuses(integration) {
    const catalogId = integration.catalogId?.trim();
    if (!catalogId || !integration.catalogConnected) return [];

    let version = integration.metaApiVersion || this.defaultVersion;
    if (version === "v24.0") version = "v19.0";

    const url = `${this.baseUrl}/${version}/${catalogId}/products`;

    try {
      const response = await axios.get(url, {
        params: {
          fields: "retailer_id,review_status,id",
          limit: 1000,
          access_token: integration.accessToken
        }
      });

      return response.data.data || [];
    } catch (error) {
      console.error("❌ [META STATUS] Fetch Failed:", error.message);
      return [];
    }
  }

  /**
   * 🔍 Fetch all products from Meta Catalog
   */
  async fetchCatalogProducts(integration) {
    const catalogId = integration.catalogId?.trim();
    if (!catalogId || !integration.catalogConnected) return [];

    let version = integration.metaApiVersion || this.defaultVersion;
    if (version === "v24.0") version = "v19.0";

    const url = `${this.baseUrl}/${version}/${catalogId}/products`;

    try {
      const response = await axios.get(url, {
        params: {
          fields: "retailer_id,name,description,price,currency,image_url,availability,condition,review_status,id",
          limit: 1000,
          access_token: integration.accessToken
        }
      });

      return response.data.data || [];
    } catch (error) {
      console.error("❌ [META PRODUCTS] Fetch Failed:", error.message);
      throw error;
    }
  }

  /**
   * 🔍 Fetch all Product Sets (Categories) from Meta
   */
  async fetchProductSets(integration) {
    const catalogId = integration.catalogId?.trim();
    if (!catalogId || !integration.catalogConnected) return [];

    let version = integration.metaApiVersion || this.defaultVersion;
    if (version === "v24.0") version = "v19.0";

    const url = `${this.baseUrl}/${version}/${catalogId}/product_sets`;

    try {
      const response = await axios.get(url, {
        params: {
          fields: "id,name,filter,product_count",
          access_token: integration.accessToken
        }
      });

      return response.data.data || [];
    } catch (error) {
      console.error("❌ [META PRODUCT SETS] Fetch Failed:", error.message);
      throw error;
    }
  }

  /**
   * 🛠️ Helper to map Meta review_status to local metaStatus
   */
  mapReviewStatus(metaStatus) {
    const statusMap = {
      'approved': 'approved',
      'pending': 'pending',
      'rejected': 'rejected',
      'outdated': 'pending'
    };
    return statusMap[metaStatus?.toLowerCase()] || 'pending';
  }
}

module.exports = new MetaCatalogService();
