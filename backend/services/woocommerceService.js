const crypto = require("crypto");
const axios = require("axios");
const WooCommerceIntegration = require("../models/WooCommerceIntegration");
const AbandonedCart = require("../models/AbandonedCart");
const WooCommerceOrder = require("../models/WooCommerceOrder");
const WhatsAppService = require("./whatsappService");
const Settings = require("../models/Settings");
const Template = require("../models/Template");

/* ================= CONNECT STORE ================= */
exports.connectStore = async (userId, { storeUrl, consumerKey, consumerSecret }) => {
    try {
        console.log("🚀 Starting WooCommerce connectStore service for User:", userId);

        let cleanUrl = storeUrl.trim().replace(/\/$/, "");
        if (!cleanUrl.startsWith("http")) {
            cleanUrl = "https://" + cleanUrl;
        }

        const authString = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
        await axios.get(`${cleanUrl}/wp-json/wc/v3/system_status`, {
            headers: { Authorization: `Basic ${authString}` },
            timeout: 10000
        });

        let integration = await WooCommerceIntegration.findOne({ userId });
        if (!integration) {
            integration = new WooCommerceIntegration({ userId });
        }

        integration.storeUrl = cleanUrl;
        integration.consumerKey = integration.encrypt(consumerKey);
        integration.consumerSecret = integration.encrypt(consumerSecret);
        integration.status = "connected";
        integration.connectedAt = new Date();

        const webhookSecretPlain = crypto.randomBytes(32).toString('hex');
        integration.webhookSecret = integration.encrypt(webhookSecretPlain);

        // ✅ SECURE WEBHOOK TOKEN GENERATION
        const webhookToken = crypto.randomBytes(16).toString('hex');
        integration.webhookToken = webhookToken;
        integration.webhookStatus = 'active';

        await integration.save({ validateBeforeSave: false });

        try {
            const backendBaseUrl = process.env.BACKEND_BASE_URL || "https://wauto-backend.onrender.com";
            // ✅ Only ONE backend webhook
            const deliveryUrl = `${backendBaseUrl}/api/webhooks/woocommerce/${userId}`;

            const topics = ["order.created", "order.updated"];
            for (const topic of topics) {
                try {
                    await axios.post(`${cleanUrl}/wp-json/wc/v3/webhooks`, {
                        name: `WAuto - ${topic}`,
                        topic: topic,
                        delivery_url: deliveryUrl, // Always points to backend
                        secret: webhookSecretPlain
                    }, { headers: { Authorization: `Basic ${authString}` } });
                } catch (e) { console.log(`Webhook reg failed for ${topic}: ${e.response?.status}`); }
            }
        } catch (e) { }

        // Trigger background sync of historical orders
        exports.fetchAndSyncHistoricalOrders(userId).catch(err => {
            console.error("❌ Background historical order sync failed:", err.message);
        });

        return integration;
    } catch (error) {
        throw error;
    }
};

/* ================= SAVE ORDER TO COLLECTION ================= */
exports.saveOrder = async (userId, order) => {
    try {
        if (!userId || !order.id) return;

        console.log(`📦 [Webhook] Processing Order #${order.id} | Status: ${order.status} | User: ${userId}`);

        // 1. Fetch current order state to check for transition
        const previousOrder = await WooCommerceOrder.findOne({ userId, orderId: order.id }).lean();

        const orderData = {
            userId: userId,
            orderId: order.id,
            orderNumber: order.number || order.id.toString(),
            status: order.status,
            totalAmount: parseFloat(order.total || 0),
            currency: order.currency || 'INR',
            customerName: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim() || 'Customer',
            customerEmail: order.billing?.email?.toLowerCase(),
            customerPhone: order.billing?.phone,
            billing: order.billing,
            shipping: order.shipping,
            lineItems: order.line_items,
            paymentMethod: order.payment_method_title,
            metaData: order.meta_data,
            rawPayload: order,
            updatedAt: new Date()
        };

        // 2. Persist the order
        const updatedOrder = await WooCommerceOrder.findOneAndUpdate(
            { userId: userId, orderId: order.id },
            { $set: orderData },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        console.log(`✅ Order #${order.id} saved. New Status: ${order.status} | Prev WhatsApp Sent: ${previousOrder?.whatsapp_sent || false}`);

        // 3. Trigger Condition Logic
        // We trigger if:
        // - Order is 'processing' OR 'completed' (paid/confirmed state)
        // - AND WhatsApp hasn't been sent yet for this order
        const isPaidStatus = ['processing', 'completed'].includes(order.status);
        const wasAlreadySent = previousOrder?.whatsapp_sent === true || updatedOrder.whatsapp_sent === true;

        console.log(`🔄 Trigger Check: isPaidStatus=${isPaidStatus}, wasAlreadySent=${wasAlreadySent}`);

        if (isPaidStatus && !wasAlreadySent) {
            console.log(`🎯 Trigger Hit! Starting background WhatsApp send for Order #${order.id}`);
            // Run in background
            this.sendOrderConfirmationWhatsApp(userId, updatedOrder).catch(err => {
                console.error("❌ Background Order Confirmation Error:", err.message);
            });
        }

    } catch (error) {
        console.error("❌ Error in saveOrder:", error.message);
    }
};

/* ================= SEND ORDER CONFIRMATION WHATSAPP ================= */
exports.sendOrderConfirmationWhatsApp = async (userId, order) => {
    try {
        console.log(`� [WhatsApp] Sending Order Confirmation Template for Order: ${order.orderId}`);

        // 1. Get WooCommerce Integration settings
        const integration = await WooCommerceIntegration.findOne({ userId }).lean();
        if (!integration) {
            console.log(`ℹ️ No WooCommerce integration found for User ${userId}`);
            return { error: 'No WooCommerce integration found' };
        }

        const config = integration.settings || {};
        console.log(`⚙️ Integration Settings:`, JSON.stringify(config));

        const isEnabled = config.enableOrderConfirmation;
        const templateId = config.orderConfirmationTemplate;

        console.log(`📋 Order Confirmation Settings: enabled=${isEnabled}, templateId=${templateId}`);

        if (!isEnabled) {
            console.log(`ℹ️ Order Confirmation is disabled for User ${userId}`);
            return { error: 'Order Confirmation is disabled' };
        }

        if (!templateId) {
            console.log(`ℹ️ No Order Confirmation template selected for User ${userId}`);
            return { error: 'No Order Confirmation template selected' };
        }

        // 2. Resolve Template Name
        console.log(`📄 Finding template with ID: ${templateId}`);
        const template = await Template.findById(templateId).lean();

        if (!template) {
            console.error(`❌ Template not found for ID: ${templateId}`);
            return { error: 'Template not found' };
        }

        const metaTemplateName = template.metaTemplateName;
        const templateLanguage = template.language || "en_US";
        console.log(`✅ Resolved template: ${metaTemplateName} (${templateLanguage})`);

        // 3. Validate Phone
        let phone = order.customerPhone || order.billing?.phone;
        if (!phone) {
            console.warn(`⚠️ Phone missing for Order #${order.orderId}, cannot send.`);
            return { error: 'Customer phone number missing' };
        }

        // Clean and format phone number
        phone = phone.replace(/[^0-9]/g, ''); // Remove all non-digits
        if (phone.length < 10) {
            console.warn(`⚠️ Invalid phone format for Order #${order.orderId}: ${phone}`);
            return { error: 'Invalid phone number format' };
        }

        // Remove leading + if present and ensure country code
        if (phone.startsWith('91') && phone.length === 12) {
            phone = phone.substring(2); // Remove 91 prefix for Indian numbers
        } else if (phone.startsWith('0')) {
            phone = phone.substring(1); // Remove leading 0
        }

        // 4. Get first product name
        const firstProductName = order.lineItems && order.lineItems.length > 0
            ? order.lineItems[0].name
            : 'Product';

        // 5. Prepare Template Parameters
        const customerName = order.customerName || 'Customer';
        const orderId = order.orderNumber || order.orderId;
        const totalAmount = `${order.currency || 'INR'} ${order.totalAmount}`;

        const { buildTemplatePayload } = require('../utils/templateUtils');
        const availableParams = [
            customerName,
            orderId,
            totalAmount,
            firstProductName
        ];

        const bodyParams = buildTemplatePayload(template, availableParams);

        console.log(`� Template Payload:`, {
            template: metaTemplateName,
            language: templateLanguage,
            phone: phone,
            params: bodyParams
        });

        // 6. Call WhatsApp Service
        const result = await WhatsAppService.sendTemplateMessage({
            userId: userId,
            to: phone,
            templateName: metaTemplateName,
            language: templateLanguage,
            bodyParams: bodyParams
        });

        // 7. Log Result
        if (result && !result.error) {
            console.log(`✅ Order Confirmation Template Sent Successfully for Order #${order.orderId}`);
            return { success: true, messageId: result.messages?.[0]?.id };
        } else {
            console.error(`❌ Order Confirmation Template Send Failed for Order #${order.orderId}:`, result?.error);
            return { error: result?.error || 'Unknown error' };
        }

    } catch (error) {
        console.error(`❌ [WhatsApp Service Error]:`, error.message);
        console.error(`❌ Full Error Response:`, error?.response?.data || 'No response data');
        return { error: error.message };
    }
};

/* ================= WEBHOOK PROCESSORS ================= */
exports.processOrderCreated = async (userId, integrationId, order) => {
    await this.saveOrder(userId, order);
    await this.handleNativeAbandonedCart(userId, integrationId, order);
};

exports.processOrderUpdated = async (userId, integrationId, order) => {
    await this.saveOrder(userId, order);
    await this.handleNativeAbandonedCart(userId, integrationId, order);
};

/* ================= GOKWIK HANDLER ================= */
exports.processGokwikAbandonedCart = async (userId, payload) => {
    try {
        console.log(`🛒 Processing Gokwik Abandoned Cart for User: ${userId}`);

        const cartId = payload.cart_id || payload.id;
        if (!cartId) throw new Error("Missing cart_id in Gokwik payload");

        const items = (payload.items || payload.cart_items || []).map(item => ({
            name: item.name || item.product_name,
            quantity: item.quantity || 1,
            price: parseFloat(item.price || 0),
            total: parseFloat(item.total || item.price || 0),
            image: item.image || item.product_image || ''
        }));

        // 🔥 Robust Phone Extraction
        let phone =
            payload.customer?.phone ||
            payload.customer_phone ||
            payload.phone ||
            payload.mobile ||
            payload.user?.phone ||
            null;

        if (phone) {
            phone = phone.toString().replace(/\D/g, '');
            if (phone.length === 10) phone = "91" + phone;
            if (phone.length < 10) phone = null;
        }

        const cartData = {
            userId: userId,
            cart_id: cartId.toString(),
            customer_name: payload.customer?.name || payload.customer_name || 'Customer',
            customer_email: payload.customer?.email || payload.customer_email,
            customer_phone: phone,   // ✅ FIXED
            cart_items: items,
            total_amount: parseFloat(payload.total?.amount || payload.total_amount || 0),
            currency: payload.currency || 'INR',
            status: 'abandoned',
            store_url: payload.store_url,
            recovery_url: payload.recovery_url,
            abandoned_at: new Date(),
            updated_at: new Date()
        };

        await AbandonedCart.findOneAndUpdate(
            { userId: userId, cart_id: cartId.toString() },
            { $set: cartData },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        console.log(`✅ Gokwik Abandoned Cart Upserted: ${cartId}`);
        return { success: true };

    } catch (error) {
        console.error("❌ Error in processGokwikAbandonedCart:", error.message);
        throw error;
    }
};

/* ================= CORE ABANDONED CART LOGIC ================= */
exports.handleNativeAbandonedCart = async (userId, integrationId, order) => {
    try {
        if (!userId) return;

        const status = order.status;
        const needsPayment = status === 'pending' || status === 'failed';
        const isPaid = order.date_paid != null;
        const isConverted = ['processing', 'completed', 'on-hold'].includes(status);

        if (needsPayment && !isPaid && status !== 'cancelled' && status !== 'refunded') {
            console.log(`⚠️ Order ${order.id} is ${status} (Unpaid) -> Marking as Abandoned`);

            const items = (order.line_items || []).map(item => ({
                name: item.name,
                quantity: item.quantity,
                price: parseFloat(item.price || 0),
                total: parseFloat(item.total || 0),
                product_id: item.product_id,
                image: item.image?.src || ''
            }));

            const selfLink = order._links?.self?.[0]?.href || '';
            let storeUrlFromOrder = '';
            try { if (selfLink) storeUrlFromOrder = new URL(selfLink).origin; } catch (e) { }

            await AbandonedCart.findOneAndUpdate(
                { userId: userId, cart_id: order.id.toString() },
                {
                    $set: {
                        userId: userId,
                        wooCommerceStoreId: integrationId,
                        customer_name: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim() || 'Customer',
                        customer_email: order.billing?.email?.toLowerCase(),
                        customer_phone: order.billing?.phone,
                        cart_items: items,
                        total_amount: parseFloat(order.total || 0),
                        currency: order.currency || 'INR',
                        status: 'abandoned',
                        payment_url: order.payment_url || '',
                        woo_order_id: order.id,
                        woo_order_number: order.number,
                        store_url: storeUrlFromOrder,
                        abandoned_at: new Date(),
                        updated_at: new Date()
                    }
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            console.log(`✅ Abandoned Cart Saved/Updated: ${order.id}`);
        }

        else if (isConverted || isPaid) {
            const cart = await AbandonedCart.findOne({
                userId: userId,
                cart_id: order.id.toString()
            });

            if (cart && cart.status !== 'converted') {
                cart.status = 'converted';
                cart.recovered = true;
                cart.recovered_at = new Date();
                cart.updated_at = new Date();
                await cart.save();
                console.log(`✅ Cart ${order.id} marked as CONVERTED`);
            }
        }

    } catch (error) {
        console.error("❌ Error in handleNativeAbandonedCart:", error.message);
    }
};

/* ================= THIRD-PARTY ABANDONED CART PROCESSING ================= */
exports.processThirdPartyAbandonedCarts = async (carts, userId = null) => {
    try {
        if (!Array.isArray(carts) || carts.length === 0) {
            console.log("ℹ️ No carts to process");
            return;
        }

        console.log(`🔄 Processing ${carts.length} third-party cart(s)`);

        for (const cart of carts) {
            try {
                if (!cart || !cart.id) {
                    console.warn("⚠️ Skipping cart without ID");
                    continue;
                }

                console.log(`\n📦 ========== PROCESSING CART #${cart.id} ==========`);

                // Extract cart items
                const items = (cart.items || []).map(item => ({
                    id: item.id,
                    title: item.title || item.product_title || 'Product',
                    product_id: item.product_id,
                    variant_id: item.variant_id,
                    sku: item.sku,
                    quantity: item.quantity || 1,
                    price: parseFloat(item.price || item.final_price || 0),
                    total: parseFloat(item.line_price || item.final_line_price || 0),
                    image: item.image || '',
                    vendor: item.vendor,
                    product_type: item.product_type
                }));

                console.log(`📋 Cart Items:`, JSON.stringify(items, null, 2));

                // Extract customer information
                const customerPhone = cart['Address.phone'] ||
                    cart['Customer.phone_mask'] ||
                    cart.customer_phone ||
                    '';

                const customerEmail = cart['Address.email'] ||
                    cart['Customer.email_mask'] ||
                    cart.customer_email ||
                    '';

                const customerFirstName = cart['Address.firstname'] ||
                    cart['Customer.firstname'] ||
                    '';

                const customerLastName = cart['Address.lastname'] ||
                    cart['Customer.lastname'] ||
                    '';

                const customerName = `${customerFirstName} ${customerLastName}`.trim() ||
                    cart['Merchant.short_name'] ||
                    'Customer';

                console.log(`👤 Customer Info:`);
                console.log(`   Name: ${customerName}`);
                console.log(`   Email: ${customerEmail}`);
                console.log(`   Phone: ${customerPhone}`);

                // Extract other details
                const isAbandoned = cart.is_abandoned === true;
                const totalPrice = parseFloat(cart.total_price || cart.original_total_price || 0);
                const currency = cart.currency || 'INR';
                const recoveryUrl = cart.abc_url || cart.recovery_url || '';
                const storeUrl = cart.store_url || '';
                const merchantName = cart['Merchant.short_name'] || '';

                console.log(`💰 Order Details:`);
                console.log(`   Total: ${currency} ${totalPrice}`);
                console.log(`   Status: ${isAbandoned ? 'ABANDONED' : 'ACTIVE'}`);
                console.log(`   Recovery URL: ${recoveryUrl}`);
                console.log(`   Merchant: ${merchantName}`);

                // Save to database
                const cartData = {
                    userId: userId,
                    cart_id: String(cart.id),
                    customer_name: customerName,
                    customer_email: customerEmail,
                    customer_phone: customerPhone,
                    cart_items: items,
                    total_amount: totalPrice,
                    currency: currency,
                    status: isAbandoned ? 'abandoned' : 'active',
                    recovery_url: recoveryUrl,
                    store_url: storeUrl,
                    merchant_name: merchantName,
                    is_abandoned: isAbandoned,
                    abandoned_at: cart.created_at ? new Date(cart.created_at) : new Date(),
                    updated_at: new Date(),
                    source: 'third_party',
                    raw_payload: cart
                };

                const query = { cart_id: String(cart.id) };
                if (userId) query.userId = userId;

                const result = await AbandonedCart.findOneAndUpdate(
                    query,
                    { $set: cartData },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );

                console.log(`✅ Cart #${cart.id} saved to database`);
                console.log(`   Cart ID in DB: ${result._id}`);

            } catch (cartError) {
                console.error(`❌ Error processing cart #${cart.id}:`, cartError.message);
            }
        }

        console.log(`\n✨ Completed processing ${carts.length} cart(s)`);

    } catch (error) {
        console.error("❌ Error in processThirdPartyAbandonedCarts:", error.message);
    }
};

/* ================= SYNC HISTORICAL ORDERS ================= */
exports.fetchAndSyncHistoricalOrders = async (userId) => {
    try {
        console.log(`🔄 Starting historical WooCommerce order sync for User: ${userId}`);
        const integration = await WooCommerceIntegration.findByUserIdWithKeys(userId);
        if (!integration || integration.status !== "connected") {
            console.log(`ℹ️ WooCommerce not connected for User ${userId}. Skipping historical sync.`);
            return 0;
        }

        const storeUrl = integration.storeUrl;
        const consumerKey = integration.consumerKey;
        const consumerSecret = integration.consumerSecret;

        if (!storeUrl || !consumerKey || !consumerSecret) {
            console.warn(`⚠️ WooCommerce credentials missing for User ${userId}`);
            return 0;
        }

        const authString = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
        
        let page = 1;
        let hasMore = true;
        const limit = 100;
        let allOrders = [];
        const maxPages = 5; // Fetch up to 500 orders which is plenty for initial sync and fast

        while (hasMore && page <= maxPages) {
            console.log(`📡 Fetching WC orders page ${page}...`);
            try {
                const response = await axios.get(`${storeUrl}/wp-json/wc/v3/orders`, {
                    params: {
                        per_page: limit,
                        page: page
                    },
                    headers: { Authorization: `Basic ${authString}` },
                    timeout: 15000
                });
                
                const fetchedOrders = response.data;
                if (Array.isArray(fetchedOrders) && fetchedOrders.length > 0) {
                    allOrders = allOrders.concat(fetchedOrders);
                    if (fetchedOrders.length < limit) {
                        hasMore = false;
                    } else {
                        page++;
                    }
                } else {
                    hasMore = false;
                }
            } catch (fetchErr) {
                console.error(`❌ Error fetching WooCommerce orders page ${page}:`, fetchErr.message);
                hasMore = false; // Stop paging on error
            }
        }

        console.log(`📦 Fetched ${allOrders.length} orders from WooCommerce API. Syncing to database...`);

        let syncedCount = 0;
        for (const order of allOrders) {
            try {
                if (!order.id) continue;

                // Normalize line items
                const lineItems = (order.line_items || []).map(item => ({
                    ...item,
                    product_id: item.product_id || item.id,
                    name: item.name || 'Product',
                    productName: item.name || 'Product',
                    price: parseFloat(item.price || 0),
                    quantity: parseInt(item.quantity || 1),
                    total: parseFloat(item.total || (item.price * item.quantity) || 0)
                }));

                const orderData = {
                    userId: userId,
                    orderId: order.id,
                    orderNumber: order.number || order.id.toString(),
                    status: order.status,
                    totalAmount: parseFloat(order.total || 0),
                    currency: order.currency || 'INR',
                    customerName: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim() || 'Customer',
                    customerEmail: order.billing?.email?.toLowerCase(),
                    customerPhone: order.billing?.phone,
                    billing: order.billing || {},
                    shipping: order.shipping || {},
                    lineItems: lineItems,
                    paymentMethod: order.payment_method_title,
                    metaData: order.meta_data || {},
                    dateCreated: order.date_created || new Date(),
                    rawPayload: order,
                    updatedAt: new Date()
                };

                await WooCommerceOrder.findOneAndUpdate(
                    { userId: userId, orderId: order.id },
                    { $set: orderData },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
                syncedCount++;
            } catch (dbErr) {
                console.error(`❌ Error syncing WC order #${order?.id} to DB:`, dbErr.message);
            }
        }

        console.log(`✅ Completed historical WooCommerce order sync. Synced ${syncedCount} orders.`);
        return syncedCount;
    } catch (error) {
        console.error("❌ Error in fetchAndSyncHistoricalOrders:", error.message);
        return 0;
    }
};

/* ================= UTILS ================= */
exports.testConnection = async (params) => { return true; };

exports.disconnect = async (userId) => {
    await WooCommerceIntegration.findOneAndUpdate({ userId }, { status: 'not_connected' });
};

exports.updateCart = async (userId, cartData) => { };
