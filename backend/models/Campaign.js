const mongoose = require("mongoose");

const CampaignSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    name: String,

    phoneNumberId: String, // WhatsApp Business Phone Number ID

    // 🔥 Link to original template
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "Template" },

    template: {
      _id: String, // Store original ID for reference
      name: String,
      metaTemplateName: String,
      language: String,
      category: String,

      // Full content snapshot
      components: [mongoose.Schema.Types.Mixed],

      // Normalized content
      header: mongoose.Schema.Types.Mixed,
      body: String,
      footer: String,
      buttons: [mongoose.Schema.Types.Mixed],

      headerImageId: String, // metaMediaId for image headers

      variables: [String], // Static values
      variableTypes: [{ // Dynamic variable configuration
        index: Number,
        type: { type: String, enum: ["static", "dynamic"] },
        value: String
      }]
    },

    recipientSource: {
      type: String,
      enum: ["group", "contacts", "addNumber", "importCsv"],
      required: true,
    },

    // For group source
    groupIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "ContactGroup" }],

    // For contacts source
    contactIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Contact" }],

    // For addNumber and importCsv, numbers are stored in CampaignNumber collection
    // Count of campaign numbers for quick access
    campaignNumbersCount: { type: Number, default: 0 },

    // Recipients stored as CampaignRecipient references
    campaignRecipients: [{ type: mongoose.Schema.Types.ObjectId, ref: "CampaignRecipient" }],

    // Recipients resolved at send time
    recipients: [
      {
        contactId: { type: mongoose.Schema.Types.ObjectId, ref: "Contact" },
        phone: String,
        name: String, // For campaign numbers
        status: {
          type: String,
          enum: ["pending", "sent", "failed"],
          default: "pending"
        }
      }
    ],

    total: { type: Number, default: 0 }, // Total recipients count
    sentCount: { type: Number, default: 0 },
    deliveredCount: { type: Number, default: 0 },
    readCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },

    scheduledAt: Date, // UTC datetime for scheduling

    // 🔥 REPLIES
    replyCount: { type: Number, default: 0 },
    repliedContacts: [
      {
        contactId: mongoose.Schema.Types.ObjectId,
        phone: String,
        repliedAt: Date
      }
    ],

    status: {
      type: String,
      enum: ["draft", "scheduled", "running", "paused", "completed", "failed"],
      default: "draft"
    },

    sentAt: Date, // When campaign was actually sent
    lastRunAt: Date, // Last time campaign was run (manual or scheduled)
    isReusable: { type: Boolean, default: true }, // Can be run multiple times

    // Timestamps for pause/resume/stop operations
    startedAt: Date,
    pausedAt: Date,
    resumedAt: Date,
    completedAt: Date,
    stoppedAt: Date,
    stopReason: String,

    // 🔥 HEADER OVERRIDES
    headerOverrideUrl: String,
    headerOverrideHandle: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Campaign", CampaignSchema);
