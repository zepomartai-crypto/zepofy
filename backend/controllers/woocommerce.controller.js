/* ==========================================================================
   UNIFIED WEBHOOK CONTROLLER - WOOCOMMERCE & GOKWIK
   ========================================================================== */

const WooCommerceIntegration = require("../models/WooCommerceIntegration");
const AbandonedCart = require("../models/AbandonedCart");
const WooCommerceOrder = require("../models/WooCommerceOrder");
const woocommerceService = require("../services/woocommerceService");
const mongoose = require("mongoose");
const flowEngine = require("../modules/flowBuilder/flow.engine");

/**
 * URL: POST /api/webhooks/woocommerce/:userId
 * 
 * ROBUST HANDLER - WOOCOMMERCE & GOKWIK COMPATIBLE:
 * 1. Parse payload safely
 * 2. Handle both direct and array-based payloads
 * 3. Extract order data with fallbacks
 * 4. Always save to database
 * 5. ALWAYS return 200 OK
 */

exports.webhookHandler = async (req, res) => {
  try {
    let payload = {};
    // Safe body parsing
    try {
      if (Buffer.isBuffer(req.body)) {
        payload = JSON.parse(req.body.toString("utf8"));
      } else if (typeof req.body === "string") {
        payload = JSON.parse(req.body);
      } else if (typeof req.body === "object" && req.body !== null) {
        payload = req.body;
      } else {
        console.warn("⚠️ Empty or invalid body received");
        return res.status(200).json({
          message: "Webhook received but empty body"
        });
      }
    } catch (parseErr) {
      console.error("❌ JSON Parse Error:", parseErr.message);
      return res.status(200).json({
        message: "Webhook received but JSON parse error"
      });
    }

    // Log the full payload
    console.log("📡 [WEBHOOK] WooCommerce order payload:", JSON.stringify(payload, null, 2));

    // ROBUST ORDER DATA EXTRACTION
    let orderData = null;
    let isAbandonedCart = false;

    // Case 1: GoKwik / array-based abandoned cart payload (new format)
    if (
      payload.data &&
      Array.isArray(payload.data) &&
      payload.data.length > 0
    ) {
      orderData = payload.data[0];
      isAbandonedCart = orderData.is_abandoned === true;
      console.log("🔍 Detected GoKwik array-based abandoned cart payload");
    }
    // Case 2: Standard WooCommerce payload
    else if (payload.id) {
      orderData = payload;
      console.log("🔍 Detected Standard WooCommerce payload");
    }

    if (!orderData || !orderData.id) {
      console.log("❌ No valid order id found in payload");
      return res.status(200).json({
        message: "Webhook received but no valid order id"
      });
    }

    // ✅ SECURE TENANT IDENTIFICATION
    // 1. Try Secure Token (Query Param or Header)
    // 2. Fallback to Legacy URL Param (for backward compatibility)
    let userId = null;
    const webhookToken = req.query.token || req.headers['x-wauto-token'];
    let integration = null;

    if (webhookToken) {
      // Find integration by unique secure token
      integration = await WooCommerceIntegration.findOne({ webhookToken }).select('userId webhookSecret');
      if (integration) {
        userId = integration.userId;
        console.log(`✅ Tenant identified via secure token: ${userId}`);
      } else {
        console.warn(`⚠️ Invalid webhook token received: ${webhookToken}`);
      }
    }

    // Fallback: Use URL param if token authentication failed or wasn't provided
    if (!userId && req.params.userId) {
      userId = req.params.userId;
      console.log(`ℹ️ Tenant identified via legacy URL param: ${userId}`);
    }

    if (!userId) {
      console.warn("⚠️ Webhook ignored: No valid tenant identification found");
      return res.status(200).json({
        message: "Webhook ignored: No tenant identified"
      });
    }

    // Validate userId exists in DB (Double check)
    const mongoose = require('mongoose');
    let userExists = false;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      const User = require('../models/User');
      userExists = await User.exists({ _id: userId });
    }

    if (!userExists) {
      console.warn(`⚠️ User ID ${userId} not found in database.`);
      return res.status(200).json({
        message: "Webhook ignored: Invalid user"
      });
    }

    // Normalize line items to ensure product names are properly mapped
    const normalizedLineItems = (orderData.items || orderData.line_items || []).map(item => ({
      ...item,
      name: item.product_title || item.title || item.name || 'N/A',
      productName: item.product_title || item.title || item.name || 'N/A',
      price: parseFloat(item.price || item.final_price || 0),
      quantity: parseInt(item.quantity || 1),
      total: parseFloat(item.line_price || item.final_line_price || (item.price * item.quantity) || 0)
    }));

    // Save abandoned cart ONLY after userId is defined and validated
    if (isAbandonedCart && userId && userExists) {
      try {
        const AbandonedCart = require('../models/AbandonedCart');
        await AbandonedCart.findOneAndUpdate(
          { userId, cart_id: orderData.id },
          {
            $set: {
              userId,
              cart_id: orderData.id,
              customer_name: orderData['Customer.firstname'] && orderData['Customer.lastname']
                ? `${orderData['Customer.firstname']} ${orderData['Customer.lastname']}`.trim()
                : orderData['Customer.firstname'] || orderData.first_name || orderData['Merchant.short_name'] || '',
              customer_email: orderData['Address.email'] || orderData.email || '',
              customer_phone: orderData['Address.phone'] || orderData.phone || '',
              cart_items: normalizedLineItems,
              total_amount: orderData.total_price || orderData.original_total_price || 0,
              currency: orderData.currency || 'INR',
              status: 'abandoned',
              created_at: orderData.created_at ? new Date(orderData.created_at) : new Date(),
              updated_at: orderData.updated_at ? new Date(orderData.updated_at) : new Date(),
              rawPayload: orderData
            }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        console.log('✅ Abandoned cart saved:', orderData.id);

        // 🚀 Trigger Flow Builder for Abandoned Cart
        if (orderData['Address.phone'] || orderData.phone) {
          const cartPhone = orderData['Address.phone'] || orderData.phone;
          console.log(`🌊 [Flow Engine] Triggering Abandoned Cart Flow for: ${cartPhone}`);
          flowEngine.triggerFlowByType(userId, cartPhone, "woocommerce", {
            event: "abandoned_cart",
            wooData: orderData
          });
        }
      } catch (err) {
        console.error('❌ Error saving abandoned cart:', err.message);
      }
    }

    // Extract fields with proper fallbacks for both old and new formats
    const extractedOrder = {
      orderId: orderData.id,
      status: orderData.status || (isAbandonedCart ? "abandoned" : "pending"),
      total: orderData.total_price || orderData.original_total_price || orderData.total || 0,
      currency: orderData.currency || "INR",
      firstName: orderData["Customer.firstname"] || orderData.first_name || orderData.billing?.first_name || "",
      lastName: orderData["Customer.lastname"] || orderData.last_name || orderData.billing?.last_name || "",
      email: orderData["Address.email"] || orderData.email || orderData.billing?.email || "",
      phone: orderData["Address.phone"] || orderData.phone || orderData.billing?.phone || "",
      lineItemsCount: orderData.item_count || (orderData.line_items ? orderData.line_items.length : 0),
      dateCreated: orderData.created_at || orderData.date_created || new Date(),
      // Store original data for reference
      rawOrderData: orderData
    };

    console.log("📋 Extracted Order Data:", extractedOrder);

    // ONLY SAVE WooCommerceOrder IF NOT ABANDONED CART
    let savedOrder = null;
    if (!isAbandonedCart) {
      try {
        savedOrder = await WooCommerceOrder.findOneAndUpdate(
          { userId: userId, orderId: extractedOrder.orderId },
          {
            $set: {
              userId,
              orderId: extractedOrder.orderId,
              orderNumber: orderData.number || String(extractedOrder.orderId),
              status: extractedOrder.status,
              totalAmount: parseFloat(extractedOrder.total || 0),
              currency: extractedOrder.currency,
              customerName: `${extractedOrder.firstName} ${extractedOrder.lastName}`.trim() || "Customer",
              customerEmail: extractedOrder.email.toLowerCase(),
              customerPhone: extractedOrder.phone,
              billing: orderData.billing || {},
              shipping: orderData.shipping || {},
              lineItems: normalizedLineItems,
              paymentMethod: orderData.payment_method_title,
              metaData: orderData.meta_data || {},
              dateCreated: extractedOrder.dateCreated,
              rawPayload: orderData,
              updatedAt: new Date()
            }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        console.log("✅ Order saved successfully:", extractedOrder.orderId);

        // Trigger Flow Builder
        if (extractedOrder.phone) {
          flowEngine.triggerFlowByType(userId, extractedOrder.phone, "woocommerce", {
            event: "order_created",
            wooData: orderData
          });
        }
      } catch (dbErr) {
        console.error("❌ Error saving WooCommerce order:", dbErr.message);
        // Continue processing even if save fails
      }

      // 🚀 NATIVE ABANDONED CART SYNC
      // This ensures standard WooCommerce 'pending'/'failed' orders also become Abandoned Carts
      try {
        await woocommerceService.handleNativeAbandonedCart(userId, integration ? integration._id : null, orderData);
      } catch (nativeErr) {
        console.error("❌ Error running native abandoned cart logic:", nativeErr.message);
      }
    }

    // 🚀 Send Order Confirmation Template (if order was saved)
    if (savedOrder) {
      try {
        console.log("🚀 Sending Order Confirmation Template for Order:", extractedOrder.orderId);
        const result = await woocommerceService.sendOrderConfirmationWhatsApp(userId, savedOrder);

        // Update order document with WhatsApp status
        if (result && !result.error) {
          await WooCommerceOrder.updateOne(
            { _id: savedOrder._id },
            {
              $set: {
                whatsappStatus: "sent",
                whatsapp_sent_at: new Date()
              }
            }
          );
          console.log("✅ Order Confirmation Template Sent Successfully for Order:", extractedOrder.orderId);
        } else {
          await WooCommerceOrder.updateOne(
            { _id: savedOrder._id },
            {
              $set: {
                whatsappStatus: "failed"
              }
            }
          );
          console.log("❌ Order Confirmation Template Send Failed for Order:", extractedOrder.orderId, result?.error);
        }
      } catch (err) {
        console.error("❌ Template Send Failed:", err?.response?.data || err.message || err);
        // Update order with failed status
        try {
          await WooCommerceOrder.updateOne(
            { _id: savedOrder._id },
            {
              $set: {
                whatsappStatus: "failed"
              }
            }
          );
        } catch (updateErr) {
          console.error("❌ Failed to update order status:", updateErr.message);
        }
      }
    }

    // ALWAYS RETURN 200 FOR WEBHOOK SUCCESS
    return res.status(200).json({
      success: true,
      message: "Webhook processed successfully",
      orderId: extractedOrder.orderId
    });
  } catch (err) {
    console.error("❌ Webhook Controller Error:", err.message);
    return res.status(200).json({ success: true });
  }
};

/* ================= LEGACY / OTHER CONTROLLERS ================= */

exports.getStatus = async (req, res) => {
  try {
    const integration = await WooCommerceIntegration.findByUserIdWithKeys(req.userId);
    res.json({
      success: true,
      data: integration ? {
        connected: integration.status === "connected",
        store_url: integration.storeUrl,
        storeUrl: integration.storeUrl,
        consumerKey: integration.consumerKey ? "******" : null,
        consumerSecret: integration.consumerSecret ? "******" : null,
        webhookToken: integration.webhookToken,
        webhookSecret: integration.webhookSecret, // Send decrypted secret for display
        webhookStatus: integration.webhookStatus,
        settings: integration.settings,
        userId: integration.userId || req.userId,
        updatedAt: integration.updatedAt
      } : { connected: false }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.connect = async (req, res) => {
  try {
    const { storeUrl, consumerKey, consumerSecret } = req.body;
    const integration = await woocommerceService.connectStore(req.userId, { storeUrl, consumerKey, consumerSecret });

    // Auto-update integration status
    const userStatusService = require("../services/userStatusService");
    await userStatusService.updateUserIntegrationStatus(req.userId);

    res.json({ success: true, message: "WooCommerce connected", data: integration });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.test = async (req, res) => {
  try {
    const { storeUrl, consumerKey, consumerSecret } = req.body;
    await woocommerceService.testConnection({ storeUrl, consumerKey, consumerSecret });
    res.json({ success: true, message: "Connection successful" });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.disconnect = async (req, res) => {
  try {
    await woocommerceService.disconnect(req.userId);

    // Auto-update integration status
    const userStatusService = require("../services/userStatusService");
    await userStatusService.updateUserIntegrationStatus(req.userId);

    res.json({ success: true, message: "Disconnected" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.saveSettings = async (req, res) => {
  try {
    const integration = await WooCommerceIntegration.findOne({ userId: req.userId });
    if (!integration) return res.status(404).json({ success: false, error: "Integration not found" });
    const settings = req.body.settings || {};

    // Explicit sanitization for templates
    ['abandonedCartTemplate', 'orderConfirmationTemplate', 'codConfirmationTemplate'].forEach(key => {
      if (settings[key] === "" || settings[key] === undefined) {
        settings[key] = null;
      }
    });

    integration.settings = { ...integration.settings, ...settings };
    await integration.save();
    res.json({ success: true, data: integration.settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ================= ORDER MANAGEMENT ================= */

exports.getOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const query = { userId: req.userId };
    if (status) query.status = status;

    const orders = await WooCommerceOrder.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await WooCommerceOrder.countDocuments(query);

    res.json({
      success: true,
      data: orders,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getOrderStats = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);
    const stats = await WooCommerceOrder.aggregate([
      { $match: { userId } },
      {
        $facet: {
          statusGroups: [
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
                totalValue: { $sum: "$totalAmount" }
              }
            }
          ],
          totalStats: [
            {
              $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                whatsappSentCount: { $sum: { $cond: ["$whatsapp_sent", 1, 0] } },
                todayOrders: {
                  $sum: {
                    $cond: [
                      { $gte: ["$createdAt", new Date(new Date().setHours(0, 0, 0, 0))] },
                      1,
                      0
                    ]
                  }
                },
                pendingOrders: {
                  $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
                }
              }
            }
          ]
        }
      }
    ]);

    const result = {
      statusGroups: stats[0].statusGroups,
      ...(stats[0].totalStats[0] || { totalOrders: 0, whatsappSentCount: 0, todayOrders: 0, pendingOrders: 0 })
    };
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await WooCommerceOrder.findOne({ userId: req.userId, orderId: req.params.id });
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ================= ABANDONED CART MANAGEMENT ================= */

exports.getAbandonedCarts = async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'abandoned' } = req.query;
    const query = { userId: req.userId, status };

    const carts = await AbandonedCart.find(query)
      .sort({ abandoned_at: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await AbandonedCart.countDocuments(query);

    res.json({
      success: true,
      data: carts,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getAbandonedCartStats = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);
    const stats = await AbandonedCart.aggregate([
      { $match: { userId, status: 'abandoned' } },
      {
        $group: {
          _id: null,
          totalCarts: { $sum: 1 },
          totalValue: { $sum: "$total_amount" },
          convertedCarts: { $sum: { $cond: [{ $eq: ["$recovered", true] }, 1, 0] } }
        }
      }
    ]);


    const result = stats[0] || { totalCarts: 0, totalValue: 0, convertedCarts: 0 };
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getAbandonedCartById = async (req, res) => {
  try {
    const userId = req.userId;
    const { cartId } = params = req.params;
    const AbandonedCart = require("../models/AbandonedCart");

    const cart = await AbandonedCart.findOne({ _id: cartId, userId });
    if (!cart) {
      return res.status(404).json({ success: false, error: "Abandoned cart not found" });
    }

    res.json({ success: true, data: cart });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.retryAbandonedCart = async (req, res) => {
  try {
    const userId = req.userId;
    const { cartId } = req.params;
    const AbandonedCart = require("../models/AbandonedCart");

    const cart = await AbandonedCart.findOne({ _id: cartId, userId });
    if (!cart) return res.status(404).json({ error: "Cart not found" });

    // Mark as sent optimistically/immediately
    cart.whatsapp_sent = true;
    cart.whatsapp_sent_at = new Date();
    await cart.save();

    // Trigger background send
    try {
      const abandonedCartService = require("../services/abandonedCartService");
      if (abandonedCartService.sendAbandonedCartTemplate) {
        await abandonedCartService.sendAbandonedCartTemplate(cart);
      }
    } catch (sendErr) {
      console.error("❌ Recovery send failed:", sendErr.message);
    }

    res.json({ success: true, message: "Recovery message triggered" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    const deleted = await WooCommerceOrder.findOneAndDelete({
      userId: req.userId,
      orderId: req.params.id
    });
    if (!deleted) return res.status(404).json({ success: false, error: "Order not found" });
    res.json({ success: true, message: "Order deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteAbandonedCart = async (req, res) => {
  try {
    const deleted = await AbandonedCart.findOneAndDelete({
      userId: req.userId,
      _id: req.params.cartId
    });
    if (!deleted) return res.status(404).json({ success: false, error: "Abandoned cart not found" });
    res.json({ success: true, message: "Cart deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
