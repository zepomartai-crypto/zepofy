// Abandoned Cart Service
// Handles business logic for abandoned carts with multi-tenant support

const AbandonedCart = require('../models/AbandonedCart');
const whatsappService = require('./whatsappService');
const WhatsAppIntegration = require('../models/WhatsAppIntegration');
const Settings = require('../models/Settings');

class AbandonedCartService {
    /**
     * Send WhatsApp template for an abandoned cart
     * @param {Object} cart The AbandonedCart document
     * @param {String} templateNameOverride Optional template name to use
     */
    async sendAbandonedCartTemplate(cart, templateNameOverride = null) {
        try {
            const userId = cart.userId;
            const customerName = cart.customer_name || 'Customer';
            const total = cart.total_amount || 0;
            const currency = cart.currency || 'INR';
            const formattedTotal = `${currency} ${Number(total).toFixed(2)}`;
            const paymentUrl = cart.payment_url || cart.recovery_url || '';
            const to = (cart.customer_phone || '').replace(/\D/g, '');

            if (!to) throw new Error('Customer phone number missing');

            // Find user's WhatsApp integration
            const integration = await WhatsAppIntegration.findOne({ userId, status: 'connected' }).sort({ createdAt: -1 });
            if (!integration) throw new Error(`WhatsApp not connected for user ${userId}`);

            // Get template settings
            const settings = await Settings.findOne({ userId }).lean();
            const templateName = templateNameOverride || settings?.abandonedCart?.templateName || 'abandoned_cart_v1';
            const usedLanguage = 'en_US'; // ✅ Strictly use en_US as requested

            // Body parameters (Standard: CustomerName, StoreName, Total, URL)
            // Ensure none are empty to avoid Meta rejection
            const availableParams = [
                customerName || 'Customer',
                'Your Store',
                formattedTotal || '0.00',
                paymentUrl || 'https://wauto.com'
            ];

            const Template = require('../models/Template');
            const template = await Template.findOne({ metaTemplateName: templateName });

            const { buildTemplatePayload } = require('../utils/templateUtils');
            const bodyParams = buildTemplatePayload(template, availableParams);

            console.log(`📤 Sending template ${templateName} [${usedLanguage}] to ${to}`);

            try {
                const result = await whatsappService.sendTemplateMessage({
                    userId,
                    to,
                    templateName,
                    language: usedLanguage,
                    bodyParams
                });

                if (result && !result.error) {
                    return { success: true, template: templateName, language: usedLanguage };
                } else {
                    return { success: false, error: result?.error || 'WhatsApp API rejected the template' };
                }
            } catch (err) {
                console.error(`❌ Meta API Error [${templateName}]:`, err.message);
                return { success: false, error: err.message };
            }

        } catch (error) {
            console.error('❌ Service Error in sendAbandonedCartTemplate:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Proxy for controller (if needed) or shared logic
    async getAbandonedCarts(req, res) {
        // This is now predominantly handled in AbandonedCartApiController
        // but can be kept for backward compatibility if other services call it.
    }
}

module.exports = new AbandonedCartService();
