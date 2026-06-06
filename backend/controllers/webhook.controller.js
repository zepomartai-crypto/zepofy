const Message = require("../models/Message");
const Contact = require("../models/Contact");
const whatsappIntegrationService = require("../services/whatsappIntegrationService");
const whatsappService = require("../services/whatsappService");
const conversationService = require("../services/conversation.service");
const flowEngine = require("../modules/flowBuilder/flow.engine");
const Product = require("../models/Product");
const Order = require("../models/Order");
const SyncLog = require("../models/SyncLog");
const { normalizePhone } = require("../utils/phoneNormalizer");
// const aiService = require("../services/ai.service");
// const AIIntegration = require("../models/AIIntegration");

/* ================= HELPER FUNCTIONS ================= */
function extractReplyText(message) {
  let replyText = "";

  if (!message) return replyText;

  // Handle text messages
  if (message.type === "text" && message.text?.body) {
    replyText = message.text.body;
  }

  // Handle button replies
  else if (message.type === "button" && message.button?.text) {
    replyText = message.button.text;
  }

  // Handle interactive button replies
  else if (message.type === "interactive" && message.interactive?.button_reply?.title) {
    replyText = message.interactive.button_reply.title;
  }

  // Handle interactive list replies
  else if (message.type === "interactive" && message.interactive?.list_reply?.title) {
    replyText = message.interactive.list_reply.title;
  }

  return replyText;
}

function getMessageType(message) {
  if (!message) return "unknown";

  if (message.type === "text") return "text";
  if (message.type === "button") return "button";
  if (message.type === "interactive") {
    if (message.interactive?.button_reply) return "button_reply";
    if (message.interactive?.list_reply) return "list_reply";
    if (message.interactive?.type === "nfm_reply" || message.interactive?.nfm_reply) return "nfm_reply";
  }
  if (message.type === "image") return "image";
  if (message.type === "document") return "document";
  if (message.type === "audio") return "audio";
  if (message.type === "video") return "video";

  return message.type || "unknown";
}

async function saveInboundMessage(integration, contact, conversation, msg, metaMessageId, senderName) {
  try {
    const messageType = getMessageType(msg);
    const replyText = extractReplyText(msg);

    let messageData = {
      userId: integration.userId,
      customerId: contact._id,
      phone: msg.from || contact.phone,
      conversationId: conversation._id,
      sender: "customer",
      senderName,
      direction: "incoming",
      isRead: false,
      metaMessageId,
      waTimestamp: msg.timestamp,
      timestamp: msg.timestamp,
      type: messageType,
      status: "received",
      createdAt: new Date(msg.timestamp * 1000)
    };

    // Set body based on message type
    switch (messageType) {
      case "text":
        messageData.body = msg.text?.body || "";
        messageData.text = msg.text?.body || "";
        break;

      case "button_reply":
        const buttonReply = msg.interactive?.button_reply;
        messageData.body = buttonReply?.title || "";
        messageData.text = buttonReply?.title || "";
        messageData.meta = { replyId: buttonReply?.id }; // As requested
        break;

      case "list_reply":
        const listReply = msg.interactive?.list_reply;
        messageData.body = listReply?.title || "";
        messageData.text = listReply?.title || "";
        messageData.meta = { replyId: listReply?.id }; // As requested
        break;

      case "image":
        messageData.body = "📷 Image received";
        messageData.image = msg.image?.id;
        messageData.mediaType = "image";
        messageData.mediaUrl = `https://graph.facebook.com/v18.0/${msg.image?.id}`;
        break;

      case "document":
        messageData.body = "📄 Document received";
        messageData.document = msg.document?.id;
        messageData.mediaType = "document";
        messageData.mediaUrl = `https://graph.facebook.com/v18.0/${msg.document?.id}`;
        break;

      case "audio":
        messageData.body = "🎵 Audio received";
        messageData.audio = msg.audio?.id;
        messageData.mediaType = "audio";
        messageData.mediaUrl = `https://graph.facebook.com/v18.0/${msg.audio?.id}`;
        break;

      case "video":
        messageData.body = "🎥 Video received";
        messageData.video = msg.video?.id;
        messageData.mediaType = "video";
        messageData.mediaUrl = `https://graph.facebook.com/v18.0/${msg.video?.id}`;
        break;

      case "order":
        // This is triggered when a user sends a product list/order
        const orderData = msg.interactive?.nfm_reply || msg.order;
        messageData.body = "🛒 New Order Received";
        messageData.type = "order";
        messageData.metaOrderData = orderData;
        break;

      case "nfm_reply":
        messageData.body = "📝 WhatsApp Flow Submitted";
        messageData.type = "nfm_reply";
        
        // Decrypt the flow JSON payload
        const flowEncryptionService = require('../services/whatsappFlowEncryptionService');
        if (msg.interactive?.nfm_reply?.response_json) {
            const encryptedPayload = JSON.parse(msg.interactive.nfm_reply.response_json);
            const WhatsAppIntegration = require('../models/WhatsAppIntegration');
            
            // Re-fetch integration to get the private key
            const fullIntegration = await WhatsAppIntegration.findById(integration._id).select('+flowPrivateKey');
            if (fullIntegration && fullIntegration.flowPrivateKey) {
                try {
                    const { decryptedBody } = flowEncryptionService.decryptFlowData(
                        encryptedPayload, 
                        fullIntegration.flowPrivateKey
                    );
                    messageData.buttonPayload = JSON.stringify(decryptedBody); // Store for flow engine
                    
                    let flowDataString = 'WhatsApp Flow Submitted:\n';
                    for (const [key, value] of Object.entries(decryptedBody)) {
                        flowDataString += `${key}: ${value}\n`;
                    }
                    messageData.body = flowDataString.trim();
                    messageData.text = flowDataString.trim();
                } catch(e) {
                    console.log("Failed to decrypt flow data", e);
                }
            }
        }
        break;

      default:
        messageData.body = "📩 Message received";
        break;
    }

    // 🔥 NEW: Automatic Order Creation logic
    // Check if it's a formal order OR a text message that looks like a cart summary (fallback)
    const isFormalOrder = msg.type === "order" || (msg.type === "interactive" && msg.interactive?.type === "order");
    const isCartSummary = msg.type === "text" && (/^\d+\s+items?\s+₹\s?[\d.,]+/i.test(msg.text?.body || ""));

    if (isFormalOrder || isCartSummary) {
      console.log("🛒 [Webhook] Order-like message detected. Triggering Order Capture...");
      await createOrderFromWebhook(integration, contact, msg, metaMessageId);
    }

    console.log(`💾 [Webhook] Saving ${messageType} message to DB for contact ${contact.phone}...`);
    const savedMessage = await Message.create(messageData);
    console.log("Message Saved");
    console.log(`✅ [Webhook] ${messageType} message saved! ID: ${savedMessage._id}`);

    // --- AUTO APPOINTMENT CREATION FROM FLOW ---
    if (msg.interactive && msg.interactive.type === "nfm_reply" && messageData.buttonPayload) {
      try {
        const decryptedBody = JSON.parse(messageData.buttonPayload);
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
            const customerName = extractField(['name', 'patient', 'customer']) || contact.name || contact.phone;
            const serviceOrNotes = extractField(['service', 'reason', 'note', 'inquiry']) || 'Appointment booked via WhatsApp Flow';
            
            if (appointmentDate) {
                const newAppointment = new Appointment({
                    userId: integration.userId,
                    contactId: contact._id,
                    customerName: customerName,
                    customerPhone: contact.phone,
                    appointmentDate: appointmentDate,
                    appointmentTime: appointmentTime,
                    status: 'scheduled',
                    notes: serviceOrNotes,
                    metaData: { ...decryptedBody, metaMessageId }
                });
                await newAppointment.save();
                console.log('📅 ✅ Appointment created automatically from WhatsApp Flow:', newAppointment._id);
            }
        }
      } catch (aptErr) {
          console.error('❌ Error creating appointment from flow:', aptErr);
      }
    }
    // --- END AUTO APPOINTMENT ---

    return savedMessage;
  } catch (error) {
    console.error("❌ [Webhook] Failed to save inbound message:", error);
    throw error;
  }
}

async function createOrderFromWebhook(integration, contact, msg, metaMessageId) {
  try {
    // 🛡️ DEDUPLICATION: Check if this order was already processed
    if (metaMessageId) {
      const existingOrder = await Order.findOne({ metaMessageId });
      if (existingOrder) {
        console.log(`⚠️ [Commerce] Order already exists for Meta ID: ${metaMessageId}. Skipping...`);
        return;
      }
    }
    const orderBody = msg.order || (msg.interactive?.type === 'order' ? msg.interactive.order : null);
    const textBody = msg.text?.body || "";

    console.log("🛒 [Commerce] Attempting to create order from webhook...");
    console.log("🔍 [Commerce] Order Body detected:", orderBody ? "YES (Formal Order)" : "NO");
    console.log("🔍 [Commerce] Text Body detected:", textBody || "NO");

    const cartRegex = /(\d+)\s+items?\s+₹\s?([\d.,]+)/i;

    console.log(`📩 [Webhook] Incoming message from ${contact.phone}: "${textBody || '[Non-text message]'}"`);

    if (!orderBody && !textBody.match(cartRegex)) {
      console.log("⚠️ [Commerce] No product items or cart summary found. Skipping order creation.");
      return;
    }

    const items = [];
    let totalAmount = 0;

    if (orderBody && orderBody.product_items) {
      for (const item of orderBody.product_items) {
        console.log(`🔎 [Commerce] Looking up SKU: ${item.product_retailer_id}`);
        // Find local product by SKU (retailer_id)
        const product = await Product.findOne({
          userId: integration.userId,
          sku: item.product_retailer_id
        });

        if (!product) {
          console.warn(`⚠️ [Commerce] Product not found for SKU: ${item.product_retailer_id}. Using fallback data.`);
        }

        // Calculate item price
        const itemPrice = (product ? product.price : (item.item_price || 0));
        const qty = parseInt(item.quantity) || 1;

        items.push({
          productId: product ? product._id : null,
          name: product ? product.name : `Product (${item.product_retailer_id})`,
          price: itemPrice,
          quantity: qty
        });

        totalAmount += itemPrice * qty;
      }
    } else if (textBody) {
      // Fallback parsing for "X items ₹Y"
      const match = textBody.match(cartRegex);
      if (match) {
        const qty = parseInt(match[1]);
        const price = parseFloat(match[2].replace(',', ''));
        items.push({
          name: `${qty} Items via Cart Summary`,
          price: price,
          quantity: 1
        });
        totalAmount = price;
      }
    }

    if (items.length === 0) {
      console.log("⚠️ [Commerce] No items extracted from message. Aborting order creation.");
      return;
    }

    const newOrder = await Order.create({
      userId: integration.userId,
      customerName: contact.name || "WhatsApp Customer",
      customerPhone: contact.phone,
      items,
      totalAmount,
      status: "pending",
      source: "whatsapp",
      notes: orderBody?.notes || "",
      metaMessageId: metaMessageId
    });

    // 🔥 NEW: Auto-Reduce Inventory
    for (const item of items) {
      if (item.productId) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: -item.quantity }
        });
        console.log(`📉 [Inventory] Reduced stock for ${item.name} by ${item.quantity}`);
      }
    }

    // Log Order Capture as a Sync Event
    await SyncLog.create({
      userId: integration.userId,
      productId: null,
      sku: "ORDER",
      productName: `New WhatsApp Order (${items.length} items)`,
      operation: "bulk_sync",
      status: "success",
      message: `Captured order for ${contact.phone} | Stock Updated`,
      details: { orderId: newOrder._id, amount: totalAmount, itemsCount: items.length }
    }).catch(e => console.error("Logger error:", e));

    console.log(`✅ [Commerce] Order created successfully!`);
    console.log(`🆔 [Commerce] Database ID: ${newOrder._id}`);
    console.log(`📞 [Commerce] Customer: ${contact.phone}`);
    console.log(`💰 [Commerce] Total: ₹${totalAmount}`);

    // Order captured successfully. Flow Engine will handle the rest.

    // Notify Admin (via socket)
    if (global.io) {
      global.io.to(integration.userId.toString()).emit("new_order", {
        ...newOrder.toObject(),
        customer: contact.name,
        amount: totalAmount
      });
    }

    // 🔥 NEW: Trigger Flow Builder for 'order_created'
    if (!newOrder.flowTriggered) {
      console.log(`🌊 [Commerce] Routing 'order_created' to Flow Engine for ${contact.phone}`);

      await flowEngine.triggerFlow({
        userId: integration.userId,
        phone: contact.phone,
        trigger: 'order_created',
        data: {
          order_id: newOrder._id,
          order_number: newOrder._id.toString().slice(-6).toUpperCase(),
          customer_name: contact.name || "Customer",
          phone: contact.phone,
          amount: totalAmount,
          total_items: items.length,
          order_status: newOrder.status || "pending",
          payment_status: "pending",
          invoice_url: newOrder.invoice_url || "",
          items: newOrder.items || [],
          order_date: newOrder.createdAt
        }
      }).catch(e => console.error("Flow trigger error:", e));

      // Mark as triggered
      newOrder.flowTriggered = true;
      await newOrder.save();
    }

  } catch (err) {
    console.error("❌ [Commerce] Order Creation Error:", err);
  }
}

/* ================= VERIFY ================= */
exports.verify = async (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token) {
    // 1. Check Global Token (Backward Compatibility / Admin)
    if (token === process.env.META_VERIFY_TOKEN) {
      console.log("✅ Webhook verified with GLOBAL token");
      return res.status(200).send(challenge);
    }

    // 2. Check by UserId in URL (Multi-Tenant Priority)
    if (req.params.userId) {
      const WhatsAppIntegration = require('../models/WhatsAppIntegration');
      const integration = await WhatsAppIntegration.findOne({ userId: req.params.userId });

      if (integration && integration.webhookVerifyToken === token) {
        console.log(`✅ Webhook verified for User ID (via URL): ${integration.userId}`);
        integration.webhookConfigured = true;
        integration.status = 'connected';
        await integration.save();
        return res.status(200).send(challenge);
      }
    }

    // 3. Fallback: Lookup by Token (legacy or root URL use)
    const integration = await whatsappIntegrationService.getIntegrationByWebhookToken(token);
    if (integration) {
      console.log(`✅ Webhook verified for User ID (via Token): ${integration.userId}`);

      // ✅ MARK AS CONFIGURED
      integration.webhookConfigured = true;
      integration.status = 'connected';
      await integration.save();

      return res.status(200).send(challenge);
    }
  }

  console.log("❌ Webhook verification failed. Token:", token);
  return res.sendStatus(403);
};

/* ================= HANDLE WEBHOOK ================= */
exports.handleWebhook = async (req, res) => {
  console.log("Webhook Received");
  // ⚡ RESPOND TO META IMMEDIATELY (Prevent timeouts & retries)
  res.sendStatus(200);

  let payload = req.body;
  try {
    // 🔧 FIX: Handle Buffer payload

    // 🚀 LOG WEBHOOK HIT
    console.log(`\n🚀 [Webhook] Incoming hit | Path: ${req.path}`);

    // Detect if req.body is a Buffer and convert to JSON
    if (Buffer.isBuffer(payload)) {
      console.log("� WEBHOOK DEBUG: Converting Buffer to JSON");
      payload = JSON.parse(payload.toString());
    }

    console.log("🔍 WEBHOOK DEBUG: Processed payload:", JSON.stringify(payload, null, 2));

    // Extract webhook values safely
    const entry = payload?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const msg = value?.messages?.[0];
    const statusUpdate = value?.statuses?.[0];

    console.log("🔍 WEBHOOK DEBUG: Extracted values:", {
      hasEntry: !!entry,
      hasChange: !!change,
      hasValue: !!value,
      hasMessage: !!msg,
      hasStatus: !!statusUpdate,
      phoneNumberId: value?.metadata?.phone_number_id
    });

    // ✅ HANDLE STATUS UPDATES (Sent / Delivered / Read / Failed)
    if (statusUpdate) {
      console.log(`📩 [WEBHOOK] Status update received: ${statusUpdate.status} for Meta ID: ${statusUpdate.id}`);

      try {
        const Message = require("../models/Message");
        const updateData = {
          status: statusUpdate.status,
          updatedAt: new Date()
        };

        // Capture error details if failed
        if (statusUpdate.status === 'failed') {
          updateData.error = statusUpdate.errors?.[0]?.message || "Unknown delivery error";
          console.error(`❌ Message Failed: ${updateData.error}`);
        }

        const updatedMsg = await Message.findOneAndUpdate(
          { metaMessageId: statusUpdate.id },
          updateData,
          { new: true }
        );

        if (updatedMsg) {
          console.log(`✅ Message status updated in DB: ${updatedMsg._id} -> ${statusUpdate.status}`);

          // 🔥 REAL-TIME CAMPAIGN TRACKING
          if (updatedMsg.campaignId) {
            const CampaignRecipient = require("../models/CampaignRecipient");
            const Campaign = require("../models/Campaign");

            const recipientUpdate = {
              status: statusUpdate.status,
              updatedAt: new Date()
            };

            if (statusUpdate.status === 'delivered') recipientUpdate.deliveredAt = new Date();
            if (statusUpdate.status === 'read') recipientUpdate.readAt = new Date();
            if (statusUpdate.status === 'failed') {
              recipientUpdate.failedAt = new Date();
              recipientUpdate.failureReason = statusUpdate.errors?.[0]?.message || "Unknown error";
            }

            const updatedRecipient = await CampaignRecipient.findOneAndUpdate(
              { campaignId: updatedMsg.campaignId, messageId: statusUpdate.id },
              recipientUpdate,
              { new: true }
            );

            if (updatedRecipient) {
              console.log(`✅ Campaign recipient status synced: ${statusUpdate.status}`);

              // Update Campaign summary metrics
              const campaignUpdate = {};
              // ONLY increment if the status is NEW (prevent over-counting on duplicate webhooks)
              if (statusUpdate.status === 'delivered') campaignUpdate.$inc = { deliveredCount: 1 };
              if (statusUpdate.status === 'read') campaignUpdate.$inc = { readCount: 1 };
              if (statusUpdate.status === 'failed') campaignUpdate.$inc = { failedCount: 1 };

              if (Object.keys(campaignUpdate).length > 0) {
                await Campaign.findByIdAndUpdate(updatedMsg.campaignId, campaignUpdate);
              }
            } else {
              // 🧪 FAILSAFE: If recipient not found by messageId, try by phone + campaignId
              const phoneSearch = updatedMsg.phone.replace(/\D/g, '').slice(-10);
              const fallbackRecipient = await CampaignRecipient.findOneAndUpdate(
                {
                  campaignId: updatedMsg.campaignId,
                  phone: { $regex: `${phoneSearch}$` },
                  status: { $ne: statusUpdate.status }
                },
                { ...recipientUpdate, messageId: statusUpdate.id },
                { new: true }
              );

              if (fallbackRecipient) {
                const campaignUpdate = {};
                if (statusUpdate.status === 'delivered') campaignUpdate.$inc = { deliveredCount: 1 };
                if (statusUpdate.status === 'read') campaignUpdate.$inc = { readCount: 1 };
                await Campaign.findByIdAndUpdate(updatedMsg.campaignId, campaignUpdate);
              }
            }
          }

          // 🔌 Emit socket event for real-time status update
          if (global.io) {
            const socketPayload = {
              messageId: updatedMsg._id,
              metaMessageId: updatedMsg.metaMessageId,
              status: updatedMsg.status, // e.g., "read", "delivered"
              customerId: updatedMsg.customerId,
              groupId: updatedMsg.groupId,
              campaignId: updatedMsg.campaignId
            };

            global.io.to(updatedMsg.userId.toString()).emit("message_status", socketPayload);
            console.log(`🔌 [Socket] 'message_status' emitted: ${updatedMsg.status} for ${updatedMsg.metaMessageId}`);
          }
        } else {
          console.warn(`⚠️ Message not found for status update: ${statusUpdate.id}`);
        }

      } catch (statusErr) {
        console.error("❌ Failed to process status update:", statusErr);
      }

      return;
    }

    // If no message, acknowledge and return
    if (!msg) {
      console.log("🔍 WEBHOOK DEBUG: No message or status in payload");
      return;
    }

    console.log(`[FLOW DEBUG] Webhook received`);
    console.log(`📱 [Webhook] Incoming message from: ${msg.from} | Type: ${msg.type} | ID: ${msg.id}`);

    // 1. Identify Integration (Tenant)
    const phoneNumberId = value?.metadata?.phone_number_id;
    if (!phoneNumberId) {
      console.log("🔍 WEBHOOK DEBUG: No phone_number_id in metadata");
      return;
    }

    console.log("🔍 WEBHOOK DEBUG: Looking for integration with phone_number_id:", phoneNumberId);
    let integration = await whatsappIntegrationService.getIntegrationByPhoneNumberId(phoneNumberId);
    console.log("🔍 WEBHOOK DEBUG: Integration lookup result:", integration ? {
      userId: integration.userId,
      phoneNumberId: integration.phoneNumberId,
      wabaId: integration.wabaId
    } : "NOT FOUND");

    // Fallback to WABA ID (Wait, usually phone_number_id is direct, but some events might only have waba_id)
    if (!integration && value?.metadata?.waba_id) {
      console.log("🔍 WEBHOOK DEBUG: Trying WABA ID fallback:", value.metadata.waba_id);
      const WhatsAppIntegration = require('../models/WhatsAppIntegration');
      const wabaIntegration = await WhatsAppIntegration.findOne({ wabaId: value.metadata.waba_id });
      if (wabaIntegration) {
        integration = wabaIntegration;
        console.log("🔍 WEBHOOK DEBUG: Found integration via WABA ID");
      }
    }

    if (!integration) {
      console.warn(`⚠️ No integration found for ID: ${phoneNumberId}`);
      return;
    }

    const from = normalizePhone(msg.from); // Normalized Customer phone number (e.g. +91...)
    const metaMessageId = msg.id;


    console.log("🔍 WEBHOOK DEBUG: Extracted info:", {
      from,
      metaMessageId,
      userId: integration.userId
    });

    // 2. Find Contact (Robust Lookup)
    console.log("🔍 WEBHOOK DEBUG: Looking for contact with phone:", from, "for user:", integration.userId);

    // Try exact match first, then last 10 digits
    let contact = await Contact.findOne({
      userId: integration.userId,
      phone: from
    });

    if (!contact) {
      console.log("🔍 WEBHOOK DEBUG: Exact match not found, trying last 10 digits");
      contact = await Contact.findOne({
        userId: integration.userId,
        phone: { $regex: `${from.slice(-10)}$` }
      });
    }

    console.log("🔍 WEBHOOK DEBUG: Contact lookup result:", contact ? {
      _id: contact._id,
      name: contact.name,
      phone: contact.phone,
      source: contact.source
    } : "NOT FOUND");

    // If contact still not found, we could auto-create it
    if (!contact) {
      console.log(`👤 Contact not found for ${from}, auto-creating...`);
      contact = await Contact.create({
        userId: integration.userId,
        name: value.contacts?.[0]?.profile?.name || from,
        phone: from,
        source: "whatsapp_inbound"
      });
      console.log("🔍 WEBHOOK DEBUG: Auto-created contact:", {
        _id: contact._id,
        name: contact.name,
        phone: contact.phone
      });
    } else {
      // ✅ SYNC PROFILE NAME (Fix "Unknown" or phone-only names permanently)
      const waProfileName = value.contacts?.[0]?.profile?.name;
      if (waProfileName && (!contact.name || contact.name === "Unknown" || contact.name === contact.phone || contact.name === "Customer")) {
        console.log(`👤 [Webhook] Syncing profile name for ${contact.phone}: '${contact.name}' -> '${waProfileName}'`);
        contact.name = waProfileName;
        await contact.save();
      }
    }

    console.log(`[FLOW DEBUG] Contact resolved`);

    // 🔥 NEW: Robust Name Resolution (Sync from Campaign if generic)
    if (contact.name === "Customer" || !isNaN(contact.name) || contact.name === contact.phone || contact.source === "whatsapp_inbound") {
      try {
        const CampaignRecipient = require("../models/CampaignRecipient");
        const recipient = await CampaignRecipient.findOne({
          phone: { $regex: `${from.slice(-10)}$` },
          userId: integration.userId,
          name: { $exists: true, $ne: "" }
        }).sort({ createdAt: -1 });

        if (recipient && recipient.name && recipient.name !== "Customer" && isNaN(recipient.name)) {
          console.log(`👤 [Name Rescue] Sycing name from Campaign for ${from}: ${contact.name} -> ${recipient.name}`);
          contact.name = recipient.name;
          await contact.save();
        }
      } catch (rescueErr) {
        console.error("⚠️ Name rescue failed:", rescueErr.message);
      }
    }

    // 3. Get/Create Conversation
    console.log("🔍 WEBHOOK DEBUG: Creating conversation for contact:", contact._id);
    const conversation = await conversationService.getOrCreateConversation(contact);
    console.log("🔍 CONVERSATION DEBUG: Webhook conversation result:", conversation ? {
      conversationId: conversation._id,
      customerId: conversation.customerId,
      userId: conversation.userId,
      state: conversation.state
    } : "NOT FOUND");

    if (!conversation) {
      console.error("❌ CONVERSATION DEBUG: Failed to create conversation for webhook");
      return;
    }

    console.log(`[FLOW DEBUG] Conversation ready`);

    if (conversation) {
      await conversationService.markInbound({
        conversationId: conversation._id,
        metaMessageId
      });
    }

    // 4. Record Campaign Reply (Optional but helpful for stats)
    try {
      const CampaignRecipient = require("../models/CampaignRecipient");
      const Campaign = require("../models/Campaign");

      // Look for a recent sent recipient doc
      const recipient = await CampaignRecipient.findOne({
        phone: { $regex: `${from.slice(-10)}$` },
        userId: integration.userId,
        status: { $in: ["sent", "delivered", "read"] }
      }).sort({ sentAt: -1 });

      if (recipient) {
        // ✅ NEW: Update Recipient document to reflect reply
        await CampaignRecipient.findByIdAndUpdate(recipient._id, {
          $set: {
            repliedAt: new Date(),
            // We don't change 'status' to 'replied' since enum only has 'sent'/'read' etc.
            // But we can check repliedAt field in frontend.
          }
        });

        const campaign = await Campaign.findById(recipient.campaignId);
        if (campaign) {
          // Increment reply count if not already replied for this specific campaign
          if (!campaign.repliedContacts.some(c => c.phone === from)) {
            campaign.replyCount = (campaign.replyCount || 0) + 1;
            campaign.repliedContacts.push({
              contactId: contact._id,
              phone: from,
              repliedAt: new Date()
            });
            await campaign.save();
            console.log(`✅ Campaign reply recorded for ${from} in campaign ${campaign.name}`);

            // 🔥 UPDATE CONTACT FOR FILTERING
            contact.lastCampaignId = recipient.campaignId;
            contact.campaignReplied = true;
            await contact.save();
          }
        }
      }
    } catch (campaignErr) {
      console.error("⚠️ Failed to record campaign reply:", campaignErr.message);
    }

    // 5. Check for Duplicates (Idempotency)
    console.log("🔍 WEBHOOK DEBUG: Checking for duplicate message with metaMessageId:", metaMessageId);
    const exists = await Message.findOne({ metaMessageId });
    if (exists) {
      console.log("⚠️ Duplicate message ignored:", metaMessageId);
      return;
    }

    // 6. Save Inbound Message (All Types)
    const replyText = extractReplyText(msg);
    const profileName = value.contacts?.[0]?.profile?.name || contact.name || from;
    console.log(`📝 [Webhook] Processing inbound content from ${profileName}...`);
    const savedMessage = await saveInboundMessage(integration, contact, conversation, msg, metaMessageId, profileName);
    console.log("Message Saved");
    console.log(`📍 [Webhook] Message persisted successfully with metaMessageId: ${metaMessageId}`);

    // 7. Update Contact Timestamps & Metadata (CRITICAL for Inbox Sorting)
    const savedMessageBody = savedMessage.body || replyText || "Message received";

    // 🔥 ATOMIC UPDATE: Increment unreadCount and update last message info
    const updatedContact = await Contact.findByIdAndUpdate(
      contact._id,
      {
        $inc: { unreadCount: 1 },
        $set: {
          lastSender: "customer",
          lastMessage: savedMessageBody,
          lastMessageTime: new Date(),
          lastIncomingAt: new Date(), // REFRESH 24h WINDOW
          isOnline: true,
          updatedAt: new Date()
        }
      },
      { new: true } // Return the updated document to get the new unreadCount
    );

    // 8. Prepare Flow Engine Inputs
    let engineInput = replyText || "";
    let eventType = "message";
    let metadata = { contactId: contact._id }; // FIXED: Initialize metadata BEFORE accessing it

    // ✅ TRIGGER: New Contact (if first time messaging)
    // IMPORTANT: Even if it's a new contact, we also want to allow keyword/campaign logic.
    // So we don't force 'contact' if there's potential for other triggers.
    if (!contact.lastIncomingAt) {
      console.log(`👤 [Webhook] First-time interaction detected for ${from}.`);
      // We keep eventType as "message" for now, but flow engine will handle Priority.
      // If we want a specific 'welcome' flow, we can use metadata to hint it.
      metadata.isNewContact = true;
    }

    if (msg.type === "interactive") {
      eventType = "interactive";
      const reply = msg.interactive?.list_reply || msg.interactive?.button_reply;
      
      if (msg.interactive?.type === "nfm_reply" || msg.interactive?.nfm_reply) {
        // Flow Engine will parse this stringified JSON back into an object
        engineInput = savedMessage.buttonPayload || JSON.stringify({ flow_submitted: true }); 
      } else if (reply) {
        engineInput = reply.id;
      } else {
        engineInput = replyText;
      }
      console.log(`🔘 [Webhook] Interactive Reply detected: ${engineInput}`);
    }

    // 🎯 METADATA EXTRACTION (Campaigns, Contextual Replies)
    try {
      // Check for Meta reply context (Reliable Campaign Link)
      if (msg.context?.id) {
        const Message = require("../models/Message");
        const originalMsg = await Message.findOne({ metaMessageId: msg.context.id });
        if (originalMsg?.campaignId) {
          console.log(`✅ [Webhook] Campaign reply detected via context!`);
          metadata.campaignId = originalMsg.campaignId;
          if (eventType === "message") eventType = "campaign";
        }
      }

      // Interactive button results from a campaign also count
      if (eventType === "button_click" && msg.interactive?.button_reply?.id) {
        if (!metadata.campaignId && msg.context?.id) {
          const Message = require("../models/Message");
          const originalMsg = await Message.findOne({ metaMessageId: msg.context.id });
          if (originalMsg?.campaignId) metadata.campaignId = originalMsg.campaignId;
        }
      }

      // 📊 STATS ONLY LOOKUP: Don't force eventType "campaign" for plain text fallback
      if (!metadata.campaignId) {
        const CampaignRecipient = require("../models/CampaignRecipient");
        const recentRecipient = await CampaignRecipient.findOne({
          phone: { $regex: `${from.slice(-10)}$` },
          userId: integration.userId,
          status: { $in: ["sent", "delivered", "read"] },
          sentAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }).sort({ sentAt: -1 });

        if (recentRecipient?.campaignId) {
          metadata.campaignId = recentRecipient.campaignId;
        }
      }
    } catch (metaErr) {
      console.error("⚠️ Metadata Extraction Error:", metaErr.message);
    }

    // 9. Process Event-Driven Flow Engine (CRITICAL: MUST RUN BEFORE UI UPDATE)
    console.log(`\n⚙️ [Webhook] Routing Event: ${eventType.toUpperCase()} -> Flow Engine`);
    console.log(`[FLOW DEBUG] Flow engine starting`);
    await flowEngine.handleIncomingEvent(integration.userId, from, eventType, engineInput, metadata);

    // 10. Update Frontend Socket/UI (After flow engine has run)
    if (global.io) {
      global.io.to(integration.userId.toString()).emit("new_message", {
        ...savedMessage.toObject(),
        conversationId: savedMessage.conversationId,
        customerId: savedMessage.customerId,
        groupId: savedMessage.groupId,
        direction: savedMessage.direction,
        type: savedMessage.type,
        body: savedMessage.body,
        text: savedMessage.text,
        metaMessageId: savedMessage.metaMessageId,
        createdAt: savedMessage.createdAt,
        status: savedMessage.status || 'received',
        unreadCount: updatedContact ? updatedContact.unreadCount : 1
      });
    }

    console.log(`   - Payload: "${engineInput}"`);
    console.log(`   - Phone: ${from}`);
    console.log(`   - Context:`, metadata);

    // 9. Auto-responses (Legacy)
    if (msg.type === "interactive") {
      const reply = msg.interactive?.button_reply || msg.interactive?.list_reply;
      if (reply?.id) {
        if (reply.id === "YES_CONTINUE") {
          await whatsappService.sendTextMessage(integration.userId, from, "✅ Thanks! We are proceeding further.");
        }
        if (reply.id === "CONTACT_SUPPORT") {
          await whatsappService.sendTextMessage(integration.userId, from, "📞 Our support team will reach you shortly.");
        }
        if (reply.id === "NOT_INTERESTED") {
          await whatsappService.sendTextMessage(integration.userId, from, "👍 No worries. Have a great day!");
        }
      }
    }

    // 7. Log for Super Admin auditing
    try {
      const WebhookLog = require("../models/WebhookLog");
      await WebhookLog.create({
        userId: integration.userId,
        source: "whatsapp",
        topic: msg.type,
        payload: payload, // Use processed payload instead of req.body
        headers: req.headers,
        status: "success",
        ip: req.ip
      });
    } catch (logErr) {
      console.error("⚠️ Failed to log WhatsApp webhook:", logErr.message);
    }

    return;

  } catch (err) {
    console.error("❌ Webhook Error:", err);
    // 📝 Log error for Master Admin
    try {
      const SystemLog = require("../models/SystemLog");
      await SystemLog.create({
        type: "error",
        message: `WhatsApp Webhook Error: ${err.message}`,
        ip: req.ip,
        metadata: { payload: payload || req.body } // Use processed payload or fallback to req.body
      });
    } catch (logErr) {
      console.error("❌ Failed to log webhook error:", logErr.message);
    }
    return;
  }
};
