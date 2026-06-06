const HelpChat = require('../models/HelpChat');

const knowledgeBase = [
  {
    keywords: ["hi", "hello", "hey", "greeting"],
    question: "Greeting",
    answer: "👋 **Hi there! I am your Zepofy AI Assistant.**\n\nI can help you with setup, campaigns, automations, and more. What would you like to build today? 🚀\n\n*Try asking: 'How to create a campaign?' or 'How to connect WhatsApp?'*"
  },
  {
    keywords: ["connect whatsapp", "setup whatsapp", "waba", "credentials", "api key", "access token"],
    question: "How to connect WhatsApp API?",
    answer: "🛡️ **WhatsApp API Connection Guide:**\n\n1. **Go to Settings**: Navigate to `Settings` → `Integrations` → `WhatsApp`.\n2. **Enter Credentials**: Copy your `Access Token`, `Phone Number ID`, and `WABA ID` from your Meta Developer Portal.\n3. **Configure Webhook**: Copy our Webhook URL and paste it into Meta's configuration.\n4. **Verify**: Click the 'Verify Connection' button.\n\n💡 **Tip**: Ensure your phone number is NOT associated with a personal WhatsApp App before connecting."
  },
  {
    keywords: ["import contacts", "upload contacts", "csv import", "contact list"],
    question: "How to import contacts?",
    answer: "👥 **Contact Management:**\n\n1. **Navigate to Contacts**: Open the `Contacts` menu.\n2. **Click Import**: Look for the 'Import CSV' button in the top-right.\n3. **Format Support**: Upload a `.csv` file. Required columns: `phone` (with country code) and `name`.\n4. **Add Tags**: You can optionally assign tags during import to organize your audience.\n\n*Need a sample? Download our [Contact Template] from the import page.*"
  },
  {
    keywords: ["create campaign", "send campaign", "run campaign", "broadcast", "marketing message"],
    question: "How to run a campaign?",
    answer: "To run a campaign in **Zepofy**, first ensure your WhatsApp template is created and approved. **1**\n\n**Then:**\n\n* Go to **Campaigns** → **New Campaign** → choose your audience (Group or Individual). **2**\n* Add a campaign name, pick the **approved template**, and set the campaign live (save and activate or send now). **3**\n\n**If you're running a broadcast:**\n\n* Go to **Campaigns** → **Broadcast**\n* Choose a pre-approved template, pick your audience, then send now or schedule it. **4**"
  },
  {
    keywords: ["template creation", "create template", "whatsapp template", "hsm", "submit template"],
    question: "How to create templates?",
    answer: "Creating a template in **Zepofy** is simple. **1**\n\n**Process:**\n\n* Go to **Templates** → **Create New Template**. **2**\n* Pick your **Template Category** (Marketing, Utility, etc.) and add your body text & buttons. **3**\n* Click **Submit for Approval**. Meta usually reviews messages in under 24 hours. **4**\n\nOnce it shows as **Approved**, you can use it in your campaigns or automation flows."
  },
  {
    keywords: ["woocommerce", "wordpress", "woo", "plugin"],
    question: "How to setup WooCommerce?",
    answer: "🛒 **WooCommerce Integration:**\n\n1. Go to `Settings` → `Integrations` → `WooCommerce`.\n2. **Connect Store**: Enter your store URL and API Keys (Consumer Key/Secret).\n3. **Event Setup**: Enable triggers for 'New Order', 'Abandoned Cart', and 'Status Updates'.\n4. **Automate**: Link these events to your Automation Flows to send instant WhatsApp notifications."
  },
  {
    keywords: ["automation", "flow", "workflow", "builder"],
    question: "How to setup automation flows?",
    answer: "🤖 **Automation Flow Setup:**\n\n1. **Menu**: Go to `Automation` → `Flow Builder`.\n2. **Trigger**: Drag a `Trigger` node (e.g., Order Received or Keyword).\n3. **Actions**: Connect `Message` or `Wait` nodes to design the sequence.\n4. **Conditions**: Use `Condition` nodes to branch the path based on user replies.\n5. **Activate**: Click 'Save' and toggle the status to 'Active'.\n\n*Perfect for: Auto-replies, abandoned cart recovery, and welcome sequences!*"
  },
  {
    keywords: ["shopify", "shopify app", "store setup"],
    question: "How to integrate Shopify?",
    answer: "🏷️ **Shopify Connection:**\n\n1. Go to `Settings` → `Integrations` → `Shopify`.\n2. **Auth**: Enter your `.myshopify.com` store domain.\n3. **Install**: Follow the prompts to authorize the Zepofy app.\n4. **Sync**: Your orders and customers will begin syncing automatically for abandoned cart recovery."
  }
];

exports.ask = async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.userId;

    if (!message) {
      return res.status(400).json({ success: false, error: "Message is required" });
    }

    const lowerMessage = message.toLowerCase();

    // 1. Search Knowledge Base with Weighted Matching
    let bestMatch = null;
    let maxMatches = 0;

    for (const item of knowledgeBase) {
      let currentMatches = 0;
      // Boost Score if the question itself contains the word
      if (lowerMessage.includes(item.question.toLowerCase())) {
        currentMatches += 3;
      }

      for (const keyword of item.keywords) {
        if (lowerMessage.includes(keyword)) {
          currentMatches++;
        }
      }

      if (currentMatches > maxMatches) {
        maxMatches = currentMatches;
        bestMatch = item;
      }
    }

    // Default response personality
    let answer = "🤔 **I'm not exactly sure about that.**\n\nCould you try rephrasing? You can also contact our support team at `support@zepofy.com` for direct assistance from a human! 👋";
    let source = 'default';

    if (bestMatch && maxMatches > 0) {
      answer = bestMatch.answer;
      source = 'knowledge_base';
    } else {
      // 🚀 FALLBACK TO GEMINI (using aiService)
      try {
        const aiService = require("../services/ai.service");
        // We pass "Website" as phone placeholder for dashboard AI
        const geminiResponse = await aiService.generateResponse(userId, "System", message);
        
        if (geminiResponse) {
          answer = geminiResponse;
          source = 'gemini';
        }
      } catch (aiErr) {
        console.error("AI Fallback Error:", aiErr);
      }
    }

    // 2. Save Conversation to DB
    const chatEntry = await HelpChat.create({
      userId,
      message,
      response: answer,
      source
    });

    return res.json({
      success: true,
      chatId: chatEntry._id,
      answer,
      source
    });

  } catch (error) {
    console.error("AI Chat Error:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const history = await HelpChat.find({ userId: req.userId })
      .sort({ createdAt: 1 })
      .limit(50);

    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.rateResponse = async (req, res) => {
  try {
    const { chatId, rating } = req.body;
    await HelpChat.findByIdAndUpdate(chatId, { rating });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

