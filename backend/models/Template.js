const mongoose = require("mongoose");

const TemplateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    metaTemplateName: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },

    category: {
      type: String,
      enum: ["UTILITY", "MARKETING", "AUTHENTICATION"],
      required: true,
    },

    type: {
      type: String,
      enum: ["STANDARD", "CATALOG"],
      default: "STANDARD",
    },

    language: {
      type: String,
      default: "en_US",
      required: true,
    },
    userLanguage: String, // Store chosen language name (e.g. Gujarati)
    metaLanguage: String, // Store mapped Meta language code (e.g. hi_IN)

    /* ================= HEADER ================= */
    header: {
      type: Object,
      default: {
        type: "none",          // none | text | image
        text: null,            // for text header
        image: null,           // local path (preview only)
        metaImageHandle: null  // Meta upload_handle (REAL send)
      }
    },

    /* ================= BODY (MANDATORY) ================= */
    body: {
      type: String,
      required: true,
    },

    // 🔥 Variable Values for Meta Approval Examples
    variableValues: {
      type: Object,
      default: {}
    },

    /* ================= FOOTER ================= */
    footer: {
      type: String,
      default: "",
    },

    /* ================= BUTTONS ================= */
    buttons: {
      type: Array,
      default: [],
    },

    /* ================= META ================= */
    metaTemplateId: {
      type: String,
      default: null,
    },

    metaStatus: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected"],
      default: "draft",
      index: true,
    },

    locked: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// 🚫 Prevent duplicate template name + language per user
TemplateSchema.index(
  { userId: 1, metaTemplateName: 1, language: 1 },
  { unique: true }
);

module.exports = mongoose.model("Template", TemplateSchema);
