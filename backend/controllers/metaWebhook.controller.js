// Meta (WhatsApp) Webhook Controller
// Production-ready webhook handler for WhatsApp Business API events

const axios = require('axios');
const crypto = require('crypto');
const WhatsAppIntegration = require('../models/WhatsAppIntegration');
const flowEncryptionService = require('../services/flowEncryptionService');
// const WhatsAppService = require('../services/whatsappIntegrationService'); // Ensure this exists or is correct

class MetaWebhookController {
    constructor() {
        this.webhookVerifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'default-verify-token-change-in-production';
    }

    // Main webhook endpoint handler
    async handleWebhook(req, res) {
        try {
            // Handle webhook verification (GET request from Meta)
            if (req.method === 'GET') {
                return this.handleWebhookVerification(req, res);
            }

            // Handle webhook events (POST request from Meta)
            if (req.method === 'POST') {
                return this.handleWebhookEvent(req, res);
            }

            // Method not allowed
            return res.status(405).json({ error: 'Method not allowed' });

        } catch (error) {
            console.error('❌ Meta webhook error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Handle webhook verification (Meta sends GET request during setup)
    handleWebhookVerification(req, res) {
        try {
            const {
                'hub.mode': mode,
                'hub.verify_token': token,
                'hub.challenge': challenge
            } = req.query;

            console.log('🔍 Meta webhook verification:', {
                mode,
                token_received: !!token,
                challenge_received: !!challenge
            });

            // Check if this is a webhook verification request
            if (mode === 'subscribe' && token === this.webhookVerifyToken) {
                console.log('✅ Meta webhook verified successfully');
                return res.status(200).send(challenge);
            }

            // Invalid verification request
            console.error('❌ Invalid Meta webhook verification');
            return res.status(403).json({ error: 'Verification failed' });

        } catch (error) {
            console.error('❌ Meta webhook verification error:', error);
            return res.status(400).json({ error: 'Verification failed' });
        }
    }

    // Handle webhook events
    async handleWebhookEvent(req, res) {
        try {
            const { object, entry } = req.body;

            // Process each entry
            for (const entryItem of entry || []) {
                await this.processWebhookEntry(entryItem);
            }

            // Respond to Meta immediately (200 OK)
            res.status(200).json({
                status: 'success',
                processed_at: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Meta webhook event processing error:', error);
            // Still return 200 to Meta to avoid retries
            return res.status(200).json({
                status: 'error',
                error: error.message,
                processed_at: new Date().toISOString()
            });
        }
    }

    // Process individual webhook entry
    async processWebhookEntry(entry) {
        try {
            const { id, changes, messaging, standby } = entry;

            // 1️⃣ FILTER OUT FLOW EVENTS (ENDPOINT_AVAILABILITY)
            if (changes) {
                const isFlowEvent = changes.some(c => c.field === 'flows');
                if (isFlowEvent) {
                    console.log('ℹ️ Ignoring Meta "flows" event (ENDPOINT_AVAILABILITY)');
                    return;
                }
            }

            // Handle WhatsApp Business API status changes and Cloud API messages
            if (changes) {
                for (const change of changes) {
                    const { field, value } = change;

                    if (field === 'phone_number_status') {
                        await this.updatePhoneNumberStatus(value);
                    } else if (field === 'messages') {
                        // Cloud API message format
                        const phoneNumberId = value.metadata?.phone_number_id;
                        if (value.messages) {
                            for (const message of value.messages) {
                                // Extract contacts if available (often sent along with messages)
                                const senderContact = value.contacts?.find(c => c.wa_id === message.from);
                                const senderName = senderContact?.profile?.name;
                                
                                // Map Cloud API format to expected sender format
                                const sender = { id: message.from, name: senderName };
                                await this.handleIncomingMessage({ sender, message, phoneNumberId });
                            }
                        }
                    }
                }
            }

            // Fallback for old/Messenger format incoming messages
            if (messaging) {
                for (const messageItem of messaging) {
                    await this.handleIncomingMessage(messageItem);
                }
            }

        } catch (error) {
            console.error('❌ Error processing webhook entry:', error);
        }
    }

    // Handle WhatsApp Business API status changes
    async handleStatusChanges(changes) {
        try {
            for (const change of changes) {
                const { field, value } = change;

                if (field === 'flows') continue; // Extra safety

                console.log('📊 WhatsApp status change:', { field, value });

                // Update integration status in database
                if (field === 'phone_number_status') {
                    await this.updatePhoneNumberStatus(value);
                }
            }
        } catch (error) {
            console.error('❌ Error handling status changes:', error);
        }
    }

    // Handle incoming messages
    async handleIncomingMessage(messageItem) {
        try {
            const { sender, message, phoneNumberId } = messageItem;

            console.log('💬 Incoming WhatsApp message:', {
                sender_id: sender?.id,
                message_type: message?.type,
                phoneNumberId
            });

            // Process different message types
            switch (message?.type) {
                case 'text':
                    await this.handleTextMessage(sender, message, phoneNumberId);
                    break;
                case 'image':
                    await this.handleImageMessage(sender, message, phoneNumberId);
                    break;
                case 'interactive':
                    await this.handleInteractiveMessage(sender, message, phoneNumberId);
                    break;
                default:
                    console.log('ℹ️ Unhandled message type:', message?.type);
            }

        } catch (error) {
            console.error('❌ Error handling incoming message:', error);
        }
    }

    // Handle interactive messages (Flows, Buttons, Lists)
    async handleInteractiveMessage(sender, message, phoneNumberId) {
        try {
            const interactive = message.interactive;
            if (interactive.type === 'nfm_reply' && interactive.nfm_reply) {
                console.log('🔗 Received WhatsApp Flow Submission');
                const responseJsonString = interactive.nfm_reply.response_json;
                
                if (responseJsonString) {
                    const encryptedPayload = JSON.parse(responseJsonString);
                    
                    // Fetch the integration to get the private key matching the phone number
                    let integration;
                    if (phoneNumberId) {
                        integration = await WhatsAppIntegration.findOne({ phoneNumberId }).select('+flowPrivateKey userId phoneNumberId');
                    } else {
                        integration = await WhatsAppIntegration.findOne({ flowPrivateKey: { $exists: true } }).select('+flowPrivateKey userId phoneNumberId');
                    }
                    
                    if (integration && integration.flowPrivateKey) {
                        const { decryptedBody } = flowEncryptionService.decryptFlowData(
                            encryptedPayload, 
                            integration.flowPrivateKey
                        );
                        console.log('🔓 Decrypted Flow Payload:', JSON.stringify(decryptedBody, null, 2));
                        
                        // Save the extracted data to the database as an incoming message
                        try {
                            const Message = require('../models/Message');
                            const Contact = require('../models/Contact');
                            
                            // Find or create contact
                            let contact = await Contact.findOne({ userId: integration.userId, phone: sender.id });
                            
                            // Get display text from decrypted flow data
                            let flowDataString = 'WhatsApp Flow Submitted:\n';
                            for (const [key, value] of Object.entries(decryptedBody)) {
                                flowDataString += `${key}: ${value}\n`;
                            }
                            
                            const newMessage = new Message({
                                userId: integration.userId,
                                customerId: contact ? contact._id : undefined,
                                phone: sender.id, // customer phone number
                                sender: 'customer',
                                senderName: sender.name || sender.id,
                                type: 'interactive',
                                direction: 'incoming',
                                text: flowDataString.trim(),
                                metaMessageId: message.id,
                                buttonPayload: JSON.stringify(decryptedBody)
                            });
                            
                            await newMessage.save();
                            console.log('✅ Flow data saved to Zepofy Inbox');

                            // --- AUTO APPOINTMENT CREATION ---
                            try {
                                const isAppointment = Object.keys(decryptedBody).some(k => 
                                    k.toLowerCase().includes('date') || 
                                    k.toLowerCase().includes('appointment') || 
                                    k.toLowerCase().includes('booking') ||
                                    k.toLowerCase().includes('service')
                                );
                                
                                if (isAppointment) {
                                    const Appointment = require('../models/Appointment');
                                    
                                    const extractField = (keywords) => {
                                        const key = Object.keys(decryptedBody).find(k => keywords.some(kw => k.toLowerCase().includes(kw)));
                                        return key ? decryptedBody[key] : null;
                                    };

                                    const appointmentDate = extractField(['date']);
                                    const appointmentTime = extractField(['time', 'slot']) || 'TBD';
                                    const customerName = extractField(['name', 'patient', 'customer']) || sender.name || sender.id;
                                    const serviceOrNotes = extractField(['service', 'reason', 'note', 'inquiry']) || 'Appointment booked via WhatsApp Flow';
                                    
                                    if (appointmentDate) {
                                        const newAppointment = new Appointment({
                                            userId: integration.userId,
                                            contactId: contact ? contact._id : undefined,
                                            customerName: customerName,
                                            customerPhone: sender.id,
                                            appointmentDate: appointmentDate,
                                            appointmentTime: appointmentTime,
                                            status: 'scheduled',
                                            notes: serviceOrNotes,
                                            metaData: { ...decryptedBody, metaMessageId: message.id }
                                        });
                                        await newAppointment.save();
                                        console.log('📅 ✅ Appointment created automatically from WhatsApp Flow:', newAppointment._id);
                                    }
                                }
                            } catch (aptErr) {
                                console.error('❌ Error creating appointment from flow:', aptErr);
                            }
                            // --- END AUTO APPOINTMENT ---
                        } catch (saveErr) {
                            console.error('❌ Error saving flow message:', saveErr);
                        }
                    } else {
                        console.error('❌ No private key found to decrypt flow payload for this integration.');
                    }
                }
            } else {
                console.log('🔘 Interactive response received:', interactive);
            }
        } catch (error) {
            console.error('❌ Error handling interactive message:', error);
        }
    }

    // Handle text messages
    async handleTextMessage(sender, message) {
        try {
            const text = message.text?.body || '';
            console.log('📝 Text message received:', text);
            // Implement auto-responses or bot logic here
        } catch (error) {
            console.error('❌ Error handling text message:', error);
        }
    }

    // Handle image messages
    async handleImageMessage(sender, message) {
        try {
            const image = message.image;
            console.log('🖼️ Image message received:', image);
        } catch (error) {
            console.error('❌ Error handling image message:', error);
        }
    }

    // Update phone number status in database
    async updatePhoneNumberStatus(status) {
        try {
            console.log('📞 Updating phone number status:', status);
            await WhatsAppIntegration.updateOne(
                { status: { $ne: 'disconnected' } },
                {
                    phoneNumberStatus: status,
                    lastStatusUpdate: new Date()
                }
            );
        } catch (error) {
            console.error('❌ Error updating phone number status:', error);
        }
    }

    // Stub for standby
    async handleStandbyNotification(standby) {
        console.log('⏳ Standby notification received');
    }
}

module.exports = new MetaWebhookController();
