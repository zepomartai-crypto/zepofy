const crypto = require('crypto');
const axios = require('axios');
const ShopifyIntegration = require('../models/ShopifyIntegration');
const ShopifyOrder = require('../models/ShopifyOrder');
const ShopifyAbandonedCheckout = require('../models/ShopifyAbandonedCheckout');
const whatsappService = require('../services/whatsappService');
const Template = require('../models/Template');
const Settings = require('../models/Settings');
const WebhookLog = require('../models/WebhookLog');
const { normalizePhone } = require('../utils/internationalPhoneNormalizer');
const flowEngine = require('../modules/flowBuilder/flow.engine');

class ShopifyController {

    constructor() {
        console.log('🛡️ [Shopify Controller] SHOPIFY_WEBHOOK_SECRET detected:', !!process.env.SHOPIFY_WEBHOOK_SECRET);
    }

    /**
     * Validate Shopify access token
     */
    async validateAccessToken(storeDomain, accessToken) {
        try {
            const apiVersion = "2024-10";
            const response = await axios.get(`https://${storeDomain}/admin/api/${apiVersion}/shop.json`, {
                headers: {
                    'X-Shopify-Access-Token': accessToken,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            return response.data.shop ? { valid: true, shop: response.data.shop } : { valid: false };
        } catch (error) {
            return { valid: false, error: error.response?.data?.errors || error.message };
        }
    }

    /**
     * POST /api/shopify/generate-access-token
     * Direct Token Generation Model (Botbiz Style)
     */


    async generateAccessToken(req, res) {
        try {
            const { store, client_id, client_secret } = req.body;
            const userId = req.userId || req.user?._id;

            if (!store || !client_id || !client_secret) {
                return res.status(400).json({ success: false, error: "Store, Client ID, and Client Secret are required." });
            }

            const trimmedStore = store.toLowerCase().trim().replace(/^https?:\/\//, '').split(/[./]/)[0];
            const trimmedClientId = client_id ? client_id.trim() : '';
            const trimmedClientSecret = client_secret ? client_secret.trim().replace(/[\u200B-\u200D\uFEFF\r\n]/g, '') : '';
            const shopUrl = `${trimmedStore}.myshopify.com`;

            console.log(`🔌 [Shopify Direct] Resolving connection for: ${shopUrl}`);

            let access_token = null;
            let scope = "custom";

            const standardHeaders = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Zepofy-Wauto-Setup/1.0.0 (Wauto SaaS Integration)'
            };

            // --- PROBE 1: Try Client Secret as a Direct Access Token (Recommended for Custom Apps) ---
            console.log("🕵️ [Shopify Direct] Probing Client Secret as direct access token...");
            try {
                const validation = await this.validateAccessToken(shopUrl, trimmedClientSecret);

                if (validation.valid) {
                    console.log("🎟️ [Shopify Direct] Probe Success! Using Client Secret as Admin API Access Token.");
                    access_token = trimmedClientSecret;
                    const shopId = String(validation.shop.id);

                    // Save to Database - Use .save() for encryption hooks
                    let integration = await ShopifyIntegration.findOne({ userId });
                    if (!integration) integration = new ShopifyIntegration({ userId });

                    integration.storeDomain = shopUrl;
                    integration.shopId = shopId;
                    integration.accessToken = access_token;
                    integration.clientId = trimmedClientId;
                    integration.clientSecret = trimmedClientSecret;
                    integration.scope = scope;
                    integration.status = 'connected';
                    integration.connectedAt = new Date();
                    integration.lastSyncAt = new Date();

                    await integration.save();
                    console.log(`✅ [Shopify Direct] Access Token verified and saved for ${shopUrl}. Length: ${access_token.length}`);

                    // Update Master Settings
                    await Settings.findOneAndUpdate({ userId }, {
                        "shopify.connected": true,
                        "shopify.storeDomain": shopUrl
                    });

                    // Background Sync and Webhooks
                    this._provisionWebhooks(shopUrl, access_token, userId);
                    this._syncInitialData(shopUrl, access_token, userId);

                    return res.json({
                        success: true,
                        message: "Access token validated and syncing started!",
                        data: { storeDomain: shopUrl }
                    });
                } else {
                    console.log("❌ [Shopify Direct] Token validation failed:", validation.error);
                }
            } catch (probeErr) {
                console.log("ℹ️ [Shopify Direct] Secret probe failed or rejected. Response:", probeErr.response?.data?.errors || probeErr.message);
            }

            // --- PROBE 2: Standard OAuth exchange fallback ---
            try {
                const shopifyResponse = await axios.post(`https://${shopUrl}/admin/oauth/access_token`, {
                    client_id: trimmedClientId,
                    client_secret: trimmedClientSecret,
                    grant_type: "client_credentials"
                }, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 10000
                });

                const { access_token: exchanged_token, scope: exchanged_scope } = shopifyResponse.data;

                // Validate the exchanged token
                const validation = await this.validateAccessToken(shopUrl, exchanged_token);
                if (!validation.valid) {
                    throw new Error(`OAuth token validation failed: ${validation.error}`);
                }

                const shopId = String(validation.shop.id);

                let integration = await ShopifyIntegration.findOne({ userId });
                if (!integration) integration = new ShopifyIntegration({ userId });

                integration.storeDomain = shopUrl;
                integration.shopId = shopId;
                integration.accessToken = exchanged_token;
                integration.clientId = trimmedClientId;
                integration.clientSecret = trimmedClientSecret;
                integration.scope = exchanged_scope;
                integration.status = 'connected';
                await integration.save();

                await Settings.findOneAndUpdate({ userId }, { "shopify.connected": true, "shopify.storeDomain": shopUrl });

                this._provisionWebhooks(shopUrl, exchanged_token, userId);
                this._syncInitialData(shopUrl, exchanged_token, userId);

                return res.json({ success: true, message: "Connected via OAuth!", data: { storeDomain: shopUrl } });

            } catch (err) {
                console.error("❌ [Shopify Direct] Auth Failed:", err.response?.data || err.message);
                const errorDetail = err.response?.data?.error_description || err.response?.data?.error || err.message || "Invalid Credentials.";
                return res.status(401).json({ success: false, error: errorDetail });
            }

        } catch (error) {
            console.error("❌ Shopify Token Generation Failed:", error.message);
            res.status(500).json({ success: false, error: "Internal server error during token generation." });
        }
    }

    async _syncInitialData(shop, token, userId) {
        try {
            console.log(`🔄 [Shopify Sync] Starting initial sync for ${shop}`);

            const syncHeaders = {
                'X-Shopify-Access-Token': token,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Zepofy-Wauto-Initial/1.0.0 (Wauto SaaS Integration)'
            };

            // 1. Fetch Orders (Last 50)
            try {
                const apiVersion = "2024-10";
                const ordersRes = await axios({
                    method: 'get',
                    url: `https://${shop}/admin/api/${apiVersion}/orders.json?limit=50&status=any`,
                    headers: syncHeaders,
                    timeout: 20000
                });

                const orders = ordersRes.data.orders || [];
                for (const order of orders) {
                    await ShopifyOrder.findOneAndUpdate(
                        { userId, shopifyOrderId: String(order.id) },
                        {
                            userId,
                            shopifyOrderId: String(order.id),
                            orderNumber: String(order.order_number),
                            orderStatus: order.financial_status,
                            orderTotal: parseFloat(order.total_price),
                            currency: order.currency,
                            customerName: `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim() || 'Guest',
                            customerPhone: order.customer?.phone || order.billing_address?.phone,
                            customerEmail: order.email,
                            trackingLink: order.order_status_url,
                            createdAt: new Date(order.created_at),
                            rawPayload: order
                        },
                        { upsert: true }
                    );
                }
            } catch (e) {
                console.error("❌ [Shopify Sync] Orders fetch failed:", e.message);
            }

            // 2. Fetch Latest Checkouts (Abandoned)
            try {
                const apiVersion = "2024-10";
                const checkoutsRes = await axios({
                    method: 'get',
                    url: `https://${shop}/admin/api/${apiVersion}/checkouts.json`,
                    headers: syncHeaders,
                    timeout: 20000
                });

                const checkouts = checkoutsRes.data.checkouts || [];
                for (const checkout of checkouts) {
                    const phone = checkout.customer?.phone || checkout.phone || checkout.billing_address?.phone;
                    if (phone) {
                        await ShopifyAbandonedCheckout.findOneAndUpdate(
                            { userId, checkoutId: String(checkout.id) },
                            {
                                userId,
                                checkoutId: String(checkout.id),
                                customerPhone: phone,
                                customerName: `${checkout.customer?.first_name || ''} ${checkout.customer?.last_name || ''}`.trim() || 'Guest',
                                customerEmail: checkout.email || checkout.customer?.email,
                                cartValue: parseFloat(checkout.total_price),
                                currency: checkout.currency,
                                checkoutUrl: checkout.abandoned_checkout_url,
                                abandonedAt: new Date(checkout.updated_at || checkout.created_at),
                                rawPayload: checkout
                            },
                            { upsert: true }
                        );
                    }
                }
            } catch (e) {
                console.error("❌ [Shopify Sync] Checkouts fetch failed:", e.message);
            }

            // Update Sync Time
            await ShopifyIntegration.updateOne({ userId }, { lastSyncAt: new Date() });
            console.log(`✅ [Shopify Sync] Finished initial sync for ${shop}.`);

        } catch (err) {
            console.error(`❌ [Shopify Sync] Initial sync failed for ${shop}:`, err.message);
        }
    }

    /**
     * Automated Webhook Registration
     */
    async _provisionWebhooks(shop, token, userId) {
        // Handle Localhost vs Production URL
        let baseUrl = process.env.BASE_URL || process.env.SERVER_URL || 'https://wauto-backend.onrender.com';

        // If dev, we might need to use ngrok if configured
        if (process.env.NODE_ENV === 'development' && process.env.NGROK_URL) {
            baseUrl = process.env.NGROK_URL;
        }

        const topics = [
            { topic: 'orders/create', path: 'orders-create' },
            { topic: 'orders/updated', path: 'orders-updated' },
            { topic: 'checkouts/update', path: 'checkouts-update' },
            { topic: 'app/uninstalled', path: 'app-uninstalled' }
        ];

        let webhookIds = [];
        let status = 'active';

        for (const { topic, path } of topics) {
            try {
                const apiVersion = "2024-10";
                const response = await axios.post(`https://${shop}/admin/api/${apiVersion}/webhooks.json`, {
                    webhook: {
                        topic,
                        address: `${baseUrl}/api/webhooks/shopify`,
                        format: "json"
                    }
                }, {
                    headers: {
                        'X-Shopify-Access-Token': token,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.data.webhook) {
                    webhookIds.push({
                        id: String(response.data.webhook.id),
                        topic: response.data.webhook.topic,
                        address: response.data.webhook.address
                    });
                    console.log(`✅ Webhook provisioned: ${topic}`);
                }
            } catch (err) {
                // If it already exists (422), we should try to fetch it or ignore
                if (err.response?.status === 422) {
                    console.warn(`⚠️ Webhook already exists for ${topic}: ${err.response?.data?.errors?.address?.[0] || 'Already configured'}`);
                } else {
                    console.error(`❌ Webhook failed for ${topic}:`, err.response?.data || err.message);
                    status = 'failed';
                }
            }
        }

        // Update integration with webhook status and IDs using UPSERT to ensure one record per user
        await ShopifyIntegration.findOneAndUpdate(
            { userId },
            {
                webhookStatus: status,
                webhooks: webhookIds
            },
            { upsert: true }
        );
    }

    /* =========================================================================
       WEBHOOK PROCESSING (HMAC SECURED)
       ========================================================================= */

    _verifySignature(req, secret) {
        try {
            const hmac = req.headers['x-shopify-hmac-sha256'];
            const rawBody = req.body;

            // 1. Check for basic requirements
            if (!hmac || !secret || !rawBody || !Buffer.isBuffer(rawBody)) {
                console.error("❌ [Shopify HMAC] Missing requirements:", {
                    hasHmac: !!hmac,
                    hasSecret: !!secret,
                    hasRawBody: !!rawBody,
                    isBuffer: Buffer.isBuffer(rawBody)
                });
                return false;
            }

            // 2. Check for placeholder secret
            const cleanSecret = secret.trim();
            if (cleanSecret === 'your_shopify_webhook_secret_here') {
                console.warn("⚠️ [Shopify HMAC] SHOPIFY_WEBHOOK_SECRET is still set to the placeholder value. Verification will likely fail.");
            }

            // 3. Generate HMAC SHA256 (Shopify expects Base64)
            const generated = crypto
                .createHmac('sha256', cleanSecret)
                .update(rawBody)
                .digest('base64');

            // 4. Constant-time comparison
            const hmacBuffer = Buffer.from(hmac, 'utf8');
            const generatedBuffer = Buffer.from(generated, 'utf8');

            if (hmacBuffer.length !== generatedBuffer.length) {
                console.error(`❌ [Shopify HMAC] Length mismatch: ${hmacBuffer.length} vs ${generatedBuffer.length}`);
                return false;
            }

            const isValid = crypto.timingSafeEqual(hmacBuffer, generatedBuffer);

            if (!isValid) {
                console.error(`❌ [Shopify HMAC] Mismatch for store ${req.headers['x-shopify-shop-domain'] || 'unknown'}`);
                console.log(`ℹ️ Received Signature: ${hmac}`);
                console.log(`ℹ️ Expected Signature: ${generated}`);
                console.log(`ℹ️ Secret used starts with: ${cleanSecret.substring(0, 4)}...`);
            }

            return isValid;
        } catch (err) {
            console.error("❌ [Shopify Webhook] Verification Exception:", err.message);
            return false;
        }
    }

    /* =========================================================================
       WEBHOOK PROCESSING (UNIFIED & ASYNC)
       ========================================================================= */

    async handleWebhook(req, res) {
        const topic = req.headers["x-shopify-topic"];
        const shopDomain = req.headers["x-shopify-shop-domain"];

        console.log("🔥 Shopify Webhook HIT", topic, "from", shopDomain);

        if (!topic || !shopDomain) {
            return res.status(400).send("Missing Shopify Headers");
        }

        try {
            // 1. Identify Merchant
            const integration = await ShopifyIntegration.findByShopIdOrDomainWithKeys(null, shopDomain.toLowerCase());

            if (!integration || integration.status !== 'connected') {
                console.error(`❌ [Shopify Webhook] No connected integration found for: ${shopDomain}`);
                return res.status(404).send("Store not found");
            }

            // 2. Get the secret
            const secret = integration.webhookSecret || integration.clientSecret;
            if (!secret) {
                console.error('❌ Store has no webhook secret or client secret configured');
                return res.status(500).send("Configuration missing");
            }

            // 3. Verify Signature
            if (!this._verifySignature(req, secret)) {
                console.error('❌ Webhook Error: Invalid signature hash');
                return res.status(401).send("Invalid signature hash");
            }

            // 4. Send 200 response immediately to Shopify to prevent timeouts/retries
            res.status(200).send("OK");

            // 5. Process ASYNC in the background
            (async () => {
                try {
                    const rawBody = req.body;
                    if (!rawBody) {
                        console.error("❌ [Shopify Webhook] No body captured.");
                        return;
                    }

                    const userId = integration.userId;
                    const payload = JSON.parse(rawBody.toString());

                    switch (topic) {
                        case 'orders/create':
                            await this._processOrderCreate(payload, userId, integration);
                            break;
                        case 'orders/updated':
                            await this._processOrderUpdate(payload, userId);
                            break;
                        case 'checkouts/update':
                        case 'checkouts/create':
                            await this._processCheckoutUpdate(payload, userId);
                            break;
                        case 'app/uninstalled':
                            await this._processAppUninstall(shopDomain, userId);
                            break;
                        default:
                            console.log(`ℹ️ [Shopify Webhook] Topic skipped: ${topic}`);
                    }
                } catch (err) {
                    console.error(`❌ [Shopify Webhook] Background Process Error:`, err.message);
                }
            })();
        } catch (error) {
            console.error("❌ [Shopify Webhook] Initial Processing Error:", error.message);
            if (!res.headersSent) {
                res.status(500).send("Internal Server Error");
            }
        }
    }

    // --- Private Async Processors ---

    async _processOrderCreate(payload, userId, integration) {
        if (!payload.id) return;

        const existing = await ShopifyOrder.findOne({ userId, shopifyOrderId: String(payload.id) });
        if (existing) return;

        const orderData = {
            userId,
            shopifyOrderId: String(payload.id),
            orderNumber: String(payload.order_number),
            orderStatus: payload.financial_status,
            orderTotal: parseFloat(payload.total_price),
            currency: payload.currency,
            customerName: payload.customer ? `${payload.customer.first_name || ''} ${payload.customer.last_name || ''}`.trim() : "Guest",
            customerPhone: payload.customer?.phone || payload.billing_address?.phone,
            customerEmail: payload.email,
            trackingLink: payload.order_status_url,
            rawPayload: payload
        };

        await ShopifyOrder.create(orderData);
        console.log(`✅ [Shopify] Order saved: ${payload.id}`);

        await WebhookLog.logWebhook({ source: 'shopify', userId, topic: 'orders/create', status: 'success', payload });

        // Trigger Flow Builder
        if (orderData.customerPhone) {
            flowEngine.triggerFlowByType(userId, orderData.customerPhone, "shopify", {
                event: "order_created",
                shopifyData: payload
            });
        }

        // Automations
        if (integration?.settings?.enableOrderConfirmation && orderData.customerPhone) {
            const template = await Template.findById(integration.settings.orderConfirmationTemplate);
            const normalized = normalizePhone(orderData.customerPhone);
            if (template && normalized.success) {
                const { buildTemplatePayload } = require('../utils/templateUtils');
                const availableParams = [
                    orderData.customerName,
                    orderData.orderNumber,
                    `${orderData.currency} ${orderData.orderTotal.toFixed(2)}`,
                    orderData.trackingLink || "N/A"
                ];

                const bodyParams = buildTemplatePayload(template, availableParams);

                await whatsappService.sendTemplateMessage({
                    userId,
                    to: normalized.phoneNumber,
                    templateName: template.metaTemplateName,
                    language: template.language,
                    bodyParams: bodyParams
                });
            }
        }
    }

    async _processOrderUpdate(payload, userId) {
        if (!payload.id) return;
        const orderData = {
            orderStatus: payload.financial_status,
            fulfillmentStatus: payload.fulfillment_status,
            trackingLink: payload.order_status_url,
            rawPayload: payload,
            updatedAt: new Date()
        };
        await ShopifyOrder.findOneAndUpdate({ userId, shopifyOrderId: String(payload.id) }, orderData);
        console.log(`✅ [Shopify] Order updated: ${payload.id}`);
        await WebhookLog.logWebhook({ source: 'shopify', userId, topic: 'orders/updated', status: 'success', payload });
    }

    async _processCheckoutUpdate(payload, userId) {
        const phone = payload.customer?.phone || payload.phone || payload.billing_address?.phone;
        if (phone && payload.id) {
            const checkoutData = {
                userId,
                checkoutId: String(payload.id),
                customerPhone: phone,
                customerName: `${payload.customer?.first_name || ''} ${payload.customer?.last_name || ''}`.trim() || 'Guest',
                customerEmail: payload.email || payload.customer?.email,
                cartValue: parseFloat(payload.total_price),
                currency: payload.currency,
                checkoutUrl: payload.abandoned_checkout_url,
                abandonedAt: new Date(),
                rawPayload: payload
            };
            await ShopifyAbandonedCheckout.findOneAndUpdate(
                { userId, checkoutId: String(payload.id) },
                checkoutData,
                { upsert: true }
            );
            console.log(`✅ [Shopify] Checkout saved: ${payload.id}`);
            await WebhookLog.logWebhook({ source: 'shopify', userId, topic: 'checkouts/update', status: 'success', payload });

            // Trigger Flow Builder
            if (phone) {
                flowEngine.triggerFlowByType(userId, phone, "shopify", {
                    event: "abandoned_cart",
                    shopifyData: payload
                });
            }
        }
    }

    async _processAppUninstall(shopDomain, userId) {
        console.log(`🔌 [Shopify] Marking integration inactive for: ${shopDomain}`);
        await ShopifyIntegration.findOneAndUpdate(
            { userId },
            {
                status: 'not_connected',
                webhookStatus: 'failed'
            },
            { upsert: true }
        );
        await Settings.findOneAndUpdate({ userId }, { "shopify.connected": false });
        await WebhookLog.logWebhook({
            source: 'shopify', userId, topic: 'app/uninstalled', status: 'success', payload: { message: "App Uninstalled" }
        });
    }

    // LEGACY METHODS (Kept for routing compatibility if needed, but logic moved above)
    async handleOrderWebhook(req, res) { return this.handleWebhook(req, res); }
    async handleOrderUpdatedWebhook(req, res) { return this.handleWebhook(req, res); }
    async handleCheckoutWebhook(req, res) { return this.handleWebhook(req, res); }
    async handleAppUninstalledWebhook(req, res) { return this.handleWebhook(req, res); }

    /* =========================================================================
       UI SUPPORT & DASHBOARD
       ========================================================================= */

    async getIntegrationStatus(req, res) {
        try {
            const userId = req.userId || req.user?._id;
            const integration = await ShopifyIntegration.findOne({ userId }).select("+accessToken +clientId +clientSecret +webhookSecret");
            res.json({ success: true, connected: integration?.status === 'connected', data: integration });
        } catch (e) { res.status(500).json({ success: false }); }
    }

    async getAnalytics(req, res) {
        try {
            const userId = req.userId || req.user?._id;
            const totalOrders = await ShopifyOrder.countDocuments({ userId });
            const abandonedCarts = await ShopifyAbandonedCheckout.countDocuments({ userId });
            const integration = await ShopifyIntegration.findOne({ userId });

            res.json({
                success: true,
                stats: {
                    totalOrders,
                    totalAbandoned: abandonedCarts,
                    lastSyncAt: integration?.lastSyncAt || integration?.updatedAt,
                    webhookStatus: integration?.webhookStatus || 'pending'
                }
            });
        } catch (e) { res.status(500).json({ success: false }); }
    }

    /**
     * GET /api/shopify/orders
     */
    async getOrders(req, res) {
        try {
            const userId = req.userId || req.user?._id;
            const orders = await ShopifyOrder.find({ userId }).sort({ createdAt: -1 }).limit(100);
            res.json({ success: true, orders });
        } catch (e) { res.status(500).json({ success: false }); }
    }

    /**
     * GET /api/shopify/abandoned
     */
    async getAbandonedCheckouts(req, res) {
        try {
            const userId = req.userId || req.user?._id;
            const checkouts = await ShopifyAbandonedCheckout.find({ userId }).sort({ abandonedAt: -1 }).limit(100);
            res.json({ success: true, checkouts });
        } catch (e) { res.status(500).json({ success: false }); }
    }

    /**
     * POST /api/shopify/settings
     */
    async updateSettings(req, res) {
        try {
            const userId = req.userId || req.user?._id;
            const { settings, webhookSecret } = req.body;

            const updatePayload = {};
            if (settings !== undefined) updatePayload.settings = settings;
            if (webhookSecret !== undefined) updatePayload.webhookSecret = webhookSecret;

            const updated = await ShopifyIntegration.findOneAndUpdate(
                { userId },
                updatePayload,
                { new: true }
            );

            res.json({ success: true, data: updated });
        } catch (e) { res.status(500).json({ success: false, error: e.message }); }
    }
    async manualSync(req, res) {
        try {
            const userId = req.userId || req.user?._id;
            if (!userId) return res.status(401).json({ success: false, error: "User not authenticated" });
            const integration = await ShopifyIntegration.findByUserIdWithKeys(userId);
            if (!integration || integration.status !== 'connected') {
                return res.status(400).json({ success: false, error: "Shopify not connected" });
            }

            const scheduler = require('../schedulers/shopifyScheduler');
            const result = await scheduler.syncLatestData(integration);

            if (result.success) {
                res.json({ success: true, message: "Sync started and data refreshed" });
            } else {
                res.status(500).json({ success: false, error: result.error || "Sync failed" });
            }
        } catch (error) {
            console.error("Manual Sync Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async checkWebhookHealth(req, res) {
        try {
            const userId = req.userId || req.user?._id;
            console.log("User ID:", userId);

            const integration = await ShopifyIntegration.findByUserIdWithKeys(userId);

            console.log("Integration found:", integration ? "yes" : "no");

            if (!integration || !integration.accessToken) {
                return res.status(404).json({ success: false, error: "Not integrated" });
            }

            // Fetch actual webhooks from Shopify
            const apiVersion = "2024-10";
            const response = await axios.get(`https://${integration.storeDomain}/admin/api/${apiVersion}/webhooks.json`, {
                headers: {
                    'X-Shopify-Access-Token': integration.accessToken,
                    'Content-Type': 'application/json'
                }
            }).catch(err => {
                // If 401 error, mark integration as disconnected
                if (err.response?.status === 401) {
                    console.log(`🔌 [Shopify Health] Access token invalid for ${integration.storeDomain}, marking as disconnected`);
                    ShopifyIntegration.updateOne(
                        { userId: integration.userId },
                        { status: 'disconnected', lastError: 'Invalid access token' }
                    );
                    throw new Error('Shopify access token is invalid or expired. Please reconnect your store.');
                }
                throw err;
            });

            const shopifyWebhooks = response.data.webhooks || [];
            const localWebhooks = integration.webhooks || [];

            // Simple comparison record
            const health = {
                status: shopifyWebhooks.length >= 4 ? 'healthy' : 'unhealthy',
                liveCount: shopifyWebhooks.length,
                registeredCount: localWebhooks.length,
                topics: shopifyWebhooks.map(w => w.topic)
            };

            res.json({ success: true, health });
        } catch (err) {
            console.error("Health Check Error:", err.response?.data || err.message);
            res.status(500).json({ success: false, health: 'error', error: err.response?.data?.errors || err.message });
        }
    }

    async getOrderById(req, res) {
        try {
            const userId = req.userId;
            const orderId = req.params.id;
            const order = await ShopifyOrder.findOne({ _id: orderId, userId });
            if (!order) return res.status(404).json({ success: false, error: "Order not found" });
            res.json({ success: true, data: order });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getAbandonedCheckoutById(req, res) {
        try {
            const userId = req.userId;
            const checkoutId = req.params.checkoutId;
            const checkout = await ShopifyAbandonedCheckout.findOne({ _id: checkoutId, userId });
            if (!checkout) return res.status(404).json({ success: false, error: "Checkout not found" });
            res.json({ success: true, data: checkout });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async retryAbandonedCheckout(req, res) {
        try {
            const userId = req.userId;
            const { checkoutId } = req.params;
            const ShopifyAbandonedCheckout = require('../models/ShopifyAbandonedCheckout');

            const checkout = await ShopifyAbandonedCheckout.findOne({ _id: checkoutId, userId });
            if (!checkout) return res.status(404).json({ error: "Checkout not found" });

            const integration = await ShopifyIntegration.findByUserIdWithKeys(userId);
            if (!integration) return res.status(404).json({ error: "Integration not found" });

            const template = await Template.findById(integration.settings?.abandonedCartTemplate);
            if (!template) return res.status(400).json({ error: "Recovery template not configured" });

            const scheduler = require('../schedulers/shopifyScheduler');
            await scheduler.sendRecoveryMessage(checkout, integration, template);

            res.json({ success: true, message: "Recovery message sent" });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new ShopifyController();
