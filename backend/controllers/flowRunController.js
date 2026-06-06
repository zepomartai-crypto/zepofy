const Flow = require("../modules/flowBuilder/flow.model");
const FlowSession = require("../models/FlowSession");
const Contact = require("../models/Contact");
const flowEngine = require("../modules/flowBuilder/flow.engine");

/* ================= START FLOW ================= */
exports.startFlow = async (req, res) => {
  try {
    const flowId = req.params.id || req.params.flowId || req.body.flowId;
    const { contactId } = req.body;
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized: User ID missing" });
    }

    console.log("[Flow Run] Manual Start Request:", { flowId, contactId, userId });

    const flow = await Flow.findOne({ _id: flowId, userId });
    if (!flow) {
      return res.status(404).json({ success: false, error: "Flow not found" });
    }

    if (!flow.nodes || !flow.nodes.length) {
      return res.status(400).json({ success: false, error: "Flow has no nodes" });
    }

    // Find contact
    let actualContactId = contactId;
    if (contactId === 'test_contact_id' || !contactId) {
      // Try to find the most recent contact instead of the first one
      const recentContact = await Contact.findOne({ userId }).sort({ createdAt: -1 });
      actualContactId = recentContact ? recentContact._id : null;
      console.log(`[Flow Run] Test mode detected. Using most recent contact: ${recentContact?.phone || 'none'}`);
    }

    const contact = await Contact.findById(actualContactId);
    if (!contact) {
      return res.status(404).json({ success: false, error: "Contact not found for testing. Please add a contact first." });
    }

    const phone = contact.phone || contact.whatsappNumber;
    if (!phone) {
      return res.status(400).json({ success: false, error: "Contact has no phone number" });
    }

    // Find trigger node (Entry Point)
    const startNode = flow.nodes.find(n => n.type === 'trigger' || n.data?.type === 'trigger') || flow.nodes[0];

    // Create initial trigger data if manual
    const triggerData = {
      manual: true,
      phone: phone,
      customer: {
        first_name: contact.name?.split(' ')[0] || "Customer",
        last_name: contact.name?.split(' ').slice(1).join(' ') || "",
        phone: phone
      }
    };

    // Create session
    const session = await FlowSession.create({
      userId,
      contactId: contact._id,
      contactPhone: phone.replace(/\D/g, ''),
      flowId: flow._id,
      currentNodeId: startNode.id,
      status: "running",
      triggerData
    });

    console.log(`[Flow Run] Session created: ${session._id}. Executing Flow Engine...`);

    // Execute via engine (pass components explicitly to avoid missing args)
    flowEngine.startFlow(flow, phone, userId, null, triggerData).catch(err => {
      console.error("[Flow Run] Engine execution error:", err);
    });

    res.json({
      success: true,
      message: "Flow started successfully",
      sessionId: session._id,
      flowName: flow.name
    });
  } catch (err) {
    console.error("FLOW START ERROR:", err);
    res.status(500).json({
      success: false,
      error: "Failed to start flow",
      details: err.message
    });
  }
};

/* ================= HANDLE REPLY ================= */
// Note: This is usually handled by the webhook calling flowEngine.handleFlowReply directly.
// This endpoint might be used for manual tests or custom UI triggers.
exports.handleReply = async (req, res) => {
  try {
    const { sessionId, messageText, payload } = req.body;
    const session = await FlowSession.findById(sessionId);

    if (!session) return res.status(404).json({ error: "Session not found" });

    // Forward to unified engine
    await flowEngine.handleFlowReply(session.contactPhone, messageText, payload);

    res.json({ success: true });
  } catch (err) {
    console.error("REPLY ERROR:", err);
    res.status(500).json({ error: "Reply failed" });
  }
};
