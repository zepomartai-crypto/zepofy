require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require("cors");
const http = require('http');
const socketIo = require('socket.io');

const apiRoutes = require("./routes/api");
const authRoutes = require("./routes/auth");
const authMiddleware = require("./middleware/auth.middleware");
const dashboardRoutes = require("./routes/dashboard");
const contactRoutes = require("./routes/contacts");
const wabaRoutes = require("./routes/waba");
const inboxRoutes = require("./routes/inbox");
const uploadRoutes = require("./routes/upload");
const campaignRoutes = require("./routes/campaigns");
const templateRoutes = require("./routes/templates");
const campaignRecipientRoutes = require("./routes/campaignRecipients");
const backblazeRoutes = require("./routes/backblaze");
const campaignNumberRoutes = require("./routes/campaignNumbers");
const flowRunRoutes = require("./routes/flowRun");
const webhookRoutes = require("./routes/webhook.routes");
const integrationsRoutes = require("./routes/integrations.routes");
const groupMessageRoutes = require("./routes/groupMessage.routes");

const app = express();
const server = http.createServer(app);

/* -------------------- CORS -------------------- */
const allowedOrigins = [
  "http://localhost:5173",
  "https://wauto-frontend.vercel.app",
  process.env.FRONTEND_URL
].filter(Boolean);

app.set('trust proxy', 1);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      const allowed = [...allowedOrigins];
      if (allowed.includes(origin) || origin.endsWith(".vercel.app")) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

/* -------------------- Socket.io -------------------- */
const io = socketIo(server, {
  cors: { origin: allowedOrigins, methods: ["GET", "POST"], credentials: true },
  transports: ['websocket', 'polling']
});
app.io = io;
global.io = io;

io.on('connection', (socket) => {
  // console.log('🔌 Socket connected:', socket.id);

  socket.on('user_connect', (userId) => {
    if (userId) {
      socket.join(userId.toString());
      // console.log(`🔌 Socket joined room for user: ${userId}`);
    }
  });

  socket.on('disconnect', () => {
    // console.log('❌ Socket disconnected:', socket.id);
  });
});



/* -------------------- Static & Health -------------------- */
app.use("/uploads", express.static("uploads"));
app.get("/", (req, res) => res.send("WhatsApp Backend Running ✔️"));

/* -------------------- Webhook Routes (RAW BODY REQUIRED) -------------------- */
// Webhooks MUST be placed before express.json() to capture raw body for HMAC verification.

const rawParserStandard = express.raw({
  type: 'application/json',
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
});

app.use("/webhook", rawParserStandard, webhookRoutes);
app.use("/api/webhooks", rawParserStandard, require("./routes/webhooks.routes"));
app.use("/api/webhook/whatsapp", rawParserStandard, require("./routes/flows/index"));
app.use("/api/webhook/whatsapp", rawParserStandard, webhookRoutes);

// ======================================================
// META WEBHOOK RAW BODY PARSER
// MUST BE BEFORE express.json()
// ======================================================

app.use(
  "/api/webhook/meta",
  express.raw({
    type: "application/json",
    limit: "10mb",
  })
);
app.use("/api/webhook/meta", require("./routes/metaSocialWebhook.routes"));

/* -------------------- Standard Middleware & Parsers -------------------- */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const { sanitizeEmptyStrings } = require("./middleware/sanitize.middleware");
app.use('/api', require("./middleware/maintenance.middleware"));
app.use(sanitizeEmptyStrings);

/* -------------------- Protected API Routes -------------------- */
app.use("/api/auth", authRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/contact-groups", require("./routes/contactGroups"));
app.use("/api/waba", wabaRoutes);
app.use("/api/inbox", inboxRoutes);
// app.use("/api/flows", flowRoutes); // Legacy flow system
app.use("/api/flows", require("./modules/flowBuilder/flow.routes")); // Production Flow Builder
app.use("/api/upload", uploadRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/backblaze", backblazeRoutes);
app.use("/api/campaign-recipients", campaignRecipientRoutes);
app.use("/api/campaign-numbers", campaignNumberRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/flows/run", flowRunRoutes);
app.use("/api/integrations", integrationsRoutes);
app.use("/api/shopify", require("./routes/shopify.routes")); // Added Shopify Routes
app.use("/api/shopify", require("./routes/shopify.routes")); // ✅ Added Shopify Routes
app.use("/api/groups", groupMessageRoutes);
app.use("/api/whatsapp", require("./routes/whatsapp.settings.routes"));
app.use("/api/system-templates", require("./routes/system-templates"));
// app.use("/api/automation", require("./modules/flowBuilder/flow.routes")); // Moved to /api/flows
app.use("/api", require("./routes/smtp.routes"));
app.use("/api/ai-chat", require("./routes/aiChat.routes"));
app.use("/api/ai-integration", require("./routes/aiIntegration.routes"));
app.use("/api/customer-chats", require("./routes/metaSocial.routes")); // ✅ Social Inbox routes
app.use("/api/orders", authMiddleware.verifyToken, require("./controllers/commerce.controller").getOrders);
app.use("/api/appointments", require("./routes/appointments"));
app.use("/api/tags", require("./routes/tags"));
app.use("/api", apiRoutes);
app.use("/api/whatsapp-flows", require("./modules/whatsappFlows/routes/whatsappFlow.routes"));

// Super Admin (Master) Management
const superAdminRoutes = require("./routes/superadmin.routes");
const { requireSuperAdmin } = require("./middleware/roleMiddleware");
app.use("/api/superadmin", requireSuperAdmin, superAdminRoutes);
app.use("/api/master", requireSuperAdmin, require("./routes/master")); // Keep master for compatibility if needed, but primarily use superadmin

// WooCommerce & Abandoned Cart Management
app.use("/api/woocommerce", require("./routes/woocommerce.routes"));
app.use("/api/abandoned-carts", require("./routes/abandonedCartApi.routes"));
app.use("/api/abandoned-cart-templates", require("./routes/abandonedCartTemplate.routes"));
app.use("/api/commerce", require("./routes/commerce.routes"));

/* -------------------- Error Handling -------------------- */
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    error: "API Endpoint not found"
  });
});

app.use(async (err, req, res, next) => {
  console.error("❌ Global Error:", err);

  // Log to SystemLog
  try {
    const SystemLog = require("./models/SystemLog");
    await SystemLog.create({
      type: 'error',
      message: err.message || "Internal Server Error",
      userId: req.user ? req.user._id : null,
      details: {
        stack: err.stack,
        path: req.path,
        method: req.method,
        body: req.body,
        query: req.query
      },
      ip: req.ip
    });
  } catch (logErr) {
    console.error("Failed to write to SystemLog:", logErr);
  }

  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal Server Error"
  });
});

/* -------------------- DB + Server -------------------- */
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("🚀 MongoDB Connected");

    // Ensure required upload folders exist
    const fs = require('fs');
    const path = require('path');

    const uploadFolders = [
      "uploads",
      "uploads/profile",
      "uploads/template",
      "uploads/media"
    ];

    uploadFolders.forEach((folder) => {
      const folderPath = path.join(__dirname, folder);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
        console.log(" Created directory:", folder);
      }
    });

    // Test Backblaze B2 connection
    console.log("\n Testing Cloud Storage Connections...");
    const backblazeB2 = require('./config/backblaze');
    backblazeB2.testConnection().then(success => {
      if (success) {
        console.log(" Backblaze B2 storage ready for use\n");
      } else {
        console.log(" Backblaze B2 storage not available - check credentials\n");
      }
    }).catch(err => {
      console.log(" Backblaze B2 connection error:", err.message, "\n");
    });

    require('./services/campaignScheduler').startCampaignScheduler();
    // require('./schedulers/appointmentReminder.scheduler').startAppointmentReminderScheduler();
    // require('./schedulers/abandonedCart.scheduler').start(); // Triggered on-demand (on page load)
    // require('./schedulers/shopifyScheduler.js').start(); // Shopify Scheduler now runs on-demand (on page load)

    // Create Super Admin if not exists
    const User = require("./models/User");
    const bcrypt = require("bcryptjs");

    const createSuperAdmin = async () => {
      try {
        const exists = await User.findOne({ role: 'superadmin' });
        if (!exists) {
          const hashedPassword = await bcrypt.hash("Super@123", 10);
          await User.create({
            name: "Super Admin",
            email: "superadmin@wauto.com",
            password: hashedPassword,
            role: "superadmin",
            loginMethod: "password",
            phoneVerified: true,
            isActive: true
          });
          console.log("👑 Super Admin created: superadmin@wauto.com / Super@123");
        }
      } catch (err) {
        console.error("Super Admin Init Error:", err);
      }
    };
    createSuperAdmin();

    // Initialize Automated Daily System Backup Scheduler
    const { initBackupScheduler } = require('./schedulers/backup.scheduler');
    initBackupScheduler();

    server.listen(PORT, () => {
      console.log(`✅ Server running on PORT ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err.message);
  });
