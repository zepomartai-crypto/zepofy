const axios = require("axios");

const Template = require("../models/Template");
const metaService = require("../services/metaTemplateService");
const WhatsAppIntegration = require("../models/WhatsAppIntegration");
const metaUploadService = require("../services/metaUploadService");
const path = require("path");
const fs = require("fs");
const { parse } = require("path");


/**
 * 🔥 HELPER: Normalize template for frontend compatibility
 */
const _normalizeTemplate = (template) => {
  return {
    _id: template._id,
    name: template.name,
    metaTemplateName: template.metaTemplateName,
    category: template.category,
    language: template.language,
    metaStatus: template.metaStatus,
    locked: template.locked,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,

    // Local format (for backward compatibility)
    header: template.header,
    body: template.body,
    footer: template.footer,
    buttons: template.buttons,

    // Meta format (for frontend compatibility)
    components: [
      // Header component
      template.header && template.header.type !== 'none' ? {
        type: 'HEADER',
        format: template.header.type.toUpperCase(),
        text: template.header.text,
        example: template.header.metaImageHandle ? {
          header_handle: [template.header.metaImageHandle]
        } : template.header.image ? {
          image_url: template.header.image.startsWith('http') ? template.header.image : `${process.env.SERVER_URL || 'http://localhost:5000'}${template.header.image}`
        } : undefined
      } : null,

      // Body component
      {
        type: 'BODY',
        text: template.body
      },

      // Footer component
      template.footer ? {
        type: 'FOOTER',
        text: template.footer
      } : null,

      // Buttons component
      template.buttons && template.buttons.length > 0 ? {
        type: 'BUTTONS',
        buttons: template.buttons.map(button => ({
          type: button.type,
          text: button.text,
          url: button.url,
          phone_number: button.phone_number
        }))
      } : null
    ].filter(Boolean)
  };
};


/* ---------------- SYNC META APPROVAL STATUS ---------------- */
exports.syncMetaTemplates = async (req, res) => {
  try {
    // Get user's WhatsApp integration
    const integration = await WhatsAppIntegration.findByUserIdWithToken(req.userId);

    if (!integration) {
      return res.status(404).json({ error: "No WhatsApp integration found" });
    }

    if (integration.status !== "connected") {
      return res.status(400).json({ error: "WhatsApp integration not connected" });
    }

    const response = await axios.get(
      `https://graph.facebook.com/${process.env.META_API_VERSION}/${integration.wabaId}/message_templates`,
      {
        headers: {
          Authorization: `Bearer ${integration.accessToken}`,
        },
        timeout: 10000
      }
    );

    const metaTemplates = response?.data?.data || [];
    let updatedCount = 0;
    let localFound = 0;

    for (const metaTpl of metaTemplates) {
      // Find components to extract body text/header
      const bodyComponent = metaTpl.components?.find(c => c.type === 'BODY');

      // ✅ MATCH: Find if this template exists locally for this user
      const existing = await Template.findOne({
        userId: req.userId,
        $or: [
          { metaTemplateId: metaTpl.id },
          { metaTemplateName: metaTpl.name, language: metaTpl.language }
        ]
      });

      if (existing) {
        localFound++;
        // Map Meta status to local status
        const newStatus = metaTpl.status?.toLowerCase();
        const newCategory = metaTpl.category?.toUpperCase();

        // update status and critical info without overwriting local body
        // Only update if status or category actually changed or ID is missing
        if (
          existing.metaStatus !== newStatus ||
          existing.category !== newCategory ||
          !existing.metaTemplateId
        ) {
          await Template.updateOne(
            { _id: existing._id },
            {
              $set: {
                metaStatus: newStatus === 'approved' ? 'approved' :
                  newStatus === 'rejected' ? 'rejected' :
                    newStatus === 'pending' ? 'pending' : existing.metaStatus,
                metaTemplateId: metaTpl.id,
                category: newCategory || existing.category,
                locked: (newStatus === 'approved' || newStatus === 'pending')
              }
            }
          );
          updatedCount++;
        }
      }
      // 🚫 STOP: We no longer auto-import templates that don't exist locally (per user request)
    }

    if (updatedCount > 0 || localFound > 0) {
      console.log(`📡 [Meta Sync] Results: Your Library Matches: ${localFound} | Updates Applied: ${updatedCount}`);
    }

    const allTemplates = await Template.find({ userId: req.userId }).sort({ createdAt: -1 });
    const normalized = allTemplates.map(_normalizeTemplate);

    res.json({
      success: true,
      message: `WhatsApp Templates synced successfully. Found ${localFound} matching templates in your library.`,
      templates: normalized
    });
  } catch (err) {
    console.error("META SYNC ERROR:", err.response?.data || err.message);
    res.status(500).json({ error: "Meta sync failed" });
  }
};

/* ---------------- CREATE TEMPLATE (DB ONLY) ---------------- */
exports.createTemplate = async (req, res) => {
  try {
    const { name, category, body, footer, buttons, language, header, variableValues } = req.body;

    if (!name || !body || !category || !language) {
      return res.status(400).json({ error: "Required fields missing: name, body, category, and language are all required." });
    }

    // ===== VARIABLE VALIDATION =====
    const safeBody = typeof body === "string" ? body : "";
    const matches = safeBody.match(/{{\d+}}/g) || [];

    if (matches.length) {
      const nums = matches.map(m => parseInt(m.match(/\d+/)[0]));
      const max = Math.max(...nums);
      for (let i = 1; i <= max; i++) {
        if (!nums.includes(i)) {
          return res.status(400).json({
            error: `Variables must be sequential. Missing {{${i}}}`,
          });
        }
      }
    }

    const metaTemplateName = name.toLowerCase().replace(/[^a-z0-9_]/g, "_");

    // ===== HEADER HANDLING WITH IMAGE UPLOAD =====
    let headerData = { type: "none" };

    if (req.file) {
      // image uploaded via Cloudinary
      headerData = {
        type: "image",
        image: req.file.path, // Cloudinary URL
        cloudinaryPublicId: req.file.filename // Cloudinary public_id
      };
    } else if (header) {
      // text / none header from JSON
      const parsedHeader =
        typeof header === "string" ? JSON.parse(header) : header;

      headerData = parsedHeader;
    }

    // ===== BUTTONS SAFE PARSE =====
    let parsedButtons = [];
    if (typeof buttons === "string") {
      try {
        parsedButtons = JSON.parse(buttons);
      } catch {
        parsedButtons = [];
      }
    } else if (Array.isArray(buttons)) {
      parsedButtons = buttons;
    }

    // ===== LANGUAGE MAPPING (Gujarati -> Hindi for Meta) =====
    const languageMap = {
      'en_US': { meta: 'en_US', user: 'English' },
      'hi_IN': { meta: 'hi', user: 'Hindi' },
      'hi': { meta: 'hi', user: 'Hindi' },
      'gu_IN': { meta: 'hi', user: 'Gujarati' },
      'gu': { meta: 'hi', user: 'Gujarati' }
    };

    const mapped = languageMap[language] || { meta: language, user: language };

    const isCatalog = parsedButtons.some(b => b.type === "CATALOG");
    const templateType = isCatalog ? "CATALOG" : "STANDARD";
    const finalCategory = isCatalog ? "MARKETING" : category;

    const template = await Template.create({
      userId: req.userId,
      name,
      metaTemplateName,
      category: finalCategory,
      type: templateType,
      language, // Keep original gu_IN for UI
      userLanguage: mapped.user,
      metaLanguage: mapped.meta,
      body,
      variableValues: variableValues || {}, // Save variable samples
      header: headerData,
      footer,
      buttons: parsedButtons,
      metaStatus: "draft",
      locked: false,
    });

    res.json({ success: true, template });
  } catch (err) {
    console.error("CREATE TEMPLATE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};


/* ---------------- LIST ---------------- */
exports.listTemplates = async (req, res) => {
  const templates = await Template.find({ userId: req.userId }).sort({
    createdAt: -1,
  });

  // 🔥 CRITICAL: Normalize template data for frontend compatibility
  const normalizedTemplates = templates.map(_normalizeTemplate);

  res.json({ success: true, templates: normalizedTemplates });
};

/* ---------------- VALIDATE DELETE (SIMPLIFIED) ---------------- */
exports.validateDelete = async (req, res) => {
  try {
    const template = await Template.findOne({ _id: req.params.id, userId: req.userId });

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    // 🔥 SIMPLIFIED: All templates can be deleted
    const validation = {
      canDelete: true,
      reason: null,
      metaStatus: template.metaStatus,
      templateName: template.name
    };

    console.log(`✅ Delete validation passed for: ${template.name} (${template.metaStatus})`);

    res.json({
      success: true,
      data: validation
    });
  } catch (err) {
    console.error('❌ Validate delete error:', err);
    res.status(500).json({ error: err.message });
  }
};

/* ---------------- DELETE (ALL TEMPLATES) ---------------- */
exports.deleteTemplate = async (req, res) => {
  try {
    const template = await Template.findOne({ _id: req.params.id, userId: req.userId });

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    console.log(`🗑️ Deleting template: ${template.name} (Status: ${template.metaStatus})`);

    // 🔥 OPTIONAL: Handle Meta deletion asynchronously if needed
    // This should NOT block the user delete operation
    if (template.metaStatus === "approved" || template.metaStatus === "pending") {
      // TODO: Add async Meta deletion here if required
      // This should run in background without blocking user
      console.log(`📱 Template ${template.metaStatus} - will handle Meta deletion asynchronously if needed`);
    }

    // Delete image from Cloudinary if it exists
    if (template.header?.cloudinaryPublicId) {
      try {
        const cloudinary = require("../config/cloudinary");
        await cloudinary.uploader.destroy(template.header.cloudinaryPublicId);
        console.log(`🧹 Cloudinary image deleted: ${template.header.cloudinaryPublicId}`);
      } catch (err) {
        console.error("❌ Cloudinary delete error:", err.message);
      }
    }

    // Delete template from database immediately
    await template.deleteOne();

    console.log(`✅ Template deleted successfully from database`);

    res.json({
      success: true,
      message: "Template deleted successfully",
      templateName: template.name
    });
  } catch (err) {
    console.error('❌ Delete template error:', err);
    res.status(500).json({ error: err.message });
  }
};

/* ---------------- SUBMIT TO META (ONLY ONCE) ---------------- */

exports.submitForApproval = async (req, res) => {
  try {
    const template = await Template.findOne({ _id: req.params.id, userId: req.userId });

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    if (template.metaStatus !== "draft") {
      return res.status(400).json({
        error: `Template already submitted (status: ${template.metaStatus})`,
      });
    }

    // 🚫 DUPLICATE CHECK
    const exists = await Template.findOne({
      userId: template.userId,
      metaTemplateName: template.metaTemplateName,
      language: template.language,
      metaStatus: { $in: ["pending", "approved"] },
    });

    if (exists) {
      return res.status(400).json({
        error: "Template already exists in Meta. Cannot resubmit.",
      });
    }

    /* =====================================================
       IMAGE HEADER → UPLOAD → GET upload_handle
    ===================================================== */
    let uploadHandle = null;

    if (template.header?.type === "image") {
      // ✅ image path must be relative like: /uploads/templates/xxx.jpg
      if (
        !template.header.image ||
        typeof template.header.image !== "string"
      ) {
        return res.status(400).json({
          error: "Image header selected but image path missing",
        });
      }

      // ✅ Cloudinary URL source
      const imageSourceUrl = template.header.image;

      // ✅ Check source
      if (!imageSourceUrl) {
        return res.status(400).json({ error: "Image source URL missing" });
      }

      try {
        // ✅ Upload to Meta using Cloudinary URL (handles fetch internally in service)
        uploadHandle = await metaUploadService.uploadTemplateImage(
          req.userId,
          imageSourceUrl
        );

        // 🔥 SAVE META IMAGE HANDLE (VERY IMPORTANT)
        template.header.metaImageHandle = uploadHandle;
        await template.save();


      } catch (err) {
        console.error("META IMAGE UPLOAD ERROR:", err.message);

        return res.status(400).json({
          error: "Failed to upload image to Meta",
        });
      }

      if (!uploadHandle) {
        return res.status(400).json({
          error: "Meta did not return upload_handle",
        });
      }
    }



    /* =====================================================
       SUBMIT TEMPLATE TO META
    ===================================================== */
    const metaRes = await metaService.submitTemplateToMeta(
      req.userId,
      template,
      uploadHandle
    );

    template.metaTemplateId = metaRes.id;
    template.metaStatus = "pending";
    template.locked = true;
    await template.save();

    res.json({
      success: true,
      message: "Template submitted to Meta for approval",
    });
  } catch (err) {
    console.error("META TEMPLATE ERROR:", err.response?.data || err.message);

    const metaError = err.response?.data?.error;
    const errorStr = (metaError?.error_user_msg || metaError?.message || err.message || "Meta rejected template").toLowerCase();

    // ISSUE 2 FIX: Trail Expired
    if (errorStr.includes("trial expired") || errorStr.includes("tier") || errorStr.includes("limit was reached")) {
      return res.status(400).json({
        success: false,
        error: "Upgrade WhatsApp plan required. Your trial period has expired or you have reached your plan limit."
      });
    }

    res.status(400).json({
      success: false,
      error:
        err.response?.data?.error?.error_user_msg ||
        err.response?.data?.error?.message ||
        err.message ||
        "Meta rejected template",
    });
  }
};

/* ---------------- UPDATE TEMPLATE (DRAFT ONLY) ---------------- */
exports.updateTemplate = async (req, res) => {
  try {
    const template = await Template.findOne({ _id: req.params.id, userId: req.userId });

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    // ✅ META IMMUTABILITY RULES: Only allow editing of draft & pending templates
    if (template.metaStatus !== "draft" && template.metaStatus !== "pending") {
      return res.status(400).json({
        error: "Template cannot be edited",
        details: {
          currentStatus: template.metaStatus,
          rule: "Only draft and pending templates can be edited",
          solution: template.metaStatus === "approved"
            ? "Use 'Duplicate' to create a new version of this approved template"
            : template.metaStatus === "rejected"
              ? "Use 'Duplicate' to create a new version of this rejected template"
              : "Template cannot be edited in current status"
        }
      });
    }

    const { name, category, body, header, footer, buttons, language, variableValues } = req.body;

    // ===== VARIABLE VALIDATION =====
    const safeBody = typeof body === "string" ? body : "";
    const matches = safeBody.match(/{{\d+}}/g) || [];

    if (!name || !body || !category || !language) {
      return res.status(400).json({ error: "Required fields missing: name, body, category, and language are all required." });
    }

    if (matches.length) {
      const nums = matches.map(m => parseInt(m.match(/\d+/)[0]));
      const max = Math.max(...nums);
      for (let i = 1; i <= max; i++) {
        if (!nums.includes(i)) {
          return res.status(400).json({
            error: `Variables must be sequential. Missing {{${i}}}`,
          });
        }
      }
    }

    // ===== HEADER UPDATE (CLOUDINARY) =====
    if (req.file) {
      // Cleanup old image if it exists
      if (template.header?.cloudinaryPublicId) {
        try {
          const cloudinary = require("../config/cloudinary");
          await cloudinary.uploader.destroy(template.header.cloudinaryPublicId);
        } catch (e) {
          console.error("Old Cloudinary image delete failed:", e);
        }
      }

      // user uploaded new image
      template.header = {
        type: "image",
        image: req.file.path,
        cloudinaryPublicId: req.file.filename
      };
    } else if (header) {
      const parsedHeader =
        typeof header === "string" ? JSON.parse(header) : header;

      template.header = parsedHeader;
    }

    // ===== BUTTONS SAFE PARSE =====
    let parsedButtons = [];
    if (typeof buttons === "string") {
      try {
        parsedButtons = JSON.parse(buttons);
      } catch {
        parsedButtons = [];
      }
    } else if (Array.isArray(buttons)) {
      parsedButtons = buttons;
    }

    // ===== LANGUAGE MAPPING (Gujarati -> Hindi for Meta) =====
    const languageMap = {
      'en_US': { meta: 'en_US', user: 'English' },
      'hi_IN': { meta: 'hi', user: 'Hindi' },
      'hi': { meta: 'hi', user: 'Hindi' },
      'gu_IN': { meta: 'hi', user: 'Gujarati' },
      'gu': { meta: 'hi', user: 'Gujarati' }
    };

    const langToUse = language || template.language;
    const mapped = languageMap[langToUse] || { meta: langToUse, user: langToUse };

    template.name = name;
    template.category = category;
    template.language = langToUse;
    template.userLanguage = mapped.user;
    template.metaLanguage = mapped.meta;
    template.body = body;
    template.variableValues = variableValues || {}; // Update variable samples
    template.footer = footer;
    template.buttons = parsedButtons;

    await template.save();

    res.json({ success: true, template });
  } catch (err) {
    console.error("UPDATE TEMPLATE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};


