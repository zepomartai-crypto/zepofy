const AIIntegration = require("../models/AIIntegration");
const aiService = require("../services/ai.service");

exports.getSettings = async (req, res) => {
  try {
    const userId = req.userId;
    // 🔥 CRITICAL FIX: Explicitly select apiKey because it is hidden (select: false) in the model
    let settings = await AIIntegration.findOne({ userId }).select("+apiKey");
    
    if (!settings) {
      settings = await AIIntegration.create({ 
        userId, 
        apiKey: "", 
        enabled: false,
        status: "not_configured"
      });
    }

    res.json({
      success: true,
      settings: {
        provider: settings.provider,
        enabled: settings.enabled,
        model: settings.model,
        prompt: settings.prompt,
        knowledgeBase: settings.knowledgeBase,
        features: settings.features,
        status: settings.status,
        hasKey: !!settings.apiKey,
        apiKey: settings.apiKey ? settings.decryptToken() : ""
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const userId = req.userId;
    const { provider, apiKey, enabled, model, prompt, knowledgeBase, features } = req.body;

    let settings = await AIIntegration.findOne({ userId });

    const isConnected = !!(apiKey || (settings && settings.apiKey));
    
    const updateData = {
      provider,
      enabled: isConnected ? enabled : false, // Can't be enabled if not connected
      model,
      prompt,
      knowledgeBase,
      features,
      status: (isConnected && enabled) ? "active" : (isConnected ? "paused" : "not_configured")
    };

    if (apiKey && apiKey !== "********") {
      updateData.apiKey = apiKey;
    }

    if (!settings) {
      settings = new AIIntegration({ userId, ...updateData });
    } else {
      Object.assign(settings, updateData);
    }

    await settings.save();

    res.json({ success: true, message: "AI Settings updated successfully", settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.testConnection = async (req, res) => {
  try {
    const { apiKey, provider, model } = req.body;
    
    let testKey = apiKey;
    let testProvider = provider || "gemini";
    let testModel = model;

    if (!testKey || testKey === "********") {
      const integration = await AIIntegration.findByUserIdWithKey(req.userId);
      if (!integration || !integration.apiKey) {
        return res.status(400).json({ success: false, error: "API Key is required" });
      }
      testKey = integration.apiKey;
      testProvider = integration.provider;
      testModel = testModel || integration.model;
    }

    const testResult = await aiService.testConnection(testKey, testProvider, testModel);
    
    if (testResult.success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ 
        success: false, 
        error: testResult.error || "Connection failed. Please check your API key." 
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.analyzeOrder = async (req, res) => {
  try {
    const { orderData } = req.body;
    const userId = req.userId;

    const integration = await AIIntegration.findByUserIdWithKey(userId);
    if (!integration || !integration.enabled || !integration.apiKey) {
      return res.status(400).json({ success: false, error: "AI not enabled or configured" });
    }

    const itemsStr = (orderData.items || []).map(i => `${i.name} (x${i.quantity})`).join(', ');
    const prompt = `
Analyze this order and provide a short, professional business insight (max 2 sentences).
Customer: ${orderData.customer || 'Unknown'}
Total: ${orderData.total}
Items: ${itemsStr}
Status: ${orderData.status}

Focus on:
1. Customer loyalty (is this a good customer?)
2. Upselling (what else could they buy?)
3. Urgency (should we ship it fast?)

Insight:`;

    // Use a clean prompt without the wrapping system prompt for this specific task
    const result = await aiService.generateGeminiResponse(integration, prompt);
    
    res.json({ success: true, insight: result });
  } catch (error) {
    console.error("AI Order Analysis Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.suggestReply = async (req, res) => {
  try {
    const { customerId } = req.body;
    const userId = req.userId;

    if (!customerId) {
      return res.status(400).json({ success: false, error: "Customer ID is required" });
    }

    const AIIntegration = require("../models/AIIntegration");
    const Message = require("../models/Message");
    const Contact = require("../models/Contact");

    // 1. Get AI settings
    const integration = await AIIntegration.findOne({ userId }).select("+apiKey");
    if (!integration || !integration.apiKey || !integration.enabled) {
      return res.status(400).json({ success: false, error: "AI Integration not configured or enabled" });
    }

    // 2. Get contact info
    const contact = await Contact.findById(customerId);
    if (!contact) {
      return res.status(404).json({ success: false, error: "Contact not found" });
    }

    // 3. Get recent messages for context (last 10)
    const recentMessages = await Message.find({ 
      userId, 
      $or: [{ customerId }, { phone: contact.phone }]
    })
    .sort({ createdAt: -1 })
    .limit(10);

    // Format history for AI
    const history = recentMessages.reverse().map(m => ({
      role: m.direction === "incoming" ? "user" : "assistant",
      content: m.body || m.text || (m.type === "template" ? "Template message" : "")
    })).filter(m => m.content);

    if (history.length === 0) {
      return res.status(400).json({ success: false, error: "No message history found" });
    }

    // 4. Call AI Service
    const suggestion = await aiService.generateReply(integration, history);

    res.json({ success: true, suggestion });
  } catch (error) {
    console.error("❌ suggestReply error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
