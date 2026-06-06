const { GoogleGenerativeAI } = require("@google/generative-ai");
const AIIntegration = require("../models/AIIntegration");
const Appointment = require("../models/Appointment");
const Order = require("../models/Order");

class AIService {
  /**
   * Generate a response using the configured AI provider
   */
  async generateResponse(userId, phone, message) {
    try {
      const integration = await AIIntegration.findByUserIdWithKey(userId);

      if (!integration || !integration.enabled || !integration.apiKey) {
        console.log(`🤖 [AI Service] AI not enabled for user: ${userId}`);
        return null;
      }

      // 🔥 FETCH DYNAMIC CONTEXT (Appointments & Orders)
      let dynamicContext = "";
      try {
        const cleanPhone = phone.replace(/\D/g, "");
        const searchPhone = cleanPhone.slice(-10); // Search by last 10 digits for robustness

        // 👤 Customer Profile
        const Contact = require("../models/Contact");
        const contact = await Contact.findOne({
          userId,
          phone: { $regex: searchPhone + "$" }
        });

        if (contact) {
          dynamicContext += `Customer Name: ${contact.name || "N/A"}\n`;
        }

        // 📅 Latest Appointments
        const appointments = await Appointment.find({
          userId,
          $or: [
            { customerPhone: { $regex: searchPhone + "$" } },
            { phone: { $regex: searchPhone + "$" } }
          ]
        }).sort({ createdAt: -1 }).limit(3);

        if (appointments.length > 0) {
          dynamicContext += "\n--- Customer Appointments ---\n";
          appointments.forEach((appt, i) => {
            dynamicContext += `${i + 1}. Date: ${appt.appointmentDate}, Time: ${appt.appointmentTime}, Status: ${appt.status}, Reason: ${appt.notes || "N/A"}\n`;
          });
        }

        // 🛒 Latest Orders
        const orders = await Order.find({
          userId,
          customerPhone: { $regex: searchPhone + "$" }
        }).sort({ createdAt: -1 }).limit(3);

        if (orders.length > 0) {
          dynamicContext += "\n--- Customer Orders ---\n";
          orders.forEach((order, i) => {
            const items = order.items.map(it => `${it.name} (x${it.quantity})`).join(", ");
            const orderDate = new Date(order.createdAt).toISOString().split('T')[0];
            dynamicContext += `${i + 1}. Order ID: ${order._id.toString().slice(-6)}, Date: ${orderDate}, Status: ${order.status}, Total: ₹${order.totalAmount}, Items: ${items}, Address: ${order.address || "N/A"}\n`;
          });
        }
      } catch (ctxErr) {
        console.error("⚠️ [AI Service] Context Fetch Error:", ctxErr.message);
      }

      if (integration.provider === "gemini") {
        return await this.generateGeminiResponse(integration, message, dynamicContext);
      } else {
        console.warn(`⚠️ [AI Service] Provider ${integration.provider} not implemented yet.`);
        return null;
      }
    } catch (error) {
      console.error("❌ [AI Service] Error:", error.message);
      return null;
    }
  }

  /**
   * Gemini specific response generation
   */
  async generateGeminiResponse(integration, userMessage, dynamicContext = "") {
    try {
      const apiKey = integration.apiKey ? integration.apiKey.trim() : "";
      if (!apiKey) return "AI Configuration is missing API Key.";

      const genAI = new GoogleGenerativeAI(apiKey);

      const modelName = integration.model;
      if (!modelName) return "AI Model is not configured.";
      const isNextGen = modelName.includes("2.0") || modelName.includes("2.5") || modelName.includes("preview");
      const apiVer = isNextGen ? "v1beta" : "v1";

      const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: apiVer });

      const today = new Date().toLocaleString("en-US", {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const prompt = `
SYSTEM PROMPT:
${integration.prompt || "You are a professional business assistant."}

KNOWLEDGE BASE:
${integration.knowledgeBase || "No additional info."}

DYNAMIC CUSTOMER CONTEXT:
Today's Date: ${today}
${dynamicContext || "No previous appointments or orders found for this customer."}

CRITICAL INSTRUCTIONS:
1. You have access to the customer's real-time appointment and order data above.
2. If the user asks about their booking, appointment, or order, use the DYNAMIC CUSTOMER CONTEXT to provide a specific answer.
3. If no context is available, politely ask for their order ID or booking details.
4. ALWAYS respond in the SAME LANGUAGE as the user's message. (e.g., Gujarati if they write in Gujarati).
5. Be concise, professional, and helpful.

User Message: ${userMessage}
Assistant:`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error(`❌ [Gemini Service] Error with model ${integration.model || "default"}:`, error.message);
      return "I'm sorry, I'm having trouble processing your request right now. Please try again later.";
    }
  }

  /**
   * Generate a suggested reply based on conversation history
   */
  async generateReply(integration, history) {
    try {
      const apiKey = integration.apiKey ? integration.apiKey.trim() : "";
      if (!apiKey) return null;

      const genAI = new GoogleGenerativeAI(apiKey);
      const modelName = integration.model;
      if (!modelName) return null;
      const isNextGen = modelName.includes("2.0") || modelName.includes("2.5") || modelName.includes("preview");
      const apiVer = isNextGen ? "v1beta" : "v1";
      const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: apiVer });

      const historyContext = history.map(h => `${h.role === "user" ? "User" : "Assistant"}: ${h.content}`).join("\n");

      const prompt = `
System Prompt: ${integration.prompt}
Knowledge Base: ${integration.knowledgeBase || "No additional context."}

Conversation History:
${historyContext}

CRITICAL INSTRUCTION:
- Based on the history above, suggest ONE professional and helpful reply.
- Respond ONLY with the reply text. Do not add labels like "Assistant:" or "Reply:".
- ALWAYS respond in the SAME LANGUAGE as the user's last message.

Reply:`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error("❌ [AI Service] generateReply error:", error.message);
      return null;
    }
  }

  /**
   * Test the connection to the AI provider
   */
  async testConnection(apiKey, provider = "gemini", modelName = "gemini-1.5-flash") {
    try {
      const trimmedKey = apiKey ? apiKey.trim() : "";
      if (!trimmedKey) return { success: false, error: "API Key is empty" };

      if (provider === "gemini") {
        console.log(`🤖 [AI Test] Verifying Gemini connection with model: ${modelName}...`);
        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(trimmedKey);

        // 🔥 Use dynamic API version based on model
        const isNextGen = modelName.includes("2.0") || modelName.includes("2.5") || modelName.includes("preview");
        const apiVer = isNextGen ? "v1beta" : "v1";

        try {
          const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: apiVer });
          const result = await model.generateContent("Hi");
          const response = await result.response;
          if (response.text()) {
            return { success: true, modelUsed: `${modelName} (${apiVer})` };
          }
        } catch (sdkErr) {
          console.error(`❌ [AI Test] SDK Test failed for ${modelName}:`, sdkErr.message);
          return { success: false, error: sdkErr.message };
        }
      }
      return { success: false, error: "Unsupported provider" };
    } catch (error) {
      console.error("❌ [AI Test] Connection failed:", error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new AIService();
