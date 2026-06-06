const whatsappService = require("../../services/whatsappService");
const conversationService = require("../../services/conversation.service");
const mongoose = require("mongoose");
const metaSocialController = require("../../controllers/metaSocial.controller");

/**
 * 📝 Helper: Centralized Inbox Logger
 * Records flow-sent messages in the database and emits socket events for real-time UI updates.
 */
const logFlowMessageToInbox = async ({ userId, phone, type, body, text, mediaUrl, mediaType, buttons, buttonText, metaMessageId, templateName, footer }) => {
    console.log(`[Flow Logger] 📝 START logFlowMessageToInbox | Phone: ${phone} | Type: ${type} | User: ${userId}`);
    console.log("Reply Sending");
    try {
        const Message = require("../../models/Message");
        const Contact = require("../../models/Contact");

        const cleanNum = phone.toString().replace(/\D/g, '').slice(-10);
        console.log(`[Flow Logger] Looking for contact with last 10 digits: ${cleanNum}`);
        const contact = await Contact.findOne({ userId, phone: { $regex: `${cleanNum}$` } });

        if (!contact) {
            console.warn(`[Flow Logger] ❌ Contact NOT FOUND in DB for ${phone}. userId: ${userId}. Search regex: ${cleanNum}$`);
            return;
        }

        // 🛡️ LOOP PROTECTION: Prevent infinite auto-reply loops
        const thirtySecondsAgo = new Date(Date.now() - 30000);
        const recentBotMessages = await Message.countDocuments({
            userId,
            phone,
            sender: "bot",
            createdAt: { $gte: thirtySecondsAgo }
        });

        if (recentBotMessages >= 4) {
            console.warn(`[Flow Control] 🛡️ Loop detected for ${phone}. Sent ${recentBotMessages} msgs in 30s. Skipping log/emit to break loop.`);
            return;
        }

        console.log(`[Flow Logger] ✅ Found Contact: ${contact.name} (${contact._id})`);
        const conversation = await conversationService.getOrCreateConversation(contact);
        console.log(`[Flow Logger] ✅ Found/Created Conversation: ${conversation?._id}`);

        let finalBody = body || text;
        let finalButtons = buttons;

        // 🔍 If it's a template, try to fetch the actual body and buttons for the UI
        if (type === "template" && templateName) {
            try {
                const Template = require("../../models/Template");
                const query = { userId };
                if (mongoose.isValidObjectId(templateName)) {
                    query.$or = [{ _id: templateName }, { name: templateName }, { metaTemplateName: templateName }];
                } else {
                    query.$or = [{ name: templateName }, { metaTemplateName: templateName }];
                }

                const template = await Template.findOne(query);
                if (template) {
                    finalBody = template.body;
                    finalButtons = template.buttons;
                }
            } catch (tempErr) {
                console.warn(`[Flow Logger] Could not fetch template details: ${tempErr.message}`);
            }
        }

        const messageData = {
            userId,
            customerId: contact._id,
            conversationId: conversation?._id,
            phone: phone,
            sender: "bot",
            senderName: "Bot",
            direction: "outgoing",
            type,
            status: "sent",
            body: finalBody || body || text || (type === "template" ? `📄 Template: ${templateName}` : "Automated response"),
            text: text || body || finalBody || "",
            metaMessageId,
            createdAt: new Date()
        };

        if (mediaUrl) {
            messageData.mediaUrl = mediaUrl;
            messageData.mediaType = mediaType || "image";
            if (type === "template") messageData.image = mediaUrl;
        }

        if (buttons) messageData.buttons = buttons;
        if (templateName) messageData.templateName = templateName;
        if (footer) messageData.footer = footer;
        if (buttonText) messageData.buttonText = buttonText;

        const savedMsg = await Message.create(messageData);
        console.log(`[Flow Logger] ✅ Message saved to DB: ${savedMsg._id} | Type: ${savedMsg.type} | Body: ${savedMsg.body.substring(0, 30)}...`);

        // Update contact last message info (CRITICAL for Inbox Sorting)
        await Contact.findByIdAndUpdate(contact._id, {
            lastSender: "bot",
            lastMessage: messageData.body,
            lastMessageTime: new Date(),
            updatedAt: new Date()
        });

        // 🔌 Emit socket event for real-time updates
        if (global.io) {
            const socketPayload = {
                ...savedMsg.toObject(),
                conversationId: savedMsg.conversationId,
                customerId: savedMsg.customerId,
                direction: savedMsg.direction,
                type: savedMsg.type,
                body: savedMsg.body,
                text: savedMsg.text,
                metaMessageId: savedMsg.metaMessageId,
                createdAt: savedMsg.createdAt,
                status: savedMsg.status,
                sender: savedMsg.sender,
                senderName: savedMsg.senderName,
                buttons: savedMsg.buttons || finalButtons,
                buttonText: savedMsg.buttonText
            };

            console.log(`[Flow Logger] 🔌 Emitting new_message to room: ${userId}`);
            global.io.to(userId.toString()).emit("new_message", socketPayload);
            console.log(`[FLOW DEBUG] WhatsApp reply sent`);
        }

        return savedMsg;
    } catch (err) {
        console.error(`[Flow Logger] ❌ Error recording message: ${err.message}`);
    }
};

exports.logFlowMessageToInbox = logFlowMessageToInbox;

/**
 * 🛰️ Robust Variable Replacement System
 * Handles System vars, Contact data, and Complex Third-party objects (Shopify/Woo/Campaign)
 */
const replaceVariables = (text, variables) => {
    if (!text || typeof text !== "string") return text;
    let result = text;

    // 1. Common Mapping Context
    const triggerData = variables.triggerData || {};
    const contactData = variables.contactData || {};

    // 2. Fixed System Variables (Backward Compatibility)
    const sysVars = {
        "{{contact_name}}": contactData.name || variables.patient_name || triggerData.customer?.first_name || triggerData.customerName || triggerData.customer_name || "Customer",
        "{{customer_name}}": variables.patient_name || triggerData.customer_name || contactData.name || "Customer",
        "{{patient_name}}": variables.patient_name || triggerData.customer_name || contactData.name || "Customer",
        "{{contact_phone}}": contactData.phone || triggerData.phone || triggerData.customerPhone || "N/A",
        "{{customer_phone}}": variables.patient_mobile || variables.phone || "N/A",
        "{{appointment_date}}": variables.appointment_date || variables.Date || "N/A",
        "{{appointment_time}}": variables.appointment_time || variables.Time || "N/A",
        "{{department}}": variables.department || variables.Department || "General",
        "{{clinic_name}}": variables.clinic_name || variables.Clinic || "Zepofy Medical Center",
        "{{order_number}}": triggerData.order_number || triggerData.name || triggerData.id || triggerData.order_id || triggerData.orderId || "N/A",
        "{{order_id}}": triggerData.order_number || triggerData.name || triggerData.order_id || triggerData.orderId || triggerData.id || "N/A",
        "{{order_total}}": (triggerData.total_price || triggerData.total || triggerData.amount || triggerData.totalAmount || "0.00").toString(),
        "{{order_amount}}": (triggerData.amount || triggerData.totalAmount || "0.00").toString(),
        "{{amount}}": (triggerData.amount || triggerData.totalAmount || "0.00").toString(),
        "{{currency}}": triggerData.currency || "INR",
        "{{tracking_link}}": triggerData.order_status_url || triggerData.trackingLink || "N/A",
        "{{checkout_url}}": triggerData.abandoned_checkout_url || triggerData.checkoutUrl || "N/A",
        "{{invoice_url}}": triggerData.invoice_url || "N/A",
        "{{order_status}}": triggerData.order_status || "N/A",
        "{{order_items}}": (triggerData.items || []).map(i => `\n- ${i.name} x${i.quantity} (₹${i.price})`).join('') || "N/A",
        "{{order_date}}": triggerData.order_date ? new Date(triggerData.order_date).toLocaleDateString() : "N/A",
        "{{product_list}}": (triggerData.items || []).map(i => `\n- ${i.name} x${i.quantity} (₹${i.price})`).join('') || "N/A",
        "{{tracking_id}}": triggerData.tracking_id || triggerData.trackingId || ""
    };

    Object.keys(sysVars).forEach(key => {
        result = result.split(key).join(sysVars[key]);
    });

    // 3. Dynamic Dot-Notation Resolution: {{shopify.order.name}}
    const regex = /\{\{([^}]+)\}\}/g;
    result = result.replace(regex, (match, expression) => {
        const path = expression.trim().split('.');
        let current = variables;

        for (const segment of path) {
            if (current && typeof current === 'object' && segment in current) {
                current = current[segment];
            } else {
                current = null;
                break;
            }
        }

        // 🔥 FALLBACK: If not found in dynamic paths, check top-level triggerData keys directly
        if (current === null || current === undefined) {
            const key = expression.trim();
            current = triggerData[key] || contactData[key];
        }

        return current !== null && current !== undefined ? String(current) : (match || "N/A");
    });

    return result;
};

exports.replaceVariables = replaceVariables;

/**
 * 📩 Handler: Send Template
 */
exports.handleSendTemplateNode = async (node, context, userId) => {
    if (!node || !node.data) {
        console.error("[Flow] ❌ Node or data missing in handleSendTemplateNode");
        return { success: false, error: "Invalid node structure" };
    }
    // Support both 'templateName' and 'template' keys from frontend
    const tName = node.data.templateName || node.data.template || node.data.metaTemplateName;
    const phone = context.phone;

    console.log(`[Flow] 🚀 Dispatching Template Node: ${tName} -> ${phone}`);
    console.log(`[Flow] Node Data:`, JSON.stringify(node.data));
    console.log(`[Flow] User ID: ${userId}`);

    if (!phone || !tName) {
        console.error(`[Flow] ❌ Template Dispatch Aborted: Missing Phone (${phone}) or Template Name (${tName})`);
        return { success: false, error: "Missing config" };
    }

    const {
        variables = {},
        languageCode = "en_US"
    } = node.data;

    try {
        const bodyParams = Object.keys(variables).sort().map(k =>
            replaceVariables(variables[k], { ...context.variables, triggerData: context.triggerData })
        );

        const dispatchResult = await whatsappService.sendFlowTemplateMessage({
            userId,
            to: phone,
            templateName: tName,
            language: languageCode,
            bodyParams,
            headerImageUrl: node.data.headerImageUrl
        });

        console.log(`[Flow] ✅ Template dispatched via WhatsApp Service. ID: ${dispatchResult?.metaMessageId}`);

        // 📝 SAFE INBOX LOGGER: Run in background to keep flow speed high
        logFlowMessageToInbox({
            userId,
            phone,
            type: "template",
            templateName: tName,
            metaMessageId: dispatchResult?.metaMessageId
        });
        console.log(`[Flow] ✅ logFlowMessageToInbox call completed.`);

        return { success: true };
    } catch (err) {
        console.error(`[Flow] ❌ Template Dispatch Error:`, err.message);
        return { success: false, error: err.message };
    }
};

/**
 * 🛠 Handler: Send System Template (INTERNAL SUB-FLOW)
 * Optimized to handle multiple messages and delays sequentially.
 */
exports.handleSendSystemTemplateNode = async (node, context, userId) => {
    if (!node || !node.data) {
        console.error("[Flow] ❌ Node or data missing in handleSendSystemTemplateNode");
        return { success: false, error: "Invalid node structure" };
    }
    const templateId = node.data?.templateId || node.data?.id;
    const phone = context.phone;

    console.log("Executing SYSTEM_TEMPLATE Logic Switch");

    if (!templateId || !phone) {
        console.error("❌ Missing required template configuration");
        return { success: false, error: "Missing config" };
    }

    try {
        const SystemTemplate = require("../../models/SystemTemplate");
        const template = await SystemTemplate.findById(templateId);

        if (!template) {
            console.error("❌ System Template Not Found:", templateId);
            return { success: false, error: "Template not found" };
        }

        console.log("🚀 [Sub-Flow] Executing:", template.name);

        // 🧠 Architecture Check: Multi-step support
        let steps = template.steps || [];

        // --- 🔙 FALLBACK: If NO steps found, treat old fields as a single step ---
        if (steps.length === 0) {
            console.log("⚠️ [Sub-Flow] No steps defined. Falling back to legacy single-message payload.");
            steps = [{
                type: template.buttons?.length > 0 ? "BUTTON" : (template.imageUrl ? "MEDIA" : "TEXT"),
                message: template.message,
                imageUrl: template.imageUrl,
                buttons: (template.buttons || []).map(b => b.label),
                delay: 0
            }];
        }

        let hasLastButtons = false;

        // 🔄 SEQUENTIAL EXECUTION LOOP
        for (const step of steps) {
            const stepType = step.type.toUpperCase();
            const messageText = replaceVariables(step.message || "", { ...context.variables, triggerData: context.triggerData });

            console.log(`📡 [Sub-Flow] Sending step: ${stepType} for template ${template.name}`);

            try {
                if (stepType === "TEXT") {
                    const res = await whatsappService.sendTextMessage(userId, phone, messageText);
                    logFlowMessageToInbox({ userId, phone, type: "text", body: messageText, metaMessageId: res?.metaMessageId });
                }
                else if (stepType === "MEDIA") {
                    const res = await whatsappService.sendImageMessage({
                        userId,
                        to: phone,
                        imageUrl: step.imageUrl,
                        caption: messageText
                    });
                    logFlowMessageToInbox({ userId, phone, type: "image", body: messageText, mediaUrl: step.imageUrl, metaMessageId: res?.metaMessageId });
                }
                else if (stepType === "BUTTON") {
                    hasLastButtons = true; // Track if we need to pause flow
                    const res = await whatsappService.sendButtonMessage(userId, phone, messageText, (step.buttons || []), (step.imageUrl ? { url: step.imageUrl, type: "image" } : null));
                    logFlowMessageToInbox({ userId, phone, type: "button", body: messageText, buttons: (step.buttons || []), metaMessageId: res?.metaMessageId });
                }

                // Support for built-in delays in template steps
                if (step.delay && step.delay > 0) {
                    console.log(`⏱️ [Sub-Flow] Delaying for ${step.delay}s...`);
                    await new Promise(res => setTimeout(res, step.delay * 1000));
                }
            } catch (stepErr) {
                console.error(`❌ [Sub-Flow] Error in step execution:`, stepErr.message);
            }
        }

        console.log("✅ [Sub-Flow] Execution Complete");
        return { success: true, hasButtons: hasLastButtons };
    } catch (err) {
        console.error("❌ System Template Execution Error:", err.message);
        return { success: false, error: err.message };
    }
};

/**
 * 💬 Handler: Send Text (Buttons Supported - Reply, URL, Call)
 */
exports.handleSendMessageNode = async (node, context, userId) => {
    if (!node || !node.data) {
        console.error("[Flow] ❌ Node or data missing in handleSendMessageNode");
        return { success: false, error: "Invalid node structure" };
    }
    const rawText = node.data.text || "Hello!";
    let text = replaceVariables(rawText, { ...context.variables, triggerData: context.triggerData });
    const phone = context.phone;
    const buttons = node.data.buttons || [];

    console.log(`[Flow] 💬 Dispatching Text: ${phone} | Buttons: ${buttons.length}`);

    try {
        let replyButtons = [];
        let urlButtons = [];

        console.log(`[Flow Engine] 🔍 RAW Buttons from Node:`, JSON.stringify(buttons, null, 2));

        // 🛡️ STRICT BUTTON DETECTION
        buttons.forEach((btn, i) => {
            const label = btn.text || btn.label || btn.title || `Option ${i + 1}`;
            const type = (btn.type || "").toLowerCase();
            const value = btn.url || btn.link || btn.value;

            // Check if it's a URL
            const isUrl = type === "url" || type === "website" || (typeof value === 'string' && value.startsWith("http"));

            if (isUrl) {
                urlButtons.push({ label, value });
            } else if (btn) {
                // Only add as reply button if it's NOT a URL or Call
                if (replyButtons.length < 3) {
                    replyButtons.push({
                        type: "reply",
                        reply: { id: btn.id || `btn-${i}`, title: label.substring(0, 20) }
                    });
                }
            }
        });

        console.log(`[Flow Engine] 📊 Processed - Reply: ${replyButtons.length}, URL: ${urlButtons.length}`);

        // ==========================================
        // META PLATFORMS (Instagram / Facebook)
        // ==========================================
        if (context.platform === "instagram" || context.platform === "facebook") {
            let linksText = "";
            urlButtons.forEach(b => linksText += `\n🔗 *${b.label}:* ${b.value}`);
            if (linksText) text += `\n${linksText}`;

            let messagePayload = { text: text || "Select option:" };

            if (replyButtons.length > 0) {
                // Meta Quick Replies format
                messagePayload.quick_replies = replyButtons.map(btn => ({
                    content_type: "text",
                    title: btn.reply.title.substring(0, 20),
                    payload: btn.reply.id
                }));
            }

            const res = await metaSocialController.sendFlowMessage(userId, context.platform, phone, messagePayload);
            // We do not need to call logFlowMessageToInbox here because sendFlowMessage handles logging and sockets
            return { success: true };
        }

        // ==========================================
        // WHATSAPP PLATFORM
        // ==========================================
        // 🚀 SCENARIO 1: Exactly ONE URL button (Native CTA)
        if (urlButtons.length === 1 && replyButtons.length === 0) {
            console.log(`[Flow Engine] 🎯 TRIGGERED: Scenario 1 (Native CTA URL)`);
            const payload = {
                type: "cta_url",
                body: { text: text || "Visit Website" },
                action: {
                    name: "cta_url",
                    parameters: { display_text: urlButtons[0].label.substring(0, 20), url: urlButtons[0].value }
                }
            };
            console.log(`[Flow Engine] 📦 Payload:`, JSON.stringify(payload, null, 2));
            const res = await whatsappService.sendInteractiveMessage(userId, phone, payload);
            logFlowMessageToInbox({ userId, phone, type: "button", body: text, buttons: urlButtons, metaMessageId: res?.metaMessageId });
            return { success: true };
        }

        // 🚀 SCENARIO 3: Multiple Buttons or Reply Buttons -> Fallback to Text Links
        let linksText = "";
        urlButtons.forEach(b => linksText += `\n🔗 *${b.label}:* ${b.value}`);

        if (linksText) text += `\n${linksText}`;

        if (replyButtons.length > 0) {
            const res = await whatsappService.sendInteractiveMessage(userId, phone, {
                type: "button",
                body: { text: text || "Select option:" },
                action: { buttons: replyButtons }
            });
            logFlowMessageToInbox({ userId, phone, type: "button", body: text, buttons: replyButtons, metaMessageId: res?.metaMessageId });
        } else {
            const res = await whatsappService.sendTextMessage(userId, phone, text);
            logFlowMessageToInbox({ userId, phone, type: "text", body: text, metaMessageId: res?.metaMessageId });
        }
        return { success: true };
    } catch (err) {
        console.error(`[Flow] ❌ Text Dispatch Error:`, err.message);
        return { success: false };
    }
};

/**
 * 🖼️ Handler: Send Media (With Interactive Buttons - Reply, URL, Call)
 */
exports.handleMediaNode = async (node, context, userId) => {
    if (!node || !node.data) {
        console.error("[Flow] ❌ Node or data missing in handleMediaNode");
        return { success: false, error: "Invalid node structure" };
    }
    const imageUrl = node.data.imageUrl || node.data.url;
    let caption = replaceVariables(node.data.text || "", { ...context.variables, triggerData: context.triggerData });
    const phone = context.phone;
    const mediaType = node.data.mediaType || "image";
    const buttons = node.data.buttons || [];

    console.log(`[Flow] 🖼️ Dispatching Media: ${mediaType} -> ${phone} | Buttons: ${buttons.length}`);

    if (!phone || !imageUrl) return { success: false, error: "Missing Target or Media URL" };

    try {
        let replyButtons = [];
        let urlButtons = [];

        buttons.forEach((btn, i) => {
            const label = btn.text || btn.label || btn.title || `Option ${i + 1}`;
            const type = (btn.type || "").toLowerCase();
            const value = btn.url || btn.link || btn.value;

            // Check if it's a URL
            const isUrl = type === "url" || type === "website" || (typeof value === 'string' && value.startsWith("http"));

            if (isUrl) {
                urlButtons.push({ label, value });
            } else if (btn) {
                if (replyButtons.length < 3) {
                    replyButtons.push({
                        type: "reply",
                        reply: { id: btn.id || `btn-${i}`, title: label.substring(0, 20) }
                    });
                }
            }
        });

        // 🚀 CTA for Media
        if (urlButtons.length === 1 && replyButtons.length === 0) {
            const res = await whatsappService.sendInteractiveMessage(userId, phone, {
                type: "cta_url",
                header: { type: mediaType, [mediaType]: { link: imageUrl } },
                body: { text: caption || "Visit Website" },
                action: {
                    name: "cta_url",
                    parameters: { display_text: urlButtons[0].label.substring(0, 20), url: urlButtons[0].value }
                }
            });
            logFlowMessageToInbox({ userId, phone, type: "button", body: caption, mediaUrl: imageUrl, mediaType, buttons: urlButtons, metaMessageId: res?.metaMessageId });
            return { success: true };
        }

        let linksText = "";
        urlButtons.forEach(b => linksText += `\n🔗 *${b.label}:* ${b.value}`);

        if (linksText) caption += `\n${linksText}`;

        if (replyButtons.length > 0) {
            const res = await whatsappService.sendInteractiveMessage(userId, phone, {
                type: "button",
                header: { type: mediaType, [mediaType]: { link: imageUrl } },
                body: { text: caption || "Select option:" },
                action: { buttons: replyButtons }
            });
            logFlowMessageToInbox({ userId, phone, type: "button", body: caption, mediaUrl: imageUrl, mediaType, buttons: replyButtons, metaMessageId: res?.metaMessageId });
        } else {
            const res = await whatsappService.sendMediaMessage({
                userId,
                to: phone,
                mediaUrl: imageUrl,
                mediaType,
                caption
            });
            logFlowMessageToInbox({ userId, phone, type: mediaType, body: caption, mediaUrl: imageUrl, mediaType, metaMessageId: res?.metaMessageId });
        }
        return { success: true };
    } catch (err) {
        console.error(`[Flow] ❌ Media Dispatch Error:`, err.message);
        return { success: false };
    }
};

/**
 * 📋 Handler: Interactive List Menu
 */
exports.handleInteractiveListNode = async (node, context, userId) => {
    if (!node || !node.data) {
        console.error("[Flow] ❌ Node or data missing in handleInteractiveListNode");
        return { success: false, error: "Invalid node structure" };
    }
    const phone = context.phone;
    const bodyText = replaceVariables(node.data.bodyText || node.data.text || "Please select an option:", { ...context.variables, triggerData: context.triggerData });
    const footerText = replaceVariables(node.data.footerText || "", { ...context.variables, triggerData: context.triggerData });
    const buttonText = replaceVariables(node.data.buttonText || "Open Menu", { ...context.variables, triggerData: context.triggerData });
    const sections = node.data.sections || [];

    console.log(`[Flow] 📋 Dispatching List Menu: ${phone} | Sections: ${sections.length}`);

    try {
        const res = await whatsappService.sendListMessage({
            userId,
            to: phone,
            bodyText,
            footerText,
            buttonText,
            sections: sections.map(sec => ({
                title: replaceVariables(sec.title || "Options", { ...context.variables, triggerData: context.triggerData }),
                rows: (sec.rows || []).map(row => ({
                    id: row.id,
                    title: replaceVariables(row.title || "Option", { ...context.variables, triggerData: context.triggerData }),
                    description: replaceVariables(row.description || "", { ...context.variables, triggerData: context.triggerData })
                }))
            }))
        });

        logFlowMessageToInbox({
            userId,
            phone,
            type: "list_reply",
            body: bodyText,
            footer: footerText,
            text: bodyText,
            buttonText: buttonText,
            metaMessageId: res?.metaMessageId
        });
        return { success: true };
    } catch (err) {
        console.error(`[Flow] ❌ List Menu Dispatch Error:`, err.message);
        return { success: false };
    }
};

/**
 * 🧑‍💻 Handler: Human Handover
 */
exports.handleHumanAgentNode = async (node, context, userId, session) => {
    const phone = context.phone;
    const msg = node.data.handoverMessage || "An agent will be with you shortly.";

    console.log(`[Flow] 🧑‍💻 Initiating Human Handover: ${phone}`);

    try {
        const res = await whatsappService.sendTextMessage(userId, phone, msg);
        logFlowMessageToInbox({ userId, phone, type: "text", body: msg, metaMessageId: res?.metaMessageId });

        if (session) {
            session.human = true;
            session.status = "running"; // Keep active so it can be resumed or context kept
            await session.save();
        }

        if (global.io) {
            global.io.to(userId.toString()).emit("human_intervention", { phone, userId });
        }
        return { success: true };
    } catch (err) {
        console.error(`[Flow] ❌ Handover Failed:`, err.message);
        return { success: false };
    }
};

/**
 * ⚙️ Handler: Logic / Commerce Action
 * Performs database updates based on flow selection
 */
exports.handleActionNode = async (node, context, userId) => {
    if (!node || !node.data) return { success: false, error: "Invalid node" };

    const actionType = node.data.actionType || node.data.action;
    const { triggerData = {}, phone } = context;
    const orderId = triggerData.order_id || triggerData.orderId;

    console.log(`[Flow] ⚙️ Executing Action: ${actionType} for ${phone} | Order: ${orderId}`);

    try {
        const Order = require("../../models/Order");

        switch (actionType) {
            case "confirm_order":
                if (!orderId) throw new Error("Order ID missing for confirmation");
                const confirmedOrder = await Order.findOneAndUpdate({ _id: orderId, userId }, { status: "confirmed" }, { new: true });
                if (global.io && confirmedOrder) {
                    global.io.to(userId.toString()).emit("order_updated", { orderId: confirmedOrder._id, status: "confirmed" });
                }
                return { success: true };

            case "mark_paid":
                if (!orderId) throw new Error("Order ID missing for payment update");
                const paidOrder = await Order.findOneAndUpdate({ _id: orderId, userId }, { status: "paid", paymentStatus: "paid" }, { new: true });
                if (global.io && paidOrder) {
                    global.io.to(userId.toString()).emit("order_updated", { orderId: paidOrder._id, status: "paid" });
                }
                return { success: true };

            case "cancel_order": {
                try {
                    const order = await Order.findById(orderId);
                    if (order) {
                        if (['shipped', 'delivered', 'shipped_out'].includes(order.status)) {
                            const cancelMsg = `🚫 *Cannot Cancel Order*\n\nYour order #${(orderId || 'N/A').toString().slice(-6).toUpperCase()} has already been *${order.status}* and cannot be cancelled.\n\nPlease contact support for returns.`;
                            const res = await whatsappService.sendTextMessage(userId, phone, cancelMsg);
                            await logFlowMessageToInbox({ userId, phone, type: "text", body: cancelMsg, metaMessageId: res?.metaMessageId });
                            return { success: false, error: "Already shipped" };
                        }
                        order.status = 'cancelled';
                        await order.save();
                        const successMsg = `🚫 *Order Cancelled*\n\nYour order #${(orderId || 'N/A').toString().slice(-6).toUpperCase()} has been cancelled as requested.`;
                        const res = await whatsappService.sendTextMessage(userId, phone, successMsg);
                        await logFlowMessageToInbox({ userId, phone, type: "text", body: successMsg, metaMessageId: res?.metaMessageId });
                        if (global.io) global.io.to(userId.toString()).emit("order_updated", { orderId: order._id, status: 'cancelled' });
                    }
                } catch (err) {
                    console.error("❌ [Cancel Order] Error:", err.message);
                }
                return { success: true };
            }

            case "track_order": {
                const trackId = triggerData.tracking_id || triggerData.trackingId;
                if (trackId) {
                    const trackingMsg = `🚚 *ORDER SHIPPED!*\n\nOrder ID: #${(orderId || 'N/A').toString().slice(-6).toUpperCase()}\nStatus: *In Transit*\nTracking ID: *${trackId}*\n\nYou can track your package on our website.`;
                    const res = await whatsappService.sendInteractiveMessage(userId, phone, {
                        type: "button",
                        body: { text: trackingMsg },
                        action: {
                            buttons: [
                                { type: "reply", reply: { id: "track_web", title: "Track on Web" } },
                                { type: "reply", reply: { id: "menu", title: "Main Menu" } }
                            ]
                        }
                    });
                    await logFlowMessageToInbox({ userId, phone, type: "interactive", body: trackingMsg, metaMessageId: res?.metaMessageId });
                }
                return { success: true };
            }

            case "assign_agent": {
                const Contact = require("../../models/Contact");
                const contact = await Contact.findOne({ userId, phone });
                if (contact) {
                    const Conversation = require("../../models/Conversation");
                    await Conversation.findOneAndUpdate(
                        { customerId: contact._id, userId },
                        { status: "open", agentId: null }, // Reset agent or leave for auto-assignment
                        { new: true }
                    );
                    if (global.io) {
                        global.io.to(userId.toString()).emit("agent_assigned", {
                            contactId: contact._id,
                            phone: contact.phone,
                            name: contact.name
                        });
                    }
                    console.log(`👤 [Flow Engine] Agent assigned for ${phone}`);
                }
                return { success: true };
            }

            case "send_payment_link": {
                const amt = triggerData.amount || triggerData.totalAmount || "0.00";
                const payMsg = `💳 *Complete Your Payment*\n\nTotal Amount: *₹${amt}*\nOrder ID: #${(orderId || 'N/A').toString().slice(-6).toUpperCase()}\n\nPlease click below to pay securely:`;

                const res = await whatsappService.sendInteractiveMessage(userId, phone, {
                    type: "button",
                    body: { text: payMsg },
                    action: {
                        buttons: [
                            { type: "reply", reply: { id: "pay_now", title: "Pay Now ₹" + amt } }
                        ]
                    }
                });
                await logFlowMessageToInbox({ userId, phone, type: "button", body: payMsg, metaMessageId: res?.metaMessageId });
                return { success: true };
            }

            case "send_invoice": {
                const invoiceAmt = triggerData.amount || triggerData.totalAmount || "0.00";
                const invoiceItems = (triggerData.items || []).map(i => `${i.name} x${i.quantity} - ₹${i.price * i.quantity}`).join('\n');
                const invoiceText = `📄 *ORDER INVOICE*\n\nOrder ID: #${(orderId || 'N/A').toString().slice(-6).toUpperCase()}\nDate: ${new Date().toLocaleDateString()}\n\n*Items:*\n${invoiceItems}\n\n*Total Amount:* ₹${invoiceAmt}\n\nThank you for shopping with us!`;
                const res = await whatsappService.sendTextMessage(userId, phone, invoiceText);
                await logFlowMessageToInbox({ userId, phone, type: "text", body: invoiceText, metaMessageId: res?.metaMessageId });
                return { success: true };
            }

            case "book_appointment":
            case "create_appointment": {
                const fs = require("fs");
                const path = require("path");
                const logPath = path.join(__dirname, "../../booking_debug.log");
                const log = (msg) => fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);

                const Appointment = require("../../models/Appointment");
                const Contact = require("../../models/Contact");
                const variables = context.variables || {};

                log(`🔍 Booking request from ${phone}. Variables: ${JSON.stringify(variables)}`);

                // --- FLEXIBLE VARIABLE EXTRACTION ---
                const getVar = (keys) => {
                    for (const key of keys) {
                        if (variables[key]) return variables[key];
                        // Try with spaces replaced by underscores and vice versa
                        const altKey1 = key.replace(/_/g, ' ');
                        if (variables[altKey1]) return variables[altKey1];
                        const altKey2 = key.replace(/ /g, '_');
                        if (variables[altKey2]) return variables[altKey2];
                    }
                    return null;
                };

                const date = getVar(['appointment_date', 'Date', 'date', 'appointmentDate', 'Appointment Date', 'Appt Date']);
                const time = getVar(['appointment_time', 'Time', 'time', 'appointmentTime', 'Appointment Time', 'Appt Time']);
                const name = getVar(['patient_name', 'Name', 'contact_name', 'customer_name', 'Patient Name', 'Customer Name']) || context.name || "Patient";
                const clinic = getVar(['clinic_name', 'Clinic', 'clinic', 'Clinic Name']) || "Zepofy Medical Center";
                const symptoms = getVar(['Symptoms', 'notes', 'symptoms', 'Problem']) || "";

                if (!date || !time) {
                    log(`❌ Failed: Missing Date (${date}) or Time (${time}). Variables present: ${Object.keys(variables).join(', ')}`);
                    // Fallback: If we have ANY variable that looks like a date/time, try to use it
                    if (!date || !time) {
                        throw new Error("Missing appointment date or time. Please ensure you capture 'appointment_date' and 'appointment_time' in your flow.");
                    }
                }

                // 🛡️ Resolve Contact ID if missing
                let finalContactId = context.contactId || variables.contactId;
                if (!finalContactId) {
                    const contact = await Contact.findOne({ userId, phone });
                    if (contact) finalContactId = contact._id;
                }

                // 🛡️ DOUBLE BOOKING CHECK
                const existing = await Appointment.findOne({
                    userId,
                    appointmentDate: date,
                    appointmentTime: time,
                    status: { $in: ["pending", "scheduled"] }
                });

                if (existing) {
                    log(`🚫 Slot already taken: ${date} @ ${time}`);
                    const errorMsg = `❌ *Slot Unavailable*\n\nSorry, the slot on *${date}* at *${time}* is already booked by another customer.\n\nPlease try choosing a different time or date.`;
                    const res = await whatsappService.sendTextMessage(userId, phone, errorMsg);
                    await logFlowMessageToInbox({ userId, phone, type: "text", body: errorMsg, metaMessageId: res?.metaMessageId });
                    return { success: false, error: "Slot already booked" };
                }

                try {
                    // ✅ CREATE APPOINTMENT
                    const newAppointment = await Appointment.create({
                        userId,
                        contactId: finalContactId,
                        customerName: name,
                        customerPhone: phone,
                        appointmentDate: date,
                        appointmentTime: time,
                        clinicName: clinic,
                        notes: symptoms,
                        status: "pending", // Create as pending for admin approval
                        metaData: {
                            customer_name: name,
                            customer_phone: phone,
                            appointment_date: date,
                            appointment_time: time,
                            clinic_name: clinic,
                            ...variables
                        }
                    });

                    log(`✅ Booked Successfully: ${newAppointment._id} for ${phone}`);

                    // Notify via Socket
                    if (global.io) {
                        global.io.to(userId.toString()).emit("new_appointment", newAppointment);
                    }

                    return { success: true, appointmentId: newAppointment._id };
                } catch (saveErr) {
                    log(`❌ DB Save Failed: ${saveErr.message}`);
                    return { success: false, error: saveErr.message };
                }
            }

            case "cancel_appointment":
            case "cancel_booking": {
                const Appointment = require("../../models/Appointment");
                const appointment = await Appointment.findOne({
                    userId,
                    customerPhone: phone,
                    status: { $in: ["pending", "scheduled"] }
                }).sort({ createdAt: -1 });

                if (appointment) {
                    appointment.status = "cancelled";
                    await appointment.save();

                    // Notify via Socket
                    if (global.io) {
                        global.io.to(userId.toString()).emit("appointment_updated", appointment);
                        global.io.to(userId.toString()).emit("appointment_cancelled", { appointmentId: appointment._id });
                    }
                }
                return { success: true };
            }

            default:
                console.warn(`[Flow Action] Unknown action type: ${actionType}`);
                return { success: false, error: "Unknown action" };
        }
    } catch (err) {
        console.error(`[Flow Action] ❌ Failed:`, err.message);
        return { success: false, error: err.message };
    }
};
/**
 * 💳 Handler: Payment Node
 */
exports.handlePaymentNode = async (node, context, userId) => {
    if (!node || !node.data) return { success: false, error: "Invalid node" };

    const { phone, triggerData = {} } = context;
    const { paymentType, bodyText, qrCodeUrl, paymentLink, footerText } = node.data;

    // Use the robust global variable replacement system
    const finalBody = replaceVariables(bodyText || "Please complete your payment.", context);
    const finalFooter = replaceVariables(footerText || "", context);

    console.log(`[Flow] 💳 Sending Payment (${paymentType}) to ${phone}`);

    try {
        const buttons = [{ id: "paid", title: "✅ I have Paid" }];

        if (paymentType === 'qr') {
            if (!qrCodeUrl) throw new Error("QR Code URL is missing");

            // Send Interactive Image Message (Header = QR, Body = Text, Button = Paid)
            const res = await whatsappService.sendButtonMessage(
                userId,
                phone,
                finalBody,
                buttons,
                { type: 'image', url: qrCodeUrl }
            );
            await logFlowMessageToInbox({ userId, phone, type: "image", body: finalBody, imageUrl: qrCodeUrl, metaMessageId: res?.metaMessageId });
        } else {
            // Send Interactive Text Message with Payment Link
            const link = replaceVariables(paymentLink || "{{checkout_url}}", context);
            const fullMessage = `${finalBody}\n\n🔗 *Payment Link:* ${link}${finalFooter ? `\n\n_${finalFooter}_` : ''}`;

            const res = await whatsappService.sendButtonMessage(userId, phone, fullMessage, buttons);
            await logFlowMessageToInbox({ userId, phone, type: "text", body: fullMessage, metaMessageId: res?.metaMessageId });
        }
        return { success: true };
    } catch (err) {
        console.error(`[Flow] 💳 Payment Node Failed:`, err.message);
        return { success: false, error: err.message };
    }
};

/**
 * 📝 Handler: WhatsApp Flow Node
 */
exports.handleWhatsAppFlowNode = async (node, context, userId) => {
    if (!node || !node.data) return { success: false, error: "Invalid node" };

    const { phone, triggerData = {} } = context;
    const { flowId, bodyText, buttonText } = node.data;

    // Use the robust global variable replacement system
    const finalBody = replaceVariables(bodyText || "Please fill out this form.", context);
    const finalButtonText = buttonText || "Open Form";

    console.log(`[Flow] 📝 Sending WhatsApp Flow (${flowId}) to ${phone}`);

    try {
        if (!flowId) {
            throw new Error("Flow ID is missing in node data");
        }

        const WhatsAppFlow = require("../whatsappFlows/models/whatsappFlow.model");
        const flow = await WhatsAppFlow.findById(flowId);
        
        if (!flow || !flow.flowId) {
            throw new Error("WhatsApp Flow not found or not synced to Meta.");
        }

        if (flow.status !== 'PUBLISHED' && flow.status !== 'APPROVED') {
            throw new Error("Only PUBLISHED flows can be sent to customers.");
        }

        let firstScreen = 'WELCOME_SCREEN';
        try {
            const metaJson = typeof flow.metaFlowJSON === 'string' ? JSON.parse(flow.metaFlowJSON) : flow.metaFlowJSON;
            if (metaJson?.screens && metaJson.screens.length > 0) {
                firstScreen = metaJson.screens[0].id;
            } else if (metaJson?.routing?.default) {
                firstScreen = metaJson.routing.default;
            }
        } catch (e) {
            console.log('Error parsing metaFlowJSON for routing defaults', e);
        }

        // Construct the Interactive Flow Object
        const interactive = {
            type: "flow",
            header: {
                type: "text",
                text: flow.name || "Form"
            },
            body: {
                text: finalBody
            },
            action: {
                name: "flow",
                parameters: {
                    flow_message_version: "3",
                    flow_token: `zepofy_flow_${Date.now()}`,
                    flow_id: flow.flowId,
                    flow_cta: finalButtonText.substring(0, 20),
                    flow_action: "navigate",
                    flow_action_payload: {
                        screen: firstScreen
                    }
                }
            }
        };

        const res = await whatsappService.sendInteractiveMessage(
            userId,
            phone,
            interactive
        );

        // Extract log text safely
        const combinedText = `[WhatsApp Flow: ${interactive.header.text}]\n${interactive.body.text}\n🔗 Button: ${interactive.action.parameters.flow_cta}`;
        
        await logFlowMessageToInbox({ 
            userId, 
            phone, 
            type: "interactive", 
            body: combinedText, 
            metaMessageId: res?.metaMessageId 
        });

        return { success: true };
    } catch (err) {
        console.error(`[Flow] 📝 WhatsApp Flow Node Failed:`, err.message);
        return { success: false, error: err.message };
    }
};
