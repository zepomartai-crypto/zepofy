const AutomationFlow = require("./flow.model"); // Use AutomationFlow model
const mongoose = require("mongoose");

// Helper to check lock
const isLockedByOthers = (flow, currentUserId) => {
    if (!flow.lockedBy || !flow.lockTime) return false;
    // Lock expires after 30 minutes
    const isExpired = (new Date() - new Date(flow.lockTime)) > 30 * 60 * 1000;
    if (isExpired) return false;
    return flow.lockedBy.toString() !== currentUserId.toString();
};

exports.saveFlow = async (req, res) => {
    try {
        const flowId = req.params.id || req.body.id;
        const { name, nodes, edges, connections, cooldownHours } = req.body;
        const userId = req.user._id;

        // Extract triggerType from trigger node data
        const triggerNode = nodes?.find(n => n.data?.type === 'trigger');
        const triggerType = triggerNode?.data?.triggerType || 'manual_start';

        console.log('EXTRACTED TRIGGERTYPE:', triggerType);

        // Transform nodes to have correct type from data and assign button IDs
        const transformedNodes = nodes?.map(node => {
            const data = node.data || {};

            // Auto-assign IDs to buttons for precise routing
            if (data.buttons && Array.isArray(data.buttons)) {
                data.buttons = data.buttons.map((btn, index) => {
                    const id = `btn-${index}`;
                    if (typeof btn === 'string') return { id, text: btn };
                    return { ...btn, id };
                });
            }

            return {
                id: node.id,
                type: data.type || node.type,
                position: node.position,
                data: data
            };
        }) || [];

        // Use edges if provided, otherwise use connections for backward compatibility
        const flowConnections = edges || connections || [];

        console.log('TRANSFORMED NODES COUNT:', transformedNodes.length);
        console.log('FLOW CONNECTIONS COUNT:', flowConnections.length);

        let flow;
        if (flowId && flowId !== 'new') {
            flow = await AutomationFlow.findOne({ _id: flowId, userId });
            if (!flow) return res.status(404).json({ success: false, error: "Flow not found" });

            // ✅ UPDATE: Apply new data to existing flow
            flow.name = name || flow.name;
            flow.nodes = transformedNodes;
            flow.connections = flowConnections;
            flow.triggerType = triggerType;
            
            // Infer platform
            if (triggerType.startsWith('instagram')) {
                flow.platform = 'instagram';
            } else if (triggerType.startsWith('facebook')) {
                flow.platform = 'facebook';
            } else {
                flow.platform = 'whatsapp';
            }

            flow.cooldownHours = cooldownHours || 0;
            flow.status = flow.status || "paused";

            console.log('UPDATING EXISTING FLOW:', {
                id: flow._id,
                newName: flow.name,
                nodeCount: flow.nodes.length
            });
        } else {
            // Infer platform
            let newPlatform = 'whatsapp';
            if (triggerType.startsWith('instagram')) {
                newPlatform = 'instagram';
            } else if (triggerType.startsWith('facebook')) {
                newPlatform = 'facebook';
            }

            // Create
            flow = new AutomationFlow({
                userId,
                name,
                triggerType,
                platform: newPlatform,
                nodes: transformedNodes,
                connections: flowConnections,
                cooldownHours: cooldownHours || 0,
                status: "paused" // Default to paused on creation
            });
        }

        console.log('SAVING FLOW:', {
            name: flow.name,
            triggerType: flow.triggerType,
            nodeCount: flow.nodes.length,
            connectionCount: flow.connections.length
        });

        await flow.save();
        console.log('FLOW SAVED SUCCESSFULLY:', flow._id);

        res.status(flowId && flowId !== 'new' ? 200 : 201).json({ success: true, message: "Flow saved successfully", flow });
    } catch (err) {
        console.error("FLOW SAVE ERROR:", {
            message: err.message,
            stack: err.stack,
            name: err.name,
            errors: err.errors
        });
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.getFlows = async (req, res) => {
    try {
        const flows = await AutomationFlow.find({ userId: req.user._id }).sort({ updatedAt: -1 });

        // Enrich with node count
        const enrichedFlows = flows.map(f => ({
            ...f.toObject(),
            nodeCount: f.nodes?.length || 0,
            connectionCount: f.connections?.length || 0
        }));

        res.json({ success: true, flows: enrichedFlows });
    } catch (err) {
        console.error("Error fetching flows", err);
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.getFlowById = async (req, res) => {
    try {
        const flow = await AutomationFlow.findOne({ _id: req.params.id, userId: req.user._id });
        if (!flow) return res.status(404).json({ success: false, error: "Flow not found" });

        res.json({ success: true, flow });
    } catch (err) {
        console.error("Error fetching flow", err);
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.deleteFlow = async (req, res) => {
    try {
        const flow = await AutomationFlow.findOne({ _id: req.params.id, userId: req.user._id });
        if (!flow) return res.status(404).json({ success: false, error: "Flow not found" });

        await AutomationFlow.findByIdAndDelete(req.params.id);

        res.json({ success: true, message: "Flow deleted successfully" });
    } catch (err) {
        console.error("Error deleting flow", err);
        res.status(500).json({ success: false, error: "Server error" });
    }
};

exports.unlockFlow = async (req, res) => {
    try {
        const flow = await AutomationFlow.findOne({ _id: req.params.id, userId: req.user._id });
        if (!flow) return res.status(404).json({ success: false, error: "Flow not found" });

        flow.lockedBy = null;
        flow.lockTime = null;
        await flow.save();

        res.json({ success: true, message: "Flow unlocked" });
    } catch (err) {
        res.status(500).json({ success: false, error: "Server error" });
    }
};

/**
 * 📜 EXECUTION HISTORY LOGS
 * Fetches recent sessions for a specific flow to show performance and stuck users.
 */
exports.getFlowSessions = async (req, res) => {
    try {
        const FlowSession = require("../../models/FlowSession");
        const Contact = require("../../models/Contact");
        const userId = req.user._id;
        const flowId = req.params.id;

        const sessions = await FlowSession.find({ flowId, userId })
            .sort({ updatedAt: -1 })
            .limit(50)
            .lean();

        // Enrich with contact names if available
        const enrichedSessions = await Promise.all(sessions.map(async (sess) => {
            if (sess.contactId) {
                const contact = await Contact.findById(sess.contactId).select("name").lean();
                sess.contactName = contact?.name || "Unknown";
            } else {
                sess.contactName = "New Customer";
            }
            return sess;
        }));

        res.json({ success: true, sessions: enrichedSessions });
    } catch (err) {
        console.error("Error fetching flow sessions:", err);
        res.status(500).json({ success: false, error: "Logs retrieval failed" });
    }
};

exports.updateFlowStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!["draft", "active", "paused"].includes(status)) {
            return res.status(400).json({ success: false, error: "Invalid status" });
        }

        const flow = await AutomationFlow.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { status },
            { new: true }
        );

        if (!flow) return res.status(404).json({ success: false, error: "Flow not found" });

        // ✅ If activating, check for keyword collisions
        if (status === "active") {
            const keywords = [];

            // Extract all keywords from the flow to be activated
            if (flow.keywords) keywords.push(...flow.keywords);
            flow.nodes?.forEach(node => {
                if (node.data?.keywords) keywords.push(...node.data.keywords);
                if (node.data?.keywordRoutes) {
                    const branchKeywords = node.data.keywordRoutes
                        .map(r => r.keyword)
                        .filter(Boolean)
                        .flatMap(k => k.split(",").map(s => s.trim()));
                    keywords.push(...branchKeywords);
                }
            });

            if (keywords.length > 0) {
                const normalizedKeywords = keywords.map(k => k.trim().toLowerCase()).filter(Boolean);

                // Check against OTHER active flows
                const otherActiveFlows = await AutomationFlow.find({
                    userId: req.user._id,
                    status: "active",
                    _id: { $ne: flow._id }
                });

                for (const otherFlow of otherActiveFlows) {
                    let otherKeywords = [];
                    if (otherFlow.keywords) otherKeywords.push(...otherFlow.keywords);
                    otherFlow.nodes?.forEach(n => {
                        if (n.data?.keywords) otherKeywords.push(...n.data.keywords);
                        if (n.data?.keywordRoutes) {
                            const bk = n.data.keywordRoutes.map(r => r.keyword).filter(Boolean).flatMap(k => k.split(",").map(s => s.trim()));
                            otherKeywords.push(...bk);
                        }
                    });

                    const matches = normalizedKeywords.filter(k =>
                        otherKeywords.map(ok => ok.toLowerCase().trim()).includes(k)
                    );

                    if (matches.length > 0) {
                        // REVERT STATUS if conflict found
                        flow.status = "paused";
                        await flow.save();
                        return res.status(400).json({
                            success: false,
                            error: `Keyword Collision: The keywords [${matches.join(", ")}] are already active in flow "${otherFlow.name}". Please pause it first.`
                        });
                    }
                }
            }
        }

        res.json({ success: true, flow });
    } catch (err) {
        console.error("Error updating flow status", err);
        res.status(500).json({ success: false, error: "Server error" });
    }
};

exports.getTriggers = async (req, res) => {
    try {
        const WooCommerceIntegration = require('../../models/WooCommerceIntegration');
        const ShopifyIntegration = require('../../models/ShopifyIntegration');
        const WhatsAppIntegration = require('../../models/WhatsAppIntegration');

        const userId = req.user._id;

        const [woo, shopify, whatsapp] = await Promise.all([
            WooCommerceIntegration.findOne({ userId }),
            ShopifyIntegration.findOne({ userId }),
            WhatsAppIntegration.findOne({ userId })
        ]);

        const wooConnected = woo?.status === 'connected';
        const shopifyConnected = shopify?.status === 'connected';
        const catalogConnected = whatsapp?.catalogConnected || false;

        const triggers = [
            { label: "Keyword Matching (Inbound)", value: "keyword" },
            { label: "Campaign Reply Trigger", value: "campaign" },
            { label: "New Contact Added (Auto)", value: "contact" }
        ];

        // 🛍️ Shopify Triggers
        if (shopifyConnected) {
            triggers.push({ label: "Shopify Order Created", value: "shopify" });
        }

        // 🛒 WooCommerce Triggers
        if (wooConnected) {
            triggers.push({ label: "WooCommerce Order Created", value: "woocommerce" });
        }

        // 🛒 WhatsApp Commerce Automation (Native Catalog)
        triggers.push({ label: "WhatsApp Order Created", value: "order_created" });
        triggers.push({ label: "WhatsApp Payment Received", value: "payment_success" });
        triggers.push({ label: "WhatsApp Order Status Updated", value: "order_status_updated" });
        triggers.push({ label: "WhatsApp Cart Abandoned", value: "cart_abandoned" });

        res.json({ success: true, triggers });
    } catch (err) {
        console.error("❌ [getTriggers] Error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
};

/**
 * 🔍 KEYWORD COLLISION PROTECTOR
 * Checks if keywords are already in use by other ACTIVE flows.
 */
exports.validateKeywords = async (req, res) => {
    try {
        const { keywords, excludeFlowId } = req.body;
        const userId = req.user._id;

        if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
            return res.json({ success: true, conflicts: [] });
        }

        const normalizedKeywords = keywords.map(k => k.trim().toLowerCase()).filter(Boolean);

        // Find other ACTIVE flows for this user
        const activeFlows = await AutomationFlow.find({
            userId,
            status: "active",
            _id: { $ne: excludeFlowId }
        });

        const conflicts = [];

        activeFlows.forEach(flow => {
            let flowKeywords = [];

            // 1. Check top-level keywords
            if (flow.keywords && Array.isArray(flow.keywords)) {
                flowKeywords = [...flowKeywords, ...flow.keywords];
            }

            // 2. Scan nodes for keyword data
            flow.nodes?.forEach(node => {
                const data = node.data || {};

                // Trigger Node Keywords
                if ((data.type === 'trigger' || node.type === 'trigger') && data.keywords) {
                    flowKeywords = [...flowKeywords, ...data.keywords];
                }

                // User Input Keyword Branches
                if ((data.type === 'user_input' || node.type === 'user_input') && data.keywordRoutes) {
                    const branchKeywords = data.keywordRoutes
                        .map(r => r.keyword)
                        .filter(Boolean)
                        .flatMap(k => k.split(",").map(s => s.trim()));
                    flowKeywords = [...flowKeywords, ...branchKeywords];
                }
            });

            // Normalized comparison
            const matches = normalizedKeywords.filter(k =>
                flowKeywords.map(fk => fk.toLowerCase().trim()).includes(k)
            );

            if (matches.length > 0) {
                conflicts.push({
                    flowId: flow._id,
                    flowName: flow.name,
                    matchedKeywords: matches
                });
            }
        });

        res.json({
            success: true,
            conflicts,
            hasConflict: conflicts.length > 0
        });

    } catch (err) {
        console.error("Keyword validation error:", err);
        res.status(500).json({ success: false, error: "Validation engine failed" });
    }
};
