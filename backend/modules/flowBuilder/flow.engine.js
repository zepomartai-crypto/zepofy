const Flow = require("./flow.model");
const FlowSession = require("../../models/FlowSession");
const nodeHandlers = require("./node.handlers");
const whatsappService = require("../../services/whatsappService");

class FlowEngine {
    /**
     * 🚀 Central Event Handler
     * 🧠 INTELLIGENT ROUTER: Handles inbound text, button clicks, and third-party webhooks.
     */
    async handleIncomingEvent(userId, phone, type, payload, metadata = {}) {
        console.log("Flow Engine Started");
        try {
            if (!userId || !phone) return;
            
            const isMetaPlatform = metadata?.platform === "instagram" || metadata?.platform === "facebook";
            const cleanPhone = isMetaPlatform ? phone.toString() : phone.toString().replace(/\D/g, '');
            const inputStr = (payload || "").toString().toLowerCase().trim();

            console.log(`\n🌊 [Flow Engine] Routing ${type.toUpperCase()} | Phone: ${cleanPhone} | Input: "${inputStr}" | User: ${userId}`);

            // 0. GLOBAL OVERRIDE: Check for universal navigation keywords (Menu, Help, Support)
            const globalKeywords = ["menu", "help", "support", "track", "order", "cancel"];
            const isGlobalTrigger = type === "message" && globalKeywords.includes(inputStr);

            // 1. SESSION MANAGEMENT: Find or Resume
            let session = await FlowSession.findOne({
                contactPhone: cleanPhone,
                userId: userId,
                status: { $in: ["active", "waiting", "paused_for_delay", "running"] }
            }).populate("flowId");

            // Handle Global Override: If user wants a menu, we kill the old session and start fresh
            if (isGlobalTrigger && session) {
                console.log(`🔄 [Flow Engine] Global keyword "${inputStr}" detected. Overriding active session ${session._id}`);
                session.status = "completed";
                await session.save();
                session = null;
            }

            // Self-Healing: If flow was deleted, end session
            if (session && !session.flowId) {
                console.warn(`⚠️ [Flow Engine] Cleanup: Session orphaned by deleted flow.`);
                session.status = "completed";
                await session.save();
                session = null;
            }

            // Self-Healing: If parent flow is paused, end session
            if (session && session.flowId && session.flowId.status !== "active") {
                console.warn(`⚠️ [Flow Engine] Cleanup: Flow "${session.flowId.name}" is no longer active.`);
                session.status = "completed";
                await session.save();
                session = null;
            }

            // Session Timeout: If session is older than 24 hours, break it
            if (session) {
                const sessionAgeHours = (Date.now() - new Date(session.updatedAt).getTime()) / (1000 * 60 * 60);
                if (sessionAgeHours >= 24) {
                    console.log(`⏳ [Flow Engine] Session timeout: Session ${session._id} is older than 24h. Resetting.`);
                    session.status = "completed";
                    await session.save();
                    session = null;
                }
            }

            // 2. TRIGGER MATCHING (Priority: Session > Campaign > Keyword > Catch-All)
            let matchedFlow = null;
            let orphanedTargetNode = null;

            if (!session) {

                // Priority 1: Campaign Reply Flow (Replies to campaign templates take priority over keywords)
                // If user replies ANYTHING after campaign template: instantly continue campaign flow, no keyword required
                if (metadata.campaignId || type === "campaign") {
                    console.log(`[Flow Engine] Campaign Reply detected. Finding flow for Campaign: ${metadata.campaignId || 'Metadata missing'}`);
                    matchedFlow = await this.triggerFlowByType(userId, cleanPhone, "campaign", metadata);
                }

                // Fallback to autonomous discovery (last 24h) if no direct link
                if (!matchedFlow && type === "message") {
                    try {
                        const CampaignRecipient = require("../../models/CampaignRecipient");
                        const recentCampaign = await CampaignRecipient.findOne({
                            phone: { $regex: `${cleanPhone.slice(-10)}$` },
                            userId: userId,
                            status: { $in: ["sent", "delivered", "read"] },
                            sentAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                        }).sort({ sentAt: -1 });

                        if (recentCampaign) {
                            console.log(`[Flow Engine] Autonomous Campaign Discovery: Found recent campaign ${recentCampaign.campaignId} for ${cleanPhone}`);
                            matchedFlow = await this.triggerFlowByType(userId, cleanPhone, "campaign", {
                                campaignId: recentCampaign.campaignId
                            });
                        }
                    } catch (err) {
                        console.error("⚠️ Campaign Lookup Error:", err.message);
                    }
                }

                // Priority 2: Platform Specific Triggers (Commerce, Shopify, WooCommerce, etc.)
                if (!matchedFlow) {
                    const platformTriggers = ["order_created", "payment_success", "order_status_updated", "cart_abandoned", "shopify", "woocommerce", "contact"];
                    if (platformTriggers.includes(type)) {
                        matchedFlow = await this.triggerFlowByType(userId, cleanPhone, type, metadata);
                    }
                }

                // Priority 3: Keyword Match & Catch-all
                if (!matchedFlow && (type === "message" || type === "interactive" || type === "contact")) {
                    const platform = metadata?.platform || "whatsapp";
                    const activeFlows = await Flow.find({ userId, status: "active", platform: platform });

                    // 1. Try Specific Keyword Match First
                    matchedFlow = activeFlows.find(f => {
                        if (!f || !f.nodes) return false;
                        const triggerNode = f.nodes.find(n => n.data?.type === "trigger" || n.type === "trigger");
                        const nodeData = triggerNode?.data || {};
                        const triggerType = (f.triggerType || nodeData.triggerType || "").toLowerCase();
                        const isMsg = triggerType === "keyword" || triggerType === "message received" || triggerType.includes("message") || triggerType.includes("keyword");
                        if (!isMsg) return false;

                        const keywords = f.keywords?.length > 0 ? f.keywords : (nodeData.keywords || []);
                        if (!keywords || keywords.length === 0) return false;

                        const msg = inputStr.toLowerCase().trim();
                        return keywords.some(k => {
                            const kw = String(k).toLowerCase().trim();
                            return msg === kw || msg.includes(kw);
                        });
                    });

                    // 1.5: Orphaned Interactive Reply Routing (No active session, but button/list clicked)
                    orphanedTargetNode = null;
                    if (!matchedFlow && (type === "interactive" || type === "button_click")) {
                        console.log(`[Flow Engine] Searching for orphaned interactive reply across all flows: "${inputStr}"`);

                        for (const f of activeFlows) {
                            if (!f.nodes) continue;

                            // Look through all interactive nodes in the flow
                            const interactiveNodes = f.nodes.filter(n => n.type === 'interactive_list' || n.data?.type === 'interactive_list' || n.type === 'interactive_button' || n.data?.type === 'interactive_button' || n.type === 'user_input' || n.data?.type === 'user_input');

                            for (const node of interactiveNodes) {
                                const nextNode = this.resolveNextNode(f, node.id, inputStr, true);
                                if (nextNode) {
                                    matchedFlow = f;
                                    orphanedTargetNode = nextNode.id;
                                    break;
                                }
                            }
                            if (matchedFlow) break;
                        }
                    }

                    // 2. Fallback to Catch-all Flow (Empty Keywords)
                    // CRITICAL: Catch-all should ONLY trigger for plain text messages. 
                    // Never trigger catch-all for interactive responses (buttons/lists) to avoid loops or redundant menus.
                    if (!matchedFlow && type === "message") {
                        matchedFlow = activeFlows.find(f => {
                            if (!f || !f.nodes) return false;
                            const triggerNode = f.nodes.find(n => n.data?.type === "trigger" || n.type === "trigger");
                            const nodeData = triggerNode?.data || {};
                            const triggerType = (f.triggerType || nodeData.triggerType || "").toLowerCase();
                            const isMsg = triggerType === "keyword" || triggerType === "message received" || triggerType.includes("message") || triggerType.includes("keyword");
                            if (!isMsg) return false;

                            const keywords = f.keywords?.length > 0 ? f.keywords : (nodeData.keywords || []);
                            return (!keywords || keywords.length === 0);
                        });

                        if (matchedFlow) {
                            console.log(`🌊 [Flow Engine] No keyword match. Routing to catch-all flow: "${matchedFlow.name}"`);
                        }
                    }
                }

                if (matchedFlow) {
                    console.log(`[FLOW DEBUG] Flow matched`);

                    // 🔥 FLOW COOLDOWN CHECK
                    const cooldownHours = matchedFlow.cooldownHours || 0;
                    if (cooldownHours > 0) {
                        const cooldownMs = cooldownHours * 60 * 60 * 1000;
                        const recentSession = await FlowSession.findOne({
                            flowId: matchedFlow._id,
                            contactPhone: cleanPhone,
                            userId: userId,
                            createdAt: { $gte: new Date(Date.now() - cooldownMs) }
                        });

                        if (recentSession) {
                            console.log(`⏳ [Flow Engine] Cooldown active for flow "${matchedFlow.name}" (${cooldownHours}h). Skipping execution.`);
                            return; // Stop entirely to prevent loops
                        }
                    }

                    if (orphanedTargetNode) {
                        console.log(`🌊 [Flow Engine] ✅ Matched Flow for Orphaned Reply: "${matchedFlow.name}". Jumping to node: ${orphanedTargetNode}`);

                        // Clear old sessions
                        await FlowSession.updateMany(
                            { contactPhone: cleanPhone, userId, status: { $in: ["active", "waiting", "running"] } },
                            { $set: { status: "completed" } }
                        );

                        const session = await FlowSession.create({
                            userId,
                            flowId: matchedFlow._id,
                            contactPhone: cleanPhone,
                            currentNodeId: orphanedTargetNode,
                            status: "running",
                            variables: { ...metadata, initial_input: inputStr },
                            triggerData: metadata.shopifyData || metadata.wooData || metadata || {}
                        });

                        const Contact = require("../../models/Contact");
                        if (metadata.contactId) {
                            await Contact.findByIdAndUpdate(metadata.contactId, {
                                flowStatus: "active",
                                updatedAt: new Date()
                            });
                        }

                        return await this.executeFlow(session, matchedFlow);
                    } else {
                        console.log(`🌊 [Flow Engine] ✅ Matched Flow: "${matchedFlow.name}" (${matchedFlow._id}). Starting...`);
                        return await this.startFlow(matchedFlow, cleanPhone, userId, inputStr, metadata);
                    }
                } else {
                    console.log(`🌊 [Flow Engine] ❌ No flow matched for input: "${inputStr}"`);

                    // 🔥 AI FALLBACK: Trigger Gemini if no flow matched
                    if (type === "message") {
                        try {
                            const User = require("../../models/User");
                            const AIIntegration = require("../../models/AIIntegration");

                            // 1. Check SuperAdmin Master Permission
                            const userDoc = await User.findById(userId);
                            const isAllowedByMaster = userDoc?.integrations?.ai_bot?.enabled !== false;

                            if (!isAllowedByMaster) {
                                console.log(`🚫 [Flow Engine] AI Fallback blocked: Disabled by SuperAdmin for user ${userId}`);
                            } else {
                                // 2. Check User's Personal AI Settings
                                const aiSettings = await AIIntegration.findOne({ userId, enabled: true });

                                if (aiSettings) {
                                    console.log(`🤖 [Flow Engine] Routing to AI Fallback for: "${inputStr}"`);
                                    const aiService = require("../../services/ai.service");
                                    const aiResponse = await aiService.generateResponse(userId, cleanPhone, inputStr);

                                    if (aiResponse) {
                                        const whatsappService = require("../../services/whatsappService");
                                        const res = await whatsappService.sendTextMessage(userId, cleanPhone, aiResponse);
                                        const metaMessageId = res?.messages?.[0]?.id;

                                        // 📝 SAVE AI RESPONSE TO MESSAGES TABLE (Inbox Visibility)
                                        try {
                                            const { logFlowMessageToInbox } = require("./node.handlers");
                                            await logFlowMessageToInbox({
                                                userId,
                                                phone: cleanPhone,
                                                type: "text",
                                                text: aiResponse,
                                                metaMessageId
                                            });
                                        } catch (logErr) {
                                            console.error("❌ [Flow Engine] AI Inbox Logging Error:", logErr.message);
                                        }

                                        // Record AI interaction in Contact
                                        const Contact = require("../../models/Contact");
                                        if (metadata.contactId) {
                                            await Contact.findByIdAndUpdate(metadata.contactId, {
                                                lastMessage: aiResponse,
                                                lastSender: "bot",
                                                lastMessageTime: new Date(),
                                                updatedAt: new Date()
                                            });
                                        }
                                        console.log(`✅ [Flow Engine] AI Fallback successful`);
                                        return;
                                    } else {
                                        console.log(`⚠️ [Flow Engine] AI Fallback: Service returned empty response.`);
                                    }
                                } else {
                                    console.log(`ℹ️ [Flow Engine] AI Fallback skipped: AI not configured or enabled by user.`);
                                }
                            }
                        } catch (aiErr) {
                            console.error("❌ [Flow Engine] AI Fallback Error:", aiErr.message);
                        }
                    }
                }


                // 2.1 LOG FAILED TRIGGER: If message didn't match any active keyword flow
                if (type === "message" && !matchedFlow) {
                    const activeKeywordFlows = await Flow.find({ userId, status: "active" });
                    for (const f of activeKeywordFlows) {
                        const triggerNode = f.nodes.find(n => n.data?.type === "trigger" || n.type === "trigger");
                        const tType = f.triggerType || triggerNode?.data?.triggerType || "";
                        if (tType === "keyword" || tType === "" || tType === "message received") {
                            // Only log if no recent failure (last 10 mins) to avoid spam
                            const recentFail = await FlowSession.findOne({
                                flowId: f._id,
                                contactPhone: cleanPhone,
                                status: "failed",
                                updatedAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) }
                            });

                            if (!recentFail) {
                                await FlowSession.create({
                                    userId,
                                    flowId: f._id,
                                    contactPhone: cleanPhone,
                                    currentNodeId: "TRIGGER_FAILED",
                                    status: "failed",
                                    lastInput: inputStr,
                                    lastEvent: "message"
                                });
                            } else {
                                recentFail.lastInput = inputStr;
                                await recentFail.save();
                            }
                        }
                    }
                }
                return;
            }

            if (session.human) return console.log("🧑‍💻 [Flow Engine] Human agent in control. Automation suspended.");

            // 💾 DATA CAPTURE for WhatsApp Flow Forms
            if (type === "interactive" && payload && session.currentNodeId) {
                const currentNode = session.flowId?.nodes?.find(n => n.id === session.currentNodeId);
                if (currentNode && (currentNode.type === "whatsapp_flow" || currentNode.data?.type === "whatsapp_flow")) {
                    try {
                        const parsedFlowData = JSON.parse(payload.toString());
                        console.log(`💾 [Flow Engine] Capturing WhatsApp Flow data:`, parsedFlowData);
                        
                        // Merge all form fields into variables
                        session.variables = {
                            ...(session.variables || {}),
                            ...parsedFlowData,
                        };
                        await session.save();
                    } catch(e) {
                        // Not a valid JSON payload, might just be a regular button click
                    }
                }
            }

            // 💾 DATA CAPTURE: If we were waiting for a specific variable, save it now
            if (session.variables?.last_requested_var) {
                const varName = session.variables.last_requested_var;
                const currentNodeId = session.currentNodeId;
                const currentNode = session.flowId?.nodes?.find(n => n.id === currentNodeId);
                const nodeData = { ...(currentNode?.data || {}) };

                // ⚡ AUTO-DETECT VALIDATION TYPE (Smart Detection)
                if (!nodeData.validation) {
                    const lowVar = varName.toLowerCase();
                    if (lowVar.includes('phone') || lowVar.includes('mobile') || lowVar.includes('contact')) nodeData.validation = 'phone';
                    else if (lowVar.includes('date')) nodeData.validation = 'date';
                    else if (lowVar.includes('time')) nodeData.validation = 'time';
                    else if (lowVar.includes('pincode') || lowVar.includes('zip') || lowVar.includes('postal')) nodeData.validation = 'pincode';
                }

                // 🛡️ ADVANCED VALIDATION (Production Ready)
                let isValid = true;
                let errorMsg = "";
                let payload = inputStr;

                if (nodeData.validation === 'address') {
                    const hasNumbers = /\d/.test(payload);
                    const hasLetters = /[a-zA-Z]/.test(payload);
                    if (payload.length < 8 || !hasNumbers || !hasLetters) {
                        isValid = false;
                        errorMsg = "📍 *Incomplete Address!*\n\nPlease provide a full address including House/Building No, Street and City.\n(Example: 123, MG Road, Mumbai)";
                    }
                } else if (nodeData.validation === 'pincode') {
                    const pin = payload.toString().replace(/\D/g, '');
                    if (pin.length !== 6) {
                        isValid = false;
                        errorMsg = "❌ *Invalid Pincode!*\n\nPlease enter a valid *6-digit* postal code.\n\n(Example: 380001)";
                    }
                } else if (nodeData.validation === 'phone') {
                    // 📱 Clean: Remove +91, 0, and all non-digits
                    let clean = payload.toString().replace(/\D/g, '');

                    if (clean.length === 12 && clean.startsWith('91')) clean = clean.slice(2);
                    else if (clean.length === 11 && clean.startsWith('0')) clean = clean.slice(1);

                    if (clean.length !== 10) {
                        isValid = false;
                        errorMsg = "❌ *Invalid Mobile Number!*\n\nThe mobile number you entered is incorrect. Please enter a valid *10-digit* mobile number.\n\n(Example: 9876543210)";
                    } else {
                        payload = clean; // Store cleaned version
                    }
                } else if (nodeData.validation === 'date') {
                    let dateStr = payload.toString().toLowerCase().trim();
                    if (dateStr === 'today' || dateStr === 'tomorrow') {
                        const d = new Date();
                        if (dateStr === 'tomorrow') d.setDate(d.getDate() + 1);
                        payload = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                    } else {
                        const dateRegex = /^(\d{1,2})[\/\-.](\d{1,2})([\/\-.](\d{2,4}))?$/;
                        const match = dateStr.match(dateRegex);
                        if (match && match[1] && match[2]) {
                            let day = parseInt(match[1]);
                            let month = parseInt(match[2]);
                            let year = match[4] || new Date().getFullYear().toString();
                            if (year.length === 2) year = '20' + year;
                            if (day > 31 || month > 12) {
                                isValid = false;
                                errorMsg = "❌ *Invalid Date!*\n\nThat doesn't seem like a real date. Please check and try again.\n\n(Example: 25/05/2026)";
                            } else {
                                payload = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
                            }
                        } else {
                            isValid = false;
                            errorMsg = "📅 *Invalid Date Format!*\n\nPlease enter the date clearly in *DD/MM/YYYY* format.\n\n(Example: 25/05/2026 or 'Tomorrow')";
                        }
                    }
                } else if (nodeData.validation === 'time') {
                    let timeStr = payload.toString().toLowerCase().trim();
                    const timeRegex = /^(\d{1,2})[:.]?(\d{2})?\s*(am|pm)?$/;
                    const match = timeStr.match(timeRegex);

                    if (match) {
                        let hour = parseInt(match[1]);
                        let min = parseInt(match[2] || "00");
                        let period = match[3] ? match[3].toUpperCase() : null;

                        // 🛡️ AM/PM REQUIREMENT: If ambiguous (e.g. "10"), require AM/PM
                        if (!period && hour <= 12 && !timeStr.includes(':')) {
                            isValid = false;
                            errorMsg = "⏰ *Is that AM or PM?*\n\nPlease specify if it is morning (*AM*) or evening (*PM*).\n\n(Example: 10:00 AM or 05:00 PM)";
                        } else {
                            if (!period) {
                                if (hour > 12) { hour -= 12; period = 'PM'; }
                                else if (hour === 0) { hour = 12; period = 'AM'; }
                                else { period = hour >= 9 && hour < 12 ? 'AM' : 'PM'; }
                            }
                            if (hour > 12 || min > 59) {
                                isValid = false;
                                errorMsg = "❌ *Invalid Time!*\n\nPlease enter a valid time.\n\n(Example: 10:30 AM)";
                            } else {
                                payload = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')} ${period}`;
                            }
                        }
                    } else {
                        isValid = false;
                        errorMsg = "⏰ *Invalid Time Format!*\n\nPlease enter the time clearly with *AM* or *PM*.\n\n(Example: 10:30 AM or 05:00 PM)";
                    }
                }

                if (!isValid) {
                    await whatsappService.sendTextMessage(userId, phone, errorMsg);
                    console.log(`🚫 [Flow Engine] Validation failed for ${varName} ("${payload}"). Prompting retry.`);
                    return;
                }

                if (isValid && nodeData.validation === 'address') {
                    const pinMatch = payload.match(/\b\d{6}\b/);
                    if (pinMatch) {
                        const extractedPin = pinMatch[0];
                        console.log(`🎯 [Flow Engine] Extracted pincode from address: ${extractedPin}`);
                        session.variables.pincode = extractedPin;
                    }
                }

                console.log(`💾 [Flow Engine] Capturing variable: {{${varName}}} = "${payload}"`);

                session.variables = {
                    ...(session.variables || {}),
                    [varName]: payload,
                    last_requested_var: null
                };

                // 🛍️ COMMERCE AUTO-SYNC: Update linked Order model if present
                const orderId = session.triggerData?.order_id || session.triggerData?.orderId || session.variables?.order_id;
                if (orderId && (['address', 'delivery_address', 'pincode'].includes(varName))) {
                    try {
                        const Order = require("../../models/Order");
                        const order = await Order.findById(orderId);
                        if (order) {
                            if (varName === 'address' || varName === 'delivery_address') {
                                order.address = payload;
                            } else if (varName === 'pincode') {
                                const cleanPin = payload.toString().replace(/\D/g, '');
                                if (order.address && !order.address.includes(cleanPin)) {
                                    order.address = order.address.trim() + ", " + cleanPin;
                                } else if (!order.address) {
                                    order.address = cleanPin;
                                }
                            }
                            await order.save();
                            console.log(`✅ [Flow Engine] Order ${orderId} synced with ${varName}`);
                            if (global.io) {
                                global.io.to(userId.toString()).emit("order_updated", { orderId: order._id, address: order.address });
                            }
                        }
                    } catch (err) {
                        console.error("❌ [Commerce Sync] Error:", err.message);
                    }
                }
            }

            const flow = session.flowId;
            if (!flow || !flow.nodes) {
                console.error(`[Flow Engine] Invalid flow structure for session ${session._id}`);
                session.status = "failed";
                return await session.save();
            }

            const isClick = type === "button_click" || type === "interactive";

            // 3.5 COMMERCE SHORTCUT: Handle direct action buttons (Pay Now, Track, etc)
            if (isClick && ["pay_now", "cancel_order", "track_order", "send_invoice", "order_arrival", "cancel_appointment", "cancel_booking"].includes(inputStr)) {
                console.log(`⚡ [Flow Engine] Direct Commerce Action Detected: ${inputStr}`);
                const context = {
                    phone: cleanPhone,
                    userId: userId,
                    variables: session.variables || {},
                    triggerData: session.triggerData || {}
                };
                await this.executeCommerceAction(inputStr, context, userId);
                // After executing action, we still continue the flow path if one exists
            }

            // Resolve path from the CURRENT node based on the NEW input
            let nextNode = this.resolveNextNode(flow, session.currentNodeId, inputStr, isClick);

            if (!nextNode) {
                console.log(`🔍 [Flow Engine] No path in current node for "${inputStr}". Checking for keyword/catch-all fallback...`);

                const activeFlows = await Flow.find({ userId, status: "active" });
                let fallbackFlow = activeFlows.find(f => {
                    if (!f || !f.nodes) return false;
                    const triggerNode = f.nodes.find(n => n.data?.type === "trigger" || n.type === "trigger");
                    const nodeData = triggerNode?.data || {};
                    const triggerType = (f.triggerType || nodeData.triggerType || "").toLowerCase();
                    const isMsg = triggerType === "keyword" || triggerType === "message received" || triggerType.includes("message") || triggerType.includes("keyword");
                    if (!isMsg) return false;

                    const keywords = f.keywords?.length > 0 ? f.keywords : (nodeData.keywords || []);
                    if (!keywords || keywords.length === 0) return false;

                    const msg = inputStr.toLowerCase().trim();
                    return keywords.some(k => {
                        const kw = String(k).toLowerCase().trim();
                        return msg === kw || msg.includes(kw);
                    });
                });

                // If no keyword match, try Catch-All (Empty keywords)
                if (!fallbackFlow && type === "message") {
                    fallbackFlow = activeFlows.find(f => {
                        if (!f || !f.nodes) return false;
                        const triggerNode = f.nodes.find(n => n.data?.type === "trigger" || n.type === "trigger");
                        const nodeData = triggerNode?.data || {};
                        const triggerType = (f.triggerType || nodeData.triggerType || "").toLowerCase();
                        const isMsg = triggerType === "keyword" || triggerType === "message received" || triggerType.includes("message") || triggerType.includes("keyword");
                        if (!isMsg) return false;

                        const keywords = f.keywords?.length > 0 ? f.keywords : (nodeData.keywords || []);
                        return (!keywords || keywords.length === 0);
                    });
                }

                if (fallbackFlow) {
                    // 🔥 FLOW COOLDOWN CHECK FOR FALLBACK
                    const cooldownHours = fallbackFlow.cooldownHours || 0;
                    if (cooldownHours > 0) {
                        const cooldownMs = cooldownHours * 60 * 60 * 1000;
                        const recentSession = await FlowSession.findOne({
                            flowId: fallbackFlow._id,
                            contactPhone: cleanPhone,
                            userId: userId,
                            createdAt: { $gte: new Date(Date.now() - cooldownMs) }
                        });

                        if (recentSession) {
                            console.log(`⏳ [Flow Engine] Cooldown active for fallback flow "${fallbackFlow.name}" (${cooldownHours}h). Skipping execution.`);
                            session.status = "completed";
                            return await session.save();
                        }
                    }

                    console.log(`🌊 [Flow Engine] Fallback triggered: Starting flow "${fallbackFlow.name}"`);
                    session.status = "completed";
                    await session.save();
                    return await this.startFlow(fallbackFlow, cleanPhone, userId, inputStr, metadata);
                }

                console.log(`⚠️ [Flow Engine] No valid path or fallback found for "${inputStr}". Keeping session active and prompting retry.`);
                const whatsappService = require("../../services/whatsappService");
                await whatsappService.sendTextMessage(userId, cleanPhone, "⚠️ Invalid response. Please select a valid option from the menu above, or type 'cancel' to exit.");
                return; // Keep session waiting!
            }

            // Update session state before loop starts
            session.currentNodeId = nextNode.id;
            session.lastInput = inputStr;
            session.lastEvent = type;
            session.status = "running";
            await session.save();

            return await this.executeFlow(session, flow);

        } catch (error) {
            console.error(`❌ [Flow Engine] Event Routing Error:`, error);
        }
    }

    /**
     * RESTORE Flow trigger (Legacy Wrapper)
     */
    async handleIncomingMessage(phone, input, userId, metadata = {}) {
        return await this.handleIncomingEvent(userId, phone, "message", input, metadata);
    }

    /**
     * Start flow by platform trigger (Shopify, WooCommerce, Contact, Campaign)
     */
    async triggerFlowByType(userId, phone, type, metadata = {}) {
        try {
            const platform = metadata?.platform || "whatsapp";
            const activeFlows = await Flow.find({ userId, status: "active", platform: platform });
            const flow = activeFlows.find(f => {
                if (!f || !f.nodes) return false;
                const triggerType = (f.triggerType || "").toLowerCase();
                const triggerNode = f.nodes.find(n => n.data?.type === "trigger" || n.type === "trigger");
                const nodeData = triggerNode?.data || {};
                const nodeTriggerType = (nodeData.type || "").toLowerCase();

                // 🎯 Match Logic (Flexible matching for UI labels)
                const typeMatches =
                    triggerType === type.toLowerCase() ||
                    triggerType.includes(type.toLowerCase()) ||
                    nodeTriggerType === type.toLowerCase() ||
                    nodeTriggerType.includes(type.toLowerCase()) ||
                    // Specific mapping for contact (Match "New Contact", "Auto Welcome", etc)
                    (type === "contact" && (
                        triggerType.includes("contact") ||
                        nodeTriggerType.includes("contact") ||
                        triggerType.includes("welcome") ||
                        nodeTriggerType.includes("welcome") ||
                        triggerType.includes("new") ||
                        nodeTriggerType.includes("new")
                    )) ||
                    // Specific mapping for campaign
                    (type === "campaign" && (
                        triggerType.includes("campaign") ||
                        nodeTriggerType.includes("campaign") ||
                        triggerType === "campaign reply trigger" ||
                        nodeTriggerType === "campaign reply trigger"
                    )) ||
                    // 🛍️ WhatsApp Commerce Triggers
                    (["order_created", "payment_success", "order_status_updated", "cart_abandoned"].includes(type) && (
                        triggerType === type ||
                        triggerType.includes(type) ||
                        nodeTriggerType === type ||
                        nodeTriggerType.includes(type)
                    ));

                if (!typeMatches) return false;

                // 🎯 Platform Event Sub-Matching (Check flow is LINKED to this campaign/event)
                if (type === "campaign" && metadata.campaignId) {
                    const targetCampaignId = nodeData.campaignId || f.campaignId;
                    if (targetCampaignId && targetCampaignId.toString() !== metadata.campaignId.toString()) return false;
                }

                if ((type === "woocommerce" || type === "shopify") && metadata.event) {
                    const targetEvent = type === "woocommerce" ? nodeData.wooEvent : nodeData.shopifyEvent;
                    console.log(`[Flow Engine] Event Match Checklist: Current [${metadata.event}] vs Target [${targetEvent}]`);

                    // If the flow specifies an event, they MUST match.
                    if (targetEvent && targetEvent !== metadata.event) {
                        return false;
                    }
                }

                return true;
            });

            if (flow) {
                console.log(`🚀 [Flow Engine] Launching: "${flow.name}" via ${type}`);
                return await this.startFlow(flow, phone, userId, null, metadata);
            }
        } catch (error) {
            console.error(`❌ [Flow Engine] triggerFlowByType Error:`, error);
        }
    }

    /**
     * Start a new Flow Session
     */
    async startFlow(flow, phone, userId, initialInput, metadata = {}) {
        try {
            if (!flow || !flow.nodes) {
                console.error("[Flow Engine] Cannot start flow: Invalid or empty flow structure.");
                return;
            }

            const isMetaPlatform = metadata?.platform === "instagram" || metadata?.platform === "facebook";
            const cleanPhone = isMetaPlatform ? phone.toString() : phone.toString().replace(/\D/g, '');

            const triggerNode = flow.nodes.find(n => n.data?.type === 'trigger');
            if (!triggerNode) return console.error(`❌ [Flow Engine] Trigger Node missing in flow: ${flow._id}`);

            if (!userId) {
                throw new Error(`[Flow Engine] Cannot start flow ${flow._id}: userId is missing`);
            }

            // Clear old sessions
            await FlowSession.updateMany(
                { contactPhone: cleanPhone, userId, status: { $in: ["active", "waiting", "running"] } },
                { $set: { status: "completed" } }
            );

            console.log(`📝 [Flow Engine] Creating session for ${cleanPhone} (User: ${userId}) | Flow: ${flow.name}`);
            const session = await FlowSession.create({
                userId,
                flowId: flow._id,
                contactPhone: cleanPhone,
                currentNodeId: triggerNode.id,
                status: "running",
                variables: { ...metadata, initial_input: initialInput },
                triggerData: metadata.shopifyData || metadata.wooData || metadata || {}
            });
            console.log(`📝 [Flow Engine] Session created: ${session._id}. Executing first node...`);

            // 🔥 UPDATE CONTACT FLOW STATUS
            const Contact = require("../../models/Contact");
            await Contact.findByIdAndUpdate(metadata.contactId || session.contactId, {
                flowStatus: "active",
                updatedAt: new Date()
            });

            // 🧹 STORAGE LIMIT: Keep only last 50 sessions per flow
            try {
                const sessionCount = await FlowSession.countDocuments({ flowId: flow._id, userId });
                if (sessionCount > 50) {
                    const sessionsToDelete = await FlowSession.find({ flowId: flow._id, userId })
                        .sort({ updatedAt: 1 })
                        .limit(sessionCount - 50);
                    if (sessionsToDelete.length > 0) {
                        await FlowSession.deleteMany({ _id: { $in: sessionsToDelete.map(s => s._id) } });
                    }
                }
            } catch (cleanupErr) {
                console.error("⚠️ [Flow Engine] Session cleanup failed:", cleanupErr.message);
            }

            // Find first real interactive node
            const firstNode = this.resolveNextNode(flow, triggerNode.id, null);
            if (firstNode) {
                session.currentNodeId = firstNode.id;
                await session.save();
                return await this.executeFlow(session, flow);
            } else {
                session.status = "completed";
                await session.save();

                // 🔥 UPDATE CONTACT FLOW STATUS
                const Contact = require("../../models/Contact");
                await Contact.findByIdAndUpdate(session.contactId || contactId, {
                    flowStatus: "completed",
                    updatedAt: new Date()
                });
            }
        } catch (error) {
            console.error(`❌ [Flow Engine] startFlow Error:`, error);
        }
    }

    /**
     * ⚙️ THE DETERMINISTIC LOOP
     * Processes nodes sequentially until it hits a "Wait" condition.
     */
    async executeFlow(session, flow) {
        try {
            if (!flow || !flow.nodes) {
                console.error("[Flow Engine] Invalid flow structure during execution");
                session.status = "failed";
                await session.save();

                // 🔥 UPDATE CONTACT FLOW STATUS
                const Contact = require("../../models/Contact");
                await Contact.findByIdAndUpdate(session.contactId, {
                    flowStatus: "none",
                    updatedAt: new Date()
                });
                return;
            }
            let currentNode = flow.nodes.find(n => n.id === session.currentNodeId);

            while (currentNode) {
                const nodeType = (currentNode.data?.type || currentNode.type || "").toLowerCase();

                // Add debug log for first node
                if (currentNode.id === session.currentNodeId && session.status === "running") {
                    console.log(`[FLOW DEBUG] First node executing`);
                }

                console.log(`⚡ [Flow Engine] Executing Node [${nodeType.toUpperCase()}]: ${currentNode.id}`);

                // 🛡️ Resolve Contact Name for variables
                const Contact = require("../../models/Contact");
                const contact = await Contact.findById(session.contactId).lean();

                const context = {
                    phone: String(session.contactPhone),
                    name: contact?.name || "Customer",
                    userId: session.userId,
                    contactId: session.contactId,
                    input: session.lastInput,
                    variables: session.variables || {},
                    triggerData: session.triggerData || {},
                    platform: flow.platform || "whatsapp"
                };

                let stopAndWait = false;

                // --- LOGIC DISPATCHER ---
                if (nodeType === "delay" || nodeType === "wait") {
                    const amount = parseInt(currentNode.data.delay) || 5;
                    const unit = (currentNode.data.delayUnit || "seconds").toLowerCase();
                    const ms = unit === "minutes" ? amount * 60000 : unit === "hours" ? amount * 3600000 : amount * 1000;

                    session.status = "paused_for_delay";
                    await session.save();
                    await new Promise(r => setTimeout(r, ms));
                }
                else if (nodeType === "intervention" || nodeType === "human") {
                    await nodeHandlers.handleHumanAgentNode(currentNode, context, session.userId, session);

                    // 🔥 UPDATE CONTACT FLOW STATUS
                    const Contact = require("../../models/Contact");
                    await Contact.findByIdAndUpdate(session.contactId, {
                        flowStatus: "none", // Human took over
                        updatedAt: new Date()
                    });
                    return; // PAUSE PERMANENTLY
                }
                else if (nodeType === "text" || nodeType === "message" || nodeType === "media") {
                    const buttons = currentNode.data?.buttons || [];
                    if (nodeType === "media") {
                        await nodeHandlers.handleMediaNode(currentNode, context, session.userId);
                    } else {
                        await nodeHandlers.handleSendMessageNode(currentNode, context, session.userId);
                    }
                    stopAndWait = buttons.length > 0;
                }
                else if (nodeType === "template") {
                    await nodeHandlers.handleSendTemplateNode(currentNode, context, session.userId);
                    stopAndWait = currentNode.data?.waitForReply !== false;
                }
                else if (nodeType === "system_template") {
                    const result = await nodeHandlers.handleSendSystemTemplateNode(currentNode, context, session.userId);
                    if (result && result.success === false) {
                        console.error(`❌ [Flow Engine] System Template Handler Failed: ${result.error}`);
                        stopAndWait = false;
                    } else {
                        const buttons = currentNode.data?.buttons || [];
                        stopAndWait = buttons.length > 0;
                    }
                }
                else if (nodeType === "user_input" || nodeType === "wait_for_input") {
                    console.log(`📥 [Flow Engine] User Input Node detected. pausing...`);

                    // 📤 SEND PROMPT: If the node has a message/text defined, send it before waiting
                    if (currentNode.data?.text || currentNode.data?.message) {
                        await nodeHandlers.handleSendMessageNode(currentNode, context, session.userId);
                    }

                    // Save the variable name for the handler to know where to store future input
                    const varName = currentNode.data?.variableName || currentNode.data?.variable || "user_reply";
                    session.variables = { ...session.variables, last_requested_var: varName };
                    await session.save();
                    stopAndWait = true;
                }
                else if (nodeType === "interactive_list") {
                    await nodeHandlers.handleInteractiveListNode(currentNode, context, session.userId);
                    stopAndWait = true;
                }
                else if (nodeType === "action" || nodeType === "logic") {
                    const result = await nodeHandlers.handleActionNode(currentNode, context, session.userId);
                    session.lastActionResult = result; // Store for path resolution
                    stopAndWait = false;
                }
                else if (nodeType === "payment") {
                    await nodeHandlers.handlePaymentNode(currentNode, context, session.userId);
                    stopAndWait = true; // Wait for user to acknowledge or system to confirm
                }
                else if (nodeType === "whatsapp_flow") {
                    await nodeHandlers.handleWhatsAppFlowNode(currentNode, context, session.userId);
                    stopAndWait = true; // Wait for user to submit the flow
                }

                // 🧠 SMART INTENT: If this is a TEXT/SUCCESS node but we just came from a "Confirm" button (btn-0)
                // and we have appointment variables, but haven't run the action yet... run it now!
                if (session.lastInput === "btn-0" && session.variables?.appointment_date && !session.variables?.appointment_booked) {
                    console.log("🧠 [Flow Engine] Smart Intent: Auto-triggering 'book_appointment' for Confirm button");
                    const actionResult = await nodeHandlers.handleActionNode({ data: { action: 'book_appointment' } }, context, session.userId);
                    if (actionResult?.success) {
                        session.variables = { ...session.variables, appointment_booked: true, appointment_id: actionResult.appointmentId };
                    }
                }

                // --- STEP HANDOFF ---
                if (stopAndWait) {
                    console.log(`⏸️ [Flow Engine] Paused. Waiting for input at Node: ${currentNode.id}`);
                    session.status = "waiting";
                    session.waitingForInput = true;
                    session.currentNodeId = currentNode.id; // Correct as per user request
                    return await session.save();
                }

                // Resolve NEXT automatically (if no user interaction needed)
                const nextNode = this.resolveNextNode(flow, currentNode.id, null, false, session.lastActionResult);

                // Reset result after use
                session.lastActionResult = null;

                if (!nextNode) {
                    console.log(`✅ [Flow Engine] Flow Terminal reached (Auto-Forward) for Node: ${currentNode.id}`);
                    session.status = "completed";
                    await session.save();

                    // 🔥 UPDATE CONTACT FLOW STATUS
                    const Contact = require("../../models/Contact");
                    await Contact.findByIdAndUpdate(session.contactId, {
                        flowStatus: "completed",
                        updatedAt: new Date()
                    });
                    return;
                }

                session.currentNodeId = nextNode.id;
                await session.save();
                currentNode = nextNode;
            }
        } catch (error) {
            console.error(`❌ [Flow Engine] Critical Loop Failure:`, error);
            session.status = "failed";
            await session.save();

            // 🔥 UPDATE CONTACT FLOW STATUS
            const Contact = require("../../models/Contact");
            await Contact.findByIdAndUpdate(session.contactId, {
                flowStatus: "none",
                updatedAt: new Date()
            });
        }
    }

    /**
     * Path Resolution Logic (Fuzzy + Precise)
     */
    resolveNextNode(flow, currentNodeId, input, isInteractive = false, actionResult = null) {
        if (!flow || !flow.nodes) return null;
        const edges = flow.connections || flow.edges || [];
        const outgoing = edges.filter(e => e.source === currentNodeId);
        if (outgoing.length === 0) return null;

        let edge = null;
        if (input) {
            const clean = input.toString().toLowerCase().trim();
            const currentNode = flow.nodes.find(n => n.id === currentNodeId);

            // 🎯 Phase 0: Specialized Node Branching (Keyword Branches)
            if (currentNode && (currentNode.data?.type === "user_input" || currentNode.type === "user_input")) {
                const routes = currentNode.data?.keywordRoutes || currentNode.data?.branches || [];
                const routingMode = currentNode.data?.routingMode || 'free';

                console.log(`🌿 [Flow Engine] Evaluating ${routes.length} branches for input: "${clean}" (Mode: ${routingMode})`);

                let branchMatched = false;
                for (let i = 0; i < routes.length; i++) {
                    const route = routes[i];
                    const keywords = (route.keyword || "").split(",").map(k => k.toLowerCase().trim()).filter(Boolean);
                    if (keywords.includes(clean)) {
                        console.log(`✅ [Flow Engine] Matched keyword branch: ${route.keyword}`);
                        const handleId = `kw-${i}`;
                        edge = outgoing.find(e => e.sourceHandle === handleId || e.sourceHandle === route.id);
                        if (edge) {
                            branchMatched = true;
                            break;
                        }
                    }
                }

                // If in KEYWORD mode and no branch matched, we should NOT proceed (or loop back)
                if (routingMode === 'keyword' && !branchMatched) {
                    console.log(`🚫 [Flow Engine] Strict Keyword mode: Input "${clean}" doesn't match any branch. Waiting for retry.`);
                    return null; // This will keep the session in "waiting" status
                }
            }

            // 🎯 Phase 0.5: Interactive List Routing (Precise Row ID Match)
            if (currentNode && (currentNode.data?.type === "interactive_list" || currentNode.type === "interactive_list")) {
                console.log(`📋 [Flow Engine] List Routing for input: "${clean}"`);
                edge = outgoing.find(e => {
                    const handle = (e.sourceHandle || "").toLowerCase();
                    return handle === clean;
                });
                if (edge) return flow.nodes.find(n => n.id === edge.target);
            }

            // 🎯 Phase 1: Precise Button Handle Match (Highest Priority)
            if (isInteractive) {
                let buttonHandle = clean;
                if (!clean.startsWith('btn-') && !isNaN(clean)) {
                    buttonHandle = `btn-${clean}`;
                }

                edge = outgoing.find(e => {
                    const handle = (e.sourceHandle || "").toLowerCase();
                    return handle === buttonHandle || handle === clean;
                });
            }

            // 🎯 Phase 2: Direct Label/Text Match (Fuzzy)
            if (!edge) {
                edge = outgoing.find(e => {
                    const label = (e.label || "").toLowerCase().trim();
                    // If e.label matches the user's reply text exactly
                    return label && (clean === label || clean.includes(label));
                });
            }
        }

        // 🎯 Final Default Path / Safety Fallback
        if (!edge) {
            // If we have an action result, try matching its success/failure handles
            if (actionResult) {
                const handleId = actionResult.success ? "success" : "failure";
                edge = outgoing.find(e => e.sourceHandle === handleId);
            }

            // Priority 1: Edges with NO sourceHandle (default exit)
            // Priority 2: "default" handle
            // Priority 3: First available edge (Last resort)
            if (!edge) {
                edge = outgoing.find(e => !e.sourceHandle || e.sourceHandle === "default" || e.sourceHandle === "") || outgoing[0];
            }
            console.log(`🔄 [Flow Engine] Using fallback edge: ${edge?.id || 'NONE'} (Handle: ${edge?.sourceHandle || 'Default'})`);
        }

        if (!edge) return null;

        const targetId = edge.target;
        return flow.nodes.find(n => n.id === targetId);
    }

    /**
     * External API for triggering flows
     */
    async triggerFlow({ trigger, phone, data, userId }) {
        if (!userId) return { success: false, error: "userId required" };
        console.log(`[Flow] External Trigger: ${trigger} -> ${phone}`);
        const cleanPhone = phone.toString().replace(/\D/g, '');
        return await this.triggerFlowByType(userId, cleanPhone, trigger, data);
    }

    /**
     * Intercept and Execute Commerce Actions (Pay Now, Track, etc.)
     */
    async executeCommerceAction(actionId, context, userId) {
        console.log(`[Commerce] ⚡ Redirecting Action: ${actionId}`);
        const nodeHandlers = require("./node.handlers");

        // Wrap actionId into a mock node object for handleActionNode
        const mockNode = {
            data: { actionType: actionId }
        };

        return await nodeHandlers.handleActionNode(mockNode, context, userId);
    }
}

module.exports = new FlowEngine();
