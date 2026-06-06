const { GoogleGenerativeAI } = require("@google/generative-ai");
const AIIntegration = require("../../models/AIIntegration");

/**
 * AI Handler Module
 * Central dispatcher for specialized AI tasks across the platform
 */
class AIHandler {
  /**
   * AI Helper to extract person's name and full delivery address from text
   */
  async extractOrderDetails(text, apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: "v1" });
      
      const prompt = `Extract the person's name and full delivery address from the following text. 
      Respond ONLY with a JSON object containing "name" and "address" keys. 
      If not found, use null.
      
      Text: "${text}"`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const cleaned = response.text().replace(/```json|```/g, "").trim();
      return JSON.parse(cleaned);
    } catch (error) {
      console.error("❌ [AI Extraction Error]:", error.message);
      return { name: null, address: null };
    }
  }

  /**
   * AI Image Order Helper to analyze handwritten/photo orders using Gemini Vision
   */
  async processImageOrder(base64Image, mimeType, catalogData, apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: "v1" });

      const prompt = `You are an expert AI order processing assistant. 
      Analyze the attached image (handwritten list, photo of items, or screenshot) and match them to our catalog.
      
      CATALOG DATA: ${JSON.stringify(catalogData)}
      
      TASK:
      1. Match items in the image to CATALOG data. Use the exact "productId" from catalog.
      2. Respond ONLY with a JSON object containing:
         - "items": Array of { "productId": "ID", "name": "Name", "quantity": Number }
         - "customerName": String or null
         - "address": String or null
         - "summary": A brief one-line summary of the order.
      3. If an item is not in the catalog, ignore it.`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Image,
            mimeType
          }
        }
      ]);
      const response = await result.response;
      const cleaned = response.text().replace(/```json|```/g, "").trim();
      return JSON.parse(cleaned);
    } catch (error) {
      console.error("❌ [AI Vision Error]:", error.message);
      return null;
    }
  }

  /**
   * AI Copywriter for Marketing Campaigns
   */
  async generateCampaignCopy(topic, details, apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: "v1" });
      
      const prompt = `You are a professional WhatsApp Marketing Copywriter. 
      Create a high-converting message for: ${topic}. 
      Key Details: ${details}.
      
      REQUIREMENTS:
      - Use emojis to make it engaging.
      - Use line breaks for readability.
      - Include a clear Call to Action (CTA).
      - Make it sound professional yet personal.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("❌ [AI Campaign Error]:", error.message);
      return "Unable to generate campaign content at this moment.";
    }
  }

  /**
   * AI Smart Reply Suggestion for Support Agents
   */
  async suggestSmartReply(customerMessage, history, knowledgeBase, apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: "v1" });
      
      const prompt = `You are a helpful customer support assistant. 
      Knowledge Base: ${knowledgeBase || "No specific business info provided."}
      Chat History: ${JSON.stringify(history)}
      
      CRITICAL: Always respond in the SAME LANGUAGE as the customer's message.
      
      Customer Message: "${customerMessage}"
      
      TASK: Suggest a professional, helpful, and concise reply.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("❌ [AI Smart Reply Error]:", error.message);
      return null;
    }
  }
}

module.exports = new AIHandler();
