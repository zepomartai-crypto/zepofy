 // Shopify Webhook Controller
// Production-ready webhook handler for real-time Shopify events

const crypto = require('crypto');
const ShopifyIntegration = require('../models/ShopifyIntegration');
const WhatsAppService = require('../services/whatsappIntegrationService');
// ...removed EmailService...
const AbandonedCartService = require('../services/abandonedCartService');

class ShopifyWebhookController {
    constructor() {
        this.webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
        console.log('🛡️ [Shopify Webhook Controller] SHOPIFY_WEBHOOK_SECRET detected:', !!this.webhookSecret);
    }

    // Main webhook endpoint handler
    async handleWebhook(req, res) {
        try {
            console.log('🛍️ Shopify webhook received:', {
                method: req.method,
                headers: req.headers,
                topic: req.headers['x-shopify-topic']
            });

            // Handle Shopify webhook verification (GET request for setup)
            if (req.method === 'GET') {
                return this.handleWebhookVerification(req, res);
            }

            // Handle webhook events (POST request)
            if (req.method === 'POST') {
                return this.handleWebhookEvent(req, res);
            }

            // Method not allowed
            return res.status(405).json({ error: 'Method not allowed' });

        } catch (error) {
            console.error('❌ Shopify webhook error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Handle webhook verification (Shopify sends GET request during setup)
    handleWebhookVerification(req, res) {
        try {
            const { shop, topic } = req.query;

            console.log('🔍 Shopify webhook verification:', {
                shop,
                topic
            });

            // Shopify expects a 200 OK response for verification
            res.status(200).json({
                status: 'verified',
                shop,
                topic
            });

        } catch (error) {
            console.error('❌ Shopify webhook verification error:', error);
            return res.status(400).json({ error: 'Verification failed' });
        }
    }

    // Handle webhook events
    async handleWebhookEvent(req, res) {
        try {
            // Verify webhook signature
            const signature = req.headers['x-shopify-hmac-sha256'];
            if (!signature) {
                console.error('❌ Missing Shopify webhook signature');
                return res.status(401).json({ error: 'Missing signature' });
            }

            const isValid = this.verifyWebhookSignature(req.body, signature);
            if (!isValid) {
                console.error('❌ Invalid Shopify webhook signature');
                return res.status(401).json({ error: 'Invalid signature' });
            }

            // Get webhook topic from headers
            const topic = req.headers['x-shopify-topic'];
            console.log('🛍️ Processing Shopify webhook event:', topic);

            // Parse and normalize webhook data
            const webhookData = this.parseWebhookData(req.body, topic);

            // Save webhook event to database
            await this.saveWebhookEvent(webhookData);

            // Trigger automation based on event type
            await this.triggerAutomation(webhookData);

            // Respond to Shopify
            res.status(200).json({
                status: 'success',
                event: topic,
                processed_at: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Shopify webhook event processing error:', error);
            return res.status(500).json({ error: 'Event processing failed' });
        }
    }

    // Verify webhook signature using HMAC SHA256
    verifyWebhookSignature(payload, signature) {
        try {
            if (!this.webhookSecret) {
                console.error('❌ [Shopify Webhook] HMAC verification failed: No SHOPIFY_WEBHOOK_SECRET set');
                return false;
            }

            if (!payload || !Buffer.isBuffer(payload)) {
                console.error('❌ [Shopify Webhook] HMAC verification failed: Payload is not a Buffer');
                return false;
            }

            const expectedSignature = crypto
                .createHmac('sha256', this.webhookSecret)
                .update(payload)
                .digest('base64');

            const isValid = crypto.timingSafeEqual(
                Buffer.from(signature),
                Buffer.from(expectedSignature)
            );

            if (!isValid) {
                console.error('❌ [Shopify Webhook] HMAC mismatch! Verify your SHOPIFY_WEBHOOK_SECRET matches Shopify.');
                console.log('ℹ️ Received signature:', signature);
                console.log('ℹ️ Expected signature (generated):', expectedSignature);
            }

            return isValid;

        } catch (error) {
            console.error('❌ Shopify signature verification error:', error);
            return false;
        }
    }

    // Parse and normalize webhook data
    parseWebhookData(body, topic) {
        try {
            const baseData = {
                event_type: topic,
                received_at: new Date().toISOString(),
                raw_data: body
            };

            // Extract order data
            if (topic.includes('order')) {
                const order = body;
                return {
                    ...baseData,
                    type: 'order',
                    order_id: order.id,
                    order_number: order.order_number || order.name,
                    order_status: order.financial_status || order.status,
                    customer_name: `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim(),
                    customer_email: order.customer?.email || order.email || '',
                    customer_phone: order.customer?.phone || order.phone || '',
                    total_amount: parseFloat(order.total_price) || 0,
                    currency: order.currency || 'USD',
                    payment_method: order.payment_gateway_names?.[0] || '',
                    items: order.line_items?.map(item => ({
                        name: item.name,
                        quantity: item.quantity,
                        price: parseFloat(item.price) || 0,
                        total: parseFloat(item.total_discount_set?.shop_money?.amount || item.price) || 0
                    })) || [],
                    created_at: order.created_at,
                    updated_at: order.updated_at
                };
            }

            // Extract customer data
            if (topic.includes('customer')) {
                const customer = body;
                return {
                    ...baseData,
                    type: 'customer',
                    customer_id: customer.id,
                    customer_name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
                    customer_email: customer.email || '',
                    customer_phone: customer.phone || '',
                    created_at: customer.created_at,
                    updated_at: customer.updated_at
                };
            }

            // Extract cart data (for abandoned cart)
            if (topic.includes('cart') || topic.includes('checkout')) {
                const cart = body;
                return {
                    ...baseData,
                    type: 'cart',
                    cart_id: cart.id || cart.token,
                    customer_email: cart.customer?.email || cart.email || '',
                    customer_phone: cart.customer?.phone || cart.phone || '',
                    items: cart.line_items?.map(item => ({
                        name: item.title || item.name,
                        quantity: item.quantity,
                        price: parseFloat(item.price) || 0,
                        total: parseFloat(item.final_line_price) || 0
                    })) || [],
                    total_amount: parseFloat(cart.total_price) || 0,
                    currency: cart.currency || 'USD',
                    created_at: cart.created_at,
                    expires_at: cart.expires_at || null
                };
            }

            // Default case
            return {
                ...baseData,
                type: 'unknown',
                data: body
            };

        } catch (error) {
            console.error('❌ Error parsing Shopify webhook data:', error);
            return {
                event_type: topic,
                type: 'error',
                error: error.message,
                received_at: new Date().toISOString(),
                raw_data: body
            };
        }
    }

    // Save webhook event to database
    async saveWebhookEvent(webhookData) {
        try {
            console.log('💾 Saving Shopify webhook event:', {
                type: webhookData.type,
                event_type: webhookData.event_type,
                order_id: webhookData.order_id,
                customer_email: webhookData.customer_email
            });

            // For now, just log - you can implement database storage later
            // await ShopifyWebhookEvent.create(webhookData);

        } catch (error) {
            console.error('❌ Error saving Shopify webhook event:', error);
        }
    }

    // Trigger automation based on webhook event
    async triggerAutomation(webhookData) {
        try {
            console.log('🚀 Triggering automation for Shopify event:', webhookData.event_type);

            switch (webhookData.event_type) {
                case 'orders/create':
                    await this.handleOrderCreated(webhookData);
                    break;

                case 'orders/updated':
                    await this.handleOrderUpdated(webhookData);
                    break;

                case 'orders/paid':
                    await this.handleOrderPaid(webhookData);
                    break;

                case 'orders/cancelled':
                    await this.handleOrderCancelled(webhookData);
                    break;

                case 'customers/create':
                    await this.handleCustomerCreated(webhookData);
                    break;

                case 'carts/create':
                case 'checkouts/create':
                    await this.handleCheckoutStarted(webhookData);
                    break;

                default:
                    console.log('ℹ️ No automation for Shopify event type:', webhookData.event_type);
            }

        } catch (error) {
            console.error('❌ Error triggering Shopify automation:', error);
        }
    }

    // Handle order created event
    async handleOrderCreated(data) {
        console.log('📋 Processing Shopify order created:', data.order_id);

        try {
            // Send order confirmation via WhatsApp
            await this.sendWhatsAppMessage('order_created', data);

            // ...removed email sending...

        } catch (error) {
            console.error('❌ Error handling Shopify order created:', error);
        }
    }

    // Handle order updated event
    async handleOrderUpdated(data) {
        console.log('📝 Processing Shopify order updated:', data.order_id);

        try {
            // Send order status update via WhatsApp
            await this.sendWhatsAppMessage('order_updated', data);

        } catch (error) {
            console.error('❌ Error handling Shopify order updated:', error);
        }
    }

    // Handle order paid event
    async handleOrderPaid(data) {
        console.log('💰 Processing Shopify order paid:', data.order_id);

        try {
            // Mark abandoned cart as resolved if exists
            await AbandonedCartService.resolveCart(data.customer_email, data.order_id);

            // Send payment confirmation via WhatsApp
            await this.sendWhatsAppMessage('order_paid', data);

            // ...removed email sending...

        } catch (error) {
            console.error('❌ Error handling Shopify order paid:', error);
        }
    }

    // Handle order cancelled event
    async handleOrderCancelled(data) {
        console.log('❌ Processing Shopify order cancelled:', data.order_id);

        try {
            // Send cancellation notice via WhatsApp
            await this.sendWhatsAppMessage('order_cancelled', data);

        } catch (error) {
            console.error('❌ Error handling Shopify order cancelled:', error);
        }
    }

    // Handle customer created event
    async handleCustomerCreated(data) {
        console.log('👤 Processing Shopify customer created:', data.customer_id);

        try {
            // Send welcome message via WhatsApp
            await this.sendWhatsAppMessage('customer_created', data);

            // ...removed email sending...

        } catch (error) {
            console.error('❌ Error handling Shopify customer created:', error);
        }
    }

    // Handle checkout started event (for abandoned cart)
    async handleCheckoutStarted(data) {
        console.log('🛒 Processing Shopify checkout started:', data.cart_id);

        try {
            // Save abandoned cart data
            await AbandonedCartService.saveCart(data);

        } catch (error) {
            console.error('❌ Error handling Shopify checkout started:', error);
        }
    }

    // Send WhatsApp message
    async sendWhatsAppMessage(templateType, data) {
        try {
            // Get WhatsApp integration
            const whatsappIntegration = await WhatsAppService.getIntegration();
            if (!whatsappIntegration || whatsappIntegration.status !== 'connected') {
                console.log('⚠️ WhatsApp not connected, skipping Shopify message');
                return;
            }

            // Get template and send message
            const message = await this.getTemplateMessage(templateType, data, 'whatsapp');
            if (message && data.customer_phone) {
                await WhatsAppService.sendMessage(data.customer_phone, message);
                console.log('📱 WhatsApp message sent for Shopify event:', templateType);
            }

        } catch (error) {
            console.error('❌ Error sending Shopify WhatsApp message:', error);
        }
    }

    // ...removed sendEmailMessage method...

    // Get template message (placeholder - implement with your template system)
    async getTemplateMessage(templateType, data, channel) {
        const templates = {
            whatsapp: {
                order_created: `🛒 New Order #${data.order_number}\n\nHi ${data.customer_name},\n\nThank you for your order of ${data.currency} ${data.total_amount}.\n\nWe'll process it shortly!`,
                order_updated: `📝 Order #${data.order_number} Updated\n\nHi ${data.customer_name},\n\nYour order status is now: ${data.order_status}\n\nTrack: ${data.order_number}`,
                order_paid: `💰 Order #${data.order_number} Paid!\n\nHi ${data.customer_name},\n\nYour payment has been received!\n\nTotal: ${data.currency} ${data.total_amount}\n\nThank you!`,
                order_cancelled: `❌ Order #${data.order_number} Cancelled\n\nHi ${data.customer_name},\n\nYour order has been cancelled.\n\nPlease contact support if needed.`,
                customer_created: `👋 Welcome ${data.customer_name}!\n\nThank you for registering with us!\n\nWe're excited to have you on board!`
            },
            email: {
                order_created: {
                    subject: `Order Confirmation #${data.order_number}`,
                    body: `<h2>Order Confirmation</h2><p>Hi ${data.customer_name},</p><p>Thank you for your order #${data.order_number}.</p><p><strong>Total:</strong> ${data.currency} ${data.total_amount}</p><p>We'll process it shortly.</p>`
                },
                order_paid: {
                    subject: `Payment Received #${data.order_number}`,
                    body: `<h2>Payment Received</h2><p>Hi ${data.customer_name},</p><p>Your payment for order #${data.order_number} has been received!</p><p><strong>Total:</strong> ${data.currency} ${data.total_amount}</p><p>Thank you for your purchase!</p>`
                },
                customer_created: {
                    subject: 'Welcome to Our Store!',
                    body: `<h2>Welcome!</h2><p>Hi ${data.customer_name},</p><p>Thank you for registering with us!</p><p>We're excited to have you on board!</p>`
                }
            }
        };

        return templates[channel]?.[templateType] || null;
    }
}

module.exports = new ShopifyWebhookController();
