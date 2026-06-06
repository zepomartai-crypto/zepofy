const ShopifyAbandonedCheckout = require('../models/ShopifyAbandonedCheckout');
const ShopifyOrder = require('../models/ShopifyOrder');
const ShopifyIntegration = require('../models/ShopifyIntegration');
const Template = require('../models/Template');
const whatsappService = require('../services/whatsappService');
const { normalizePhone } = require('../utils/internationalPhoneNormalizer');
const axios = require('axios');

class ShopifyScheduler {
    constructor() {
        this.isRunning = false;
        this.isProcessing = false;
        this.interval = null;
        this.CHECK_INTERVAL = 2 * 60 * 1000; // Polling every 2 minutes as requested
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('🚀 Shopify Polling Scheduler started (2m interval)');
        this.runCycle();
        this.interval = setInterval(() => this.runCycle(), this.CHECK_INTERVAL);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            this.isRunning = false;
        }
    }

    async runCycle() {
        if (!this.isRunning || this.isProcessing) return;
        this.isProcessing = true;

        try {
            const integrations = await ShopifyIntegration.find({ status: 'connected' });
            for (const integration of integrations) {
                // 1. Recover Abandoned Carts
                if (integration.settings?.enableAbandonedCart) {
                    await this.processAbandonedRecovery(integration);
                }

                // 2. Polling Fallback: Sync latest data (Orders & Checkouts)
                await this.syncLatestData(integration);
            }
        } catch (error) {
            console.error("❌ Shopify Scheduler Cycle Error:", error);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Polling Sync: Fetch latest orders and checkouts from Shopify API
     */
    async syncLatestData(integration) {
        const { storeDomain, userId } = integration;
        if (!storeDomain) return { success: false, error: "Store domain missing" };

        try {
            console.log(`🔍 [Shopify Sync] Fetching credentials for user: ${userId}`);
            const integrationWithKeys = await ShopifyIntegration.findByUserIdWithKeys(userId);
            if (!integrationWithKeys || !integrationWithKeys.accessToken) {
                console.error(`❌ [Shopify Sync] No access token found for user: ${userId}`);
                return { success: false, error: "Access token missing or invalid" };
            }
            
            const token = integrationWithKeys.accessToken ? integrationWithKeys.accessToken.trim() : null;
            const tokenPreview = token ? `${token.substring(0, 10)}...` : 'NONE';
            const apiVersion = "2024-10";

            console.log(`📡 [Shopify Sync] Connecting to ${storeDomain} for user ${userId}...`);
            console.log(`🔑 [Shopify Sync] Token Integrity: Length=${token?.length || 0}, Prefix=${token?.substring(0, 6)}`);

            const shopifyHeaders = { 
                'X-Shopify-Access-Token': token,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Zepofy-Wauto-Sync/1.0.0 (Wauto SaaS Integration)',
                'Accept-Encoding': 'gzip, deflate, br'
            };

            // Sync Orders (Last 50)
            let orders = [];
            let ordersError = null;
            try {
                const url = `https://${storeDomain}/admin/api/${apiVersion}/orders.json?limit=50&status=any`;
                console.log(`📦 [Shopify Sync] Requesting Orders from: ${url}`);
                
                const ordersRes = await axios({
                    method: 'get',
                    url: url,
                    headers: shopifyHeaders,
                    timeout: 20000
                });

                orders = ordersRes.data.orders || [];
                console.log(`✅ [Shopify Sync] Successfully fetched ${orders.length} orders for ${storeDomain}`);

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
            } catch (orderErr) {
                const status = orderErr.response?.status;
                const errorData = orderErr.response?.data;
                const errorBody = errorData?.errors || errorData || orderErr.message;
                
                console.error(`❌ [Shopify Sync] Orders API Error Details:`, {
                    status,
                    error: JSON.stringify(errorBody),
                    requestId: orderErr.response?.headers?.['x-request-id']
                });
                
                // If 401 error, mark integration as disconnected
                if (status === 401) {
                    console.log(`🔌 [Shopify Sync] Access token invalid for ${storeDomain}, marking as disconnected`);
                    await ShopifyIntegration.updateOne(
                        { userId }, 
                        { status: 'disconnected', lastError: 'Invalid access token' }
                    );
                }
                
                ordersError = `Orders: [${status}] ${typeof errorBody === 'object' ? JSON.stringify(errorBody) : errorBody}`;
            }

            // Sync Checkouts (Abandoned)
            let checkouts = [];
            let checkoutsError = null;
            try {
                const url = `https://${storeDomain}/admin/api/${apiVersion}/checkouts.json`;
                const checkoutsRes = await axios({
                    method: 'get',
                    url: url,
                    headers: shopifyHeaders,
                    timeout: 20000
                });

                checkouts = checkoutsRes.data.checkouts || [];
                console.log(`🛒 [Shopify Sync] Successfully fetched ${checkouts.length} checkouts for ${storeDomain}`);

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
            } catch (checkoutErr) {
                const status = checkoutErr.response?.status;
                const errorData = checkoutErr.response?.data;
                const errorBody = errorData?.errors || errorData || checkoutErr.message;

                console.error(`❌ [Shopify Sync] Checkouts API Error Details:`, {
                    status,
                    error: JSON.stringify(errorBody),
                    requestId: checkoutErr.response?.headers?.['x-request-id']
                });

                // If 401 error, mark integration as disconnected
                if (status === 401) {
                    console.log(`🔌 [Shopify Sync] Access token invalid for ${storeDomain}, marking as disconnected`);
                    await ShopifyIntegration.updateOne(
                        { userId }, 
                        { status: 'disconnected', lastError: 'Invalid access token' }
                    );
                }

                checkoutsError = `Checkouts: [${status}] ${typeof errorBody === 'object' ? JSON.stringify(errorBody) : errorBody}`;
            }

            // Update Last Sync
            await ShopifyIntegration.updateOne({ userId }, { lastSyncAt: new Date() });

            if (ordersError || checkoutsError) {
                const combinedError = [ordersError, checkoutsError].filter(Boolean).join(' | ');
                return { success: false, error: combinedError };
            }

            console.log(`✅ [Shopify Sync] Sync completed successfully for ${storeDomain}`);
            return { success: true, count: orders.length + checkouts.length };

        } catch (err) {
            const errorMsg = err.response?.data?.errors || err.message;
            console.error(`❌ [Shopify Polling] Fatal Sync failure for ${storeDomain}:`, errorMsg);
            return { success: false, error: errorMsg };
        }
    }

    async processAbandonedRecovery(integration) {
        try {
            const delayMinutes = integration.settings.abandonedCartDelay || 60;
            const delayMs = delayMinutes * 60 * 1000;
            const cutoffDate = new Date(Date.now() - delayMs);

            const checkouts = await ShopifyAbandonedCheckout.find({
                userId: integration.userId,
                status: 'pending',
                whatsappSent: false,
                abandonedAt: { $lte: cutoffDate }
            }).limit(50);

            if (checkouts.length === 0) return;

            const template = await Template.findById(integration.settings.abandonedCartTemplate);
            if (!template) return;

            for (const checkout of checkouts) {
                await this.sendRecoveryMessage(checkout, integration, template);
            }
        } catch (error) {
            console.error(`❌ Abandoned Recovery Error for ${integration.userId}:`, error.message);
        }
    }

    async sendRecoveryMessage(checkout, integration, template) {
        try {
            if (!checkout.customerPhone) return;
            const normalized = normalizePhone(checkout.customerPhone);
            if (!normalized.success) {
                await this.markFailed(checkout, "Invalid Phone");
                return;
            }

            const { buildTemplatePayload } = require('../utils/templateUtils');
            const availableParams = [
                checkout.customerName || "Customer",
                `${checkout.currency || 'INR'} ${checkout.cartValue}`,
                checkout.checkoutUrl
            ];

            const bodyParams = buildTemplatePayload(template, availableParams);

            await whatsappService.sendTemplateMessage({
                userId: integration.userId,
                to: normalized.phoneNumber,
                templateName: template.metaTemplateName,
                language: template.language,
                bodyParams: bodyParams
            });

            checkout.whatsappSent = true;
            checkout.whatsappSentAt = new Date();
            checkout.whatsappStatus = 'sent';
            await checkout.save();
        } catch (error) {
            await this.markFailed(checkout, error.message);
        }
    }

    async markFailed(checkout, reason) {
        checkout.whatsappStatus = 'failed';
        if (reason.includes("Invalid Phone")) {
            checkout.whatsappSent = true;
        }
        await checkout.save();
    }
}

module.exports = new ShopifyScheduler();
