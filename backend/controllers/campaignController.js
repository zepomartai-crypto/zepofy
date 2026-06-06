// controllers/campaignController.js
const Campaign = require("../models/Campaign");
const CampaignNumber = require("../models/CampaignNumber");
const CampaignRecipient = require("../models/CampaignRecipient");
const ContactGroup = require("../models/ContactGroup");
const Contact = require("../models/Contact");
const { processCampaign } = require("../services/processCampaign");
const { startCampaignScheduler } = require("../services/campaignScheduler");
const { normalizePhone } = require("../utils/phoneNormalizer");

exports.updateCampaign = async (req, res) => {
  try {
    const {
      name,
      phoneNumberId,
      template,
      recipientSource, // Added
      groupIds = [],
      contactIds = [], // Added
      scheduledAt,
      headerOverrideUrl,
      headerOverrideHandle,
    } = req.body;

    const campaign = await Campaign.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    /* ---------------- VALIDATION ---------------- */
    if (!name?.trim()) {
      return res.status(400).json({ error: "Campaign name required" });
    }

    if (!template?.metaTemplateName) {
      return res.status(400).json({ error: "Template required" });
    }

    if (!["group", "contacts", "addNumber", "importCsv"].includes(recipientSource)) {
      return res.status(400).json({ error: "Invalid recipient source" });
    }

    /* ---------------- RECIPIENT CHANGE DETECTION ---------------- */
    const recipientChanged =
      campaign.recipientSource !== recipientSource ||
      JSON.stringify((campaign.groupIds || []).sort()) !== JSON.stringify((groupIds || []).sort()) ||
      JSON.stringify((campaign.contactIds || []).sort()) !== JSON.stringify((contactIds || []).sort());

    /* ---------------- RESET RECIPIENTS ---------------- */
    if (recipientChanged) {
      await CampaignRecipient.deleteMany({ campaignId: campaign._id });
      await CampaignNumber.deleteMany({ campaignId: campaign._id });
      campaign.total = 0;
    }

    /* ---------------- AUDIENCE CALCULATION (DEDUPLICATED) ---------------- */
    let audiencePhones = new Set();

    // 1. Groups
    if (groupIds.length) {
      const groups = await ContactGroup.find({ _id: { $in: groupIds }, userId: req.userId });
      const cIds = groups.flatMap(g => g.contactIds || []);
      const contacts = await Contact.find({ _id: { $in: cIds }, userId: req.userId }).select('phone');
      contacts.forEach(c => audiencePhones.add(c.phone));
    }

    // 2. Individual Contacts
    if (contactIds.length) {
      const contacts = await Contact.find({ _id: { $in: contactIds }, userId: req.userId }).select('phone');
      contacts.forEach(c => audiencePhones.add(c.phone));
    }

    // 3. Manual Numbers
    const manualNumbers = await CampaignNumber.find({ campaignId: campaign._id });
    manualNumbers.forEach(n => audiencePhones.add(n.phone));

    const total = audiencePhones.size;

    /* ---------------- FINAL UPDATE ---------------- */
    campaign.name = name.trim();
    campaign.template = {
      metaTemplateName: template.metaTemplateName,
      language: template.language || "en_US",
      variables: template.variables || [],
      variableTypes: template.variableTypes || [],
    };

    campaign.recipientSource = recipientSource;
    campaign.groupIds = groupIds || [];
    campaign.contactIds = contactIds || []; // Added
    campaign.total = total;

    // ✅ STATUS FIX
    if (scheduledAt && scheduledAt.trim()) {
      const scheduledDate = new Date(scheduledAt);
      if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
        return res.status(400).json({ error: "Scheduled time must be in the future" });
      }
      campaign.scheduledAt = scheduledDate;
      campaign.status = "scheduled";

      startCampaignScheduler();
    } else {

      campaign.scheduledAt = null;
      campaign.status = "draft"; // VERY IMPORTANT
    }

    if (phoneNumberId) {
      campaign.phoneNumberId = phoneNumberId;
    }

    if (headerOverrideUrl !== undefined) campaign.headerOverrideUrl = headerOverrideUrl;
    if (headerOverrideHandle !== undefined) campaign.headerOverrideHandle = headerOverrideHandle;

    // Reset execution data
    campaign.startedAt = null;
    campaign.completedAt = null;
    campaign.pausedAt = null;
    campaign.resumedAt = null;
    campaign.sentCount = 0;
    campaign.failedCount = 0;

    // ✅ SYNC MANUAL RECIPIENTS (If provided in payload)
    const { manualRecipients = [] } = req.body;
    if (manualRecipients.length > 0) {
      // 1. Clear existing for this campaign
      await CampaignNumber.deleteMany({ campaignId: campaign._id });
      await CampaignRecipient.deleteMany({ campaignId: campaign._id });

      // 2. Insert new
      const cleanedManual = manualRecipients.map(r => ({
        campaignId: campaign._id,
        userId: req.userId,
        name: r.name || null,
        phone: normalizePhone(r.phone),
        source: r.source || "manual"
      }));

      await CampaignNumber.insertMany(cleanedManual);

      // Also create recipients for the PROJECTED run
      const recipients = cleanedManual.map(r => ({
        ...r,
        status: "pending"
      }));
      await CampaignRecipient.insertMany(recipients);

      // 🔥 SYNC: Auto-save manual/csv contacts to main directory
      try {
        const contactOps = cleanedManual.map(r => ({
          updateOne: {
            filter: { userId: req.userId, phone: r.phone },
            update: {
              $setOnInsert: {
                userId: req.userId,
                name: r.name || "Unknown",
                phone: r.phone,
                source: "CAMPAIGN",
                createdAt: new Date()
              }
            },
            upsert: true
          }
        }));
        if (contactOps.length > 0) await Contact.bulkWrite(contactOps, { ordered: false });
      } catch (e) {
        console.warn("⚠️ Contact sync failure in updateCampaign:", e.message);
      }

      // 3. Update total if source is not group
      if (recipientSource !== "group") {
        campaign.total = cleanedManual.length;
      }
    }

    await campaign.save();

    res.json({ success: true, campaign });

  } catch (err) {
    console.error("❌ updateCampaign error:", err);
    res.status(500).json({ error: err.message });
  }
};


exports.createCampaign = async (req, res) => {
  try {
    const {
      name,
      phoneNumberId,
      template,
      recipientSource, // Added
      groupIds = [],
      contactIds = [], // Added
      scheduledAt,
      flowId,
      headerOverrideUrl,
      headerOverrideHandle,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Campaign name required" });
    }

    // Phone Number ID is optional for creation, required for sending
    // if (!phoneNumberId) {
    //   return res.status(400).json({ error: "Phone Number ID required" });
    // }

    if (!template?.metaTemplateName) {
      return res.status(400).json({ error: "Template required" });
    }

    if (!recipientSource || !["group", "contacts", "addNumber", "importCsv"].includes(recipientSource)) {
      return res.status(400).json({ error: "Valid recipient source required" });
    }

    // Validate scheduledAt if provided
    if (scheduledAt && scheduledAt.trim()) {
      const scheduledDate = new Date(scheduledAt);
      if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
        return res.status(400).json({ error: "Scheduled time must be in the future" });
      }
    }

    // Validate based on recipient source
    if (recipientSource === "group") {
      if (!groupIds.length && !contactIds.length) {
        return res.status(400).json({ error: "At least one group or individual contact must be selected" });
      }

      // Verify groups exist and belong to user
      if (groupIds.length) {
        const groups = await ContactGroup.find({
          _id: { $in: groupIds },
          userId: req.userId
        });

        if (groups.length !== groupIds.length) {
          return res.status(400).json({ error: "One or more groups not found" });
        }
      }

      // Verify contacts exist and belong to user
      if (contactIds.length) {
        const contacts = await Contact.find({
          _id: { $in: contactIds },
          userId: req.userId
        });

        if (contacts.length !== contactIds.length) {
          return res.status(400).json({ error: "One or more contacts not found" });
        }
      }
    }

    /* ---------------- AUDIENCE CALCULATION (DEDUPLICATED) ---------------- */
    let audiencePhones = new Set();

    // 1. Groups
    if (groupIds.length) {
      const groups = await ContactGroup.find({ _id: { $in: groupIds }, userId: req.userId });
      const cIds = groups.flatMap(g => g.contactIds || []);
      const contacts = await Contact.find({ _id: { $in: cIds }, userId: req.userId }).select('phone');
      contacts.forEach(c => audiencePhones.add(c.phone));
    }

    // 2. Individual Contacts
    if (contactIds.length) {
      const contacts = await Contact.find({ _id: { $in: contactIds }, userId: req.userId }).select('phone');
      contacts.forEach(c => audiencePhones.add(c.phone));
    }

    const total = audiencePhones.size;

    // ✅ PREPARE TEMPLATE SNAPSHOT
    const templateSnapshot = {
      _id: template._id,
      name: template.name,
      metaTemplateName: template.metaTemplateName,
      language: template.language || "en_US",
      category: template.category,
      components: template.components || [], // Save full Meta structure

      // Save local parsing for easier UI rendering
      header: template.header,
      body: template.body,
      footer: template.footer,
      buttons: template.buttons || [],

      headerImageId: template.headerImageId || (template.header?.mediaId) || null,

      variables: template.variables || [],
      variableTypes: template.variableTypes || []
    };

    const campaign = await Campaign.create({
      userId: req.userId,
      name,
      phoneNumberId,
      templateId: template._id, // Save reference
      template: templateSnapshot, // Save full snapshot
      recipientSource,
      groupIds: groupIds || [],
      contactIds: contactIds || [], // Added
      total,
      scheduledAt: (scheduledAt && scheduledAt.trim()) ? new Date(scheduledAt) : null,
      status: scheduledAt ? "scheduled" : "draft",
      headerOverrideUrl,
      headerOverrideHandle
    });

    // ✅ SYNC MANUAL RECIPIENTS (If provided in payload)
    const { manualRecipients = [] } = req.body;
    if (manualRecipients.length > 0) {
      const cleanedManual = manualRecipients.map(r => ({
        campaignId: campaign._id,
        userId: req.userId,
        name: r.name || null,
        phone: normalizePhone(r.phone),
        source: r.source || "manual"
      }));

      await CampaignNumber.insertMany(cleanedManual);

      // Also create recipients for the PROJECTED run
      const recipients = cleanedManual.map(r => ({
        ...r,
        status: "pending"
      }));
      await CampaignRecipient.insertMany(recipients);

      // 🔥 SYNC: Auto-save manual/csv contacts to main directory
      try {
        const contactOps = cleanedManual.map(r => ({
          updateOne: {
            filter: { userId: req.userId, phone: r.phone },
            update: {
              $setOnInsert: {
                userId: req.userId,
                name: r.name || "Unknown",
                phone: r.phone,
                source: "CAMPAIGN",
                createdAt: new Date()
              }
            },
            upsert: true
          }
        }));
        if (contactOps.length > 0) await Contact.bulkWrite(contactOps, { ordered: false });
      } catch (e) {
        console.warn("⚠️ Contact sync failure in createCampaign:", e.message);
      }

      // Update total if source is not group
      if (recipientSource !== "group") {
        campaign.total = cleanedManual.length;
        await campaign.save();
      }
    }


    // ✅ START SCHEDULER ONLY IF SCHEDULED
    if (scheduledAt) {
      startCampaignScheduler();
    }

    res.json({ success: true, campaign });

  } catch (err) {
    console.error("❌ createCampaign error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Helper to populate template data for a campaign object
 */
const populateTemplateData = async (campaign, userId) => {
  const Template = require("../models/Template");
  const campaignObj = campaign.toObject ? campaign.toObject() : campaign;

  // ✅ STRATEGY 1: Use stored snapshot (New campaigns)
  if (campaignObj.template && campaignObj.template.body) {
    // Ensure components exist for preview
    if (!campaignObj.template.components || campaignObj.template.components.length === 0) {
      // Reconstruct components from stored parts if missing (migration)
      campaignObj.template.components = [
        campaignObj.template.header ? { type: 'HEADER', ...campaignObj.template.header } : null,
        { type: 'BODY', text: campaignObj.template.body },
        campaignObj.template.footer ? { type: 'FOOTER', text: campaignObj.template.footer } : null,
        campaignObj.template.buttons ? { type: 'BUTTONS', buttons: campaignObj.template.buttons } : null
      ].filter(Boolean);
    }
  }
  // ✅ STRATEGY 2: Populate from referenced Template (Old campaigns)
  else if (campaignObj.templateId || (campaignObj.template && campaignObj.template.metaTemplateName)) {
    // Try find by ID first, then by meta name
    let template = null;
    if (campaignObj.templateId) {
      template = await Template.findById(campaignObj.templateId);
    }

    if (!template && campaignObj.template?.metaTemplateName) {
      template = await Template.findOne({
        metaTemplateName: campaignObj.template.metaTemplateName,
        userId: userId
      });
    }

    if (template) {
      campaignObj.template = {
        ...campaignObj.template, // Keep existing vars
        _id: template._id,
        name: template.name,
        category: template.category,
        components: template.components,
        body: template.body,
        header: template.header,
        footer: template.footer,
        buttons: template.buttons
      };
    }
  }

  return campaignObj;
};

// Helper to calculate accurate total for drafts dynamically
const getProjectedTotal = async (campaign, userId) => {
  if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
    return campaign.total;
  }
  
  let audiencePhones = new Set();
  const ContactGroup = require("../models/ContactGroup");
  const Contact = require("../models/Contact");
  const CampaignNumber = require("../models/CampaignNumber");

  try {
    if (campaign.groupIds?.length) {
      const groups = await ContactGroup.find({ _id: { $in: campaign.groupIds }, userId });
      const cIds = groups.flatMap(g => g.contactIds || []);
      const contacts = await Contact.find({ _id: { $in: cIds }, userId }).select('phone');
      contacts.forEach(c => audiencePhones.add(c.phone));
    }
    if (campaign.contactIds?.length) {
      const contacts = await Contact.find({ _id: { $in: campaign.contactIds }, userId }).select('phone');
      contacts.forEach(c => audiencePhones.add(c.phone));
    }
    const manualNumbers = await CampaignNumber.find({ campaignId: campaign._id });
    manualNumbers.forEach(n => audiencePhones.add(n.phone));
    
    // Check exclusions
    const excluded = new Set(campaign.excludedPhones || []);
    let finalCount = 0;
    audiencePhones.forEach(p => { if (!excluded.has(p)) finalCount++; });
    
    return finalCount;
  } catch (e) {
    return campaign.total;
  }
};

/* =========================
   LIST CAMPAIGNS
   ========================= */
exports.listCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find({
      userId: req.userId
    }).sort({ createdAt: -1 });

    // 🔥 CRITICAL: Populate template data for each campaign
    const campaignsPopulated = await Promise.all(
      campaigns.map(async (campaign) => {
        let populated = await populateTemplateData(campaign, req.userId);
        
        // Ensure total is accurate for drafts in case group members changed
        if (populated.status === 'draft' || populated.status === 'scheduled') {
           const projectedTotal = await getProjectedTotal(campaign, req.userId);
           populated.total = projectedTotal;
           
           // Opportunistically save it back to keep db somewhat in sync
           if (projectedTotal !== campaign.total) {
              Campaign.updateOne({ _id: campaign._id }, { $set: { total: projectedTotal } }).exec();
           }
        }
        
        return populated;
      })
    );

    res.json({ success: true, campaigns: campaignsPopulated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================
   RUN CAMPAIGN NOW
========================= */
exports.runCampaignNow = async (req, res) => {
  try {
    console.log("🚀 MANUAL RUN REQUEST for campaign:", req.params.id);
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!campaign) {
      console.log("❌ Campaign not found");
      return res.status(404).json({ error: "Campaign not found" });
    }

    if (campaign.status === "running") {
      console.log("⚠️ Campaign already running");
      return res.status(400).json({ error: "Campaign already running" });
    }

    console.log("📋 Campaign status before run:", campaign.status);

    // Reset for re-run: delete existing recipients so processCampaign fetches fresh
    await CampaignRecipient.deleteMany({ campaignId: campaign._id });
    console.log("🗑️ Deleted existing recipients for fresh run");

    // Use a Set to ensure unique phone numbers
    const uniqueRecipients = new Map();
    const { normalizePhone: globalNormalize } = require("../utils/phoneNormalizer");

    // 1. Collect from Groups
    if (campaign.groupIds?.length) {
      const groups = await ContactGroup.find({ _id: { $in: campaign.groupIds }, userId: req.userId });
      const contactIds = groups.flatMap(g => g.contactIds || []);
      const contacts = await Contact.find({ _id: { $in: contactIds } });
      contacts.forEach(c => {
        const phone = globalNormalize(c.phone) || String(c.phone || "").replace(/\D/g, "");
        if (!uniqueRecipients.has(phone)) {
          uniqueRecipients.set(phone, {
            campaignId: campaign._id,
            userId: req.userId,
            phone,
            name: c.name,
            status: "pending",
            source: "group"
          });
        }
      });
    }

    // 2. Collect from Individual Contacts
    if (campaign.contactIds?.length) {
      const contacts = await Contact.find({ _id: { $in: campaign.contactIds } });
      contacts.forEach(c => {
        const phone = globalNormalize(c.phone) || String(c.phone || "").replace(/\D/g, "");
        if (!uniqueRecipients.has(phone)) {
          uniqueRecipients.set(phone, {
            campaignId: campaign._id,
            userId: req.userId,
            phone,
            name: c.name,
            status: "pending",
            source: "contacts"
          });
        }
      });
    }

    // 3. Collect from Manual/CSV Numbers
    const numbers = await CampaignNumber.find({ campaignId: campaign._id, userId: req.userId });
    numbers.forEach(n => {
      const phone = globalNormalize(n.phone) || String(n.phone || "").replace(/\D/g, "");
      if (!uniqueRecipients.has(phone)) {
        uniqueRecipients.set(phone, {
          campaignId: campaign._id,
          userId: req.userId,
          phone,
          name: n.name,
          status: "pending",
          source: n.source || (campaign.recipientSource === "importCsv" ? "csv" : "manual")
        });
      }
    });

    const recipients = Array.from(uniqueRecipients.values());

    if (!recipients.length) {
      console.log("❌ No recipients found for manual run");
      return res.status(400).json({ error: "No recipients found" });
    }

    // Insert recipients
    await CampaignRecipient.insertMany(recipients);
    campaign.total = recipients.length;
    console.log(`📋 Populated ${recipients.length} recipients for manual run`);

    // Set to running and call processCampaign
    campaign.status = "running";
    campaign.startedAt = new Date();
    campaign.scheduledAt = null; // Clear schedule if manually run
    campaign.sentCount = 0;
    campaign.failedCount = 0;
    await campaign.save();

    console.log("▶️ Campaign set to running, calling processCampaign");

    // Start processing in the background (fire and forget)
    processCampaign(campaign._id)
      .then(() => {
        console.log("✅ Manual run completed successfully");
      })
      .catch(async (error) => {
        console.error("❌ Manual run failed:", error.message);
        try {
          const failedCampaign = await Campaign.findById(campaign._id);
          if (failedCampaign) {
            failedCampaign.status = "failed";
            await failedCampaign.save();
          }
        } catch (saveError) {
          console.error("Failed to update campaign status to failed:", saveError);
        }
      });

    // 🔥 CRITICAL: Return response immediately so UI updates instantly
    res.json({
      success: true,
      campaign: campaign,
      message: "Campaign started successfully"
    });
  } catch (err) {
    console.error("❌ runCampaignNow error:", err);
    res.status(500).json({ error: err.message });
  }
};

// POST /campaigns/:id/pause
exports.pauseCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId, status: "running" },
      { status: "paused", pausedAt: new Date() },
      { new: true }
    );

    if (!campaign) {
      return res.status(400).json({ error: "Campaign not found or not running" });
    }

    res.json({ success: true, message: "Campaign paused successfully" });
  } catch (err) {
    console.error("❌ pauseCampaign error:", err);
    res.status(500).json({ error: err.message });
  }
};

// POST /campaigns/:id/resume
exports.resumeCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId, status: "paused" },
      { status: "running", resumedAt: new Date() },
      { new: true }
    );

    if (!campaign) {
      return res.status(400).json({ error: "Campaign not found or not paused" });
    }

    // Resume processing from where it left off
    const { processCampaign } = require("../services/processCampaign");
    processCampaign(campaign._id);

    res.json({ success: true, message: "Campaign resumed successfully" });
  } catch (err) {
    console.error("❌ resumeCampaign error:", err);
    res.status(500).json({ error: err.message });
  }
};

// POST /campaigns/:id/stop
exports.stopCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId, status: { $in: ["running", "paused"] } },
      {
        status: "failed",
        stoppedAt: new Date(),
        stopReason: req.body?.reason || "Stopped by user"
      },
      { new: true }
    );

    if (!campaign) {
      return res.status(400).json({ error: "Campaign not found or cannot be stopped" });
    }

    res.json({ success: true, message: "Campaign stopped successfully" });
  } catch (err) {
    console.error("❌ stopCampaign error:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================
   DUPLICATE CAMPAIGN
========================= */
exports.duplicateCampaign = async (req, res) => {
  try {
    const campaignId = req.params.id;
    const campaign = await Campaign.findOne({ _id: campaignId, userId: req.userId });

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const newCampaign = await Campaign.create({
      userId: req.userId,
      name: `Copy of ${campaign.name}`,
      phoneNumberId: campaign.phoneNumberId,
      templateId: campaign.templateId,
      template: campaign.template,
      recipientSource: campaign.recipientSource,
      groupIds: campaign.groupIds || [],
      contactIds: campaign.contactIds || [], // 🔥 Added
      total: campaign.total || 0,
      status: "draft",
      headerOverrideUrl: campaign.headerOverrideUrl,
      headerOverrideHandle: campaign.headerOverrideHandle
    });

    // 🔥 DUPLICATE MANUAL/CSV RECIPIENTS (CampaignNumber records)
    const CampaignNumber = require("../models/CampaignNumber");
    const originalNumbers = await CampaignNumber.find({ campaignId: campaign._id });

    if (originalNumbers.length > 0) {
      const newNumbers = originalNumbers.map(n => ({
        userId: req.userId,
        campaignId: newCampaign._id,
        name: n.name,
        phone: n.phone,
        source: n.source
      }));
      await CampaignNumber.insertMany(newNumbers);

      // Update total if not already set correctly
      if (newCampaign.recipientSource !== 'group') {
        newCampaign.total = newNumbers.length;
        await newCampaign.save();
      }
    }

    res.json({ success: true, campaign: newCampaign });
  } catch (err) {
    console.error("❌ duplicateCampaign error:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================
   DELETE CAMPAIGN
========================= */
exports.deleteCampaign = async (req, res) => {
  try {
    await Campaign.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================
   CAMPAIGN ANALYTICS
========================= */
exports.getCampaignAnalytics = async (req, res) => {
  try {
    const campaignId = req.params.id;
    const campaign = await Campaign.findOne({ _id: campaignId, userId: req.userId });

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    let recipients = await CampaignRecipient.find({ campaignId })
      .select('_id phone name status sentAt deliveredAt readAt repliedAt messageId source createdAt')
      .sort({ sentAt: -1, createdAt: -1 });

    // 🔥 DRAFT / SCHEDULED PREVIEW LOGIC (Aggregate all sources)
    if (campaign.status === "draft" || campaign.status === "scheduled") {
      const excluded = new Set(campaign.excludedPhones || []);
      const seenPhones = new Set(recipients.map(r => r.phone));
      const previewRecipients = [...recipients].filter(r => !excluded.has(r.phone));
      // 1. Append Group Contacts if missing from current list
      if (campaign.groupIds?.length > 0) {
        const ContactGroup = require("../models/ContactGroup");
        const Contact = require("../models/Contact");
        const groups = await ContactGroup.find({ _id: { $in: campaign.groupIds }, userId: req.userId });
        const contactIds = groups.flatMap(g => g.contactIds || []);
        const contacts = await Contact.find({ _id: { $in: contactIds }, userId: req.userId }).select('phone name').limit(1000);

        for (const c of contacts) {
          if (!seenPhones.has(c.phone) && !excluded.has(c.phone)) {
            previewRecipients.push({
              _id: c._id,
              phone: c.phone,
              name: c.name,
              status: "pending",
              source: "group",
              createdAt: c.createdAt
            });
            seenPhones.add(c.phone);
          }
        }
      }

      // 2. Append Individual Contacts
      if (campaign.contactIds?.length > 0) {
        const Contact = require("../models/Contact");
        const contacts = await Contact.find({ _id: { $in: campaign.contactIds }, userId: req.userId }).select('phone name').limit(1000);

        for (const c of contacts) {
          if (!seenPhones.has(c.phone) && !excluded.has(c.phone)) {
            previewRecipients.push({
              _id: c._id,
              phone: c.phone,
              name: c.name,
              status: "pending",
              source: "contacts",
              createdAt: c.createdAt
            });
            seenPhones.add(c.phone);
          }
        }
      }

      // 3. Append Manual/CSV Numbers
      const CampaignNumber = require("../models/CampaignNumber");
      const numbers = await CampaignNumber.find({ campaignId: campaign._id }).limit(1000);
      for (const n of numbers) {
        if (!seenPhones.has(n.phone) && !excluded.has(n.phone)) {
          previewRecipients.push({
            _id: n._id,
            phone: n.phone,
            name: n.name,
            status: "pending",
            source: n.source || (campaign.recipientSource === "importCsv" ? "csv" : "manual"),
            createdAt: n.createdAt
          });
          seenPhones.add(n.phone);
        }
      }

      recipients = previewRecipients; // 🔥 Update recipients with preview list
    }

    const stats = {
      totalRecipients: campaign.total || recipients.length, // Ensure drafts show intended exact projected total
      sent: recipients.filter(r => ["sent", "delivered", "read"].includes(r.status)).length,
      delivered: recipients.filter(r => ["delivered", "read"].includes(r.status)).length,
      read: recipients.filter(r => r.status === "read").length,
      failed: recipients.filter(r => r.status === "failed").length,
      replies: recipients.filter(r => r.repliedAt).length,
    };

    const deliveryRate = stats.sent > 0 ? Math.round((stats.delivered / stats.sent) * 100) : 0;
    const readRate = stats.delivered > 0 ? Math.round((stats.read / stats.delivered) * 100) : 0;
    const replyRate = stats.delivered > 0 ? Math.round((stats.replies / stats.delivered) * 100) : 0;

    // 🔥 SYNC BACK TO CAMPAIGN (Fixes list view counts)
    await Campaign.findByIdAndUpdate(campaignId, {
      total: stats.totalRecipients, // Ensures total is synced back
      sentCount: stats.sent,
      failedCount: stats.failed,
      deliveredCount: stats.delivered, // Ensure this exists in model if used
      readCount: stats.read,
      replyCount: stats.replies
    });

    res.json({
      success: true,
      data: {
        ...stats,
        deliveryRate,
        readRate,
        replyRate,
        recipients, // ✅ Crucial for modal list
        repliedContacts: recipients.filter(r => r.repliedAt) // ✅ For replies tab
      }
    });
  } catch (err) {
    console.error("❌ getCampaignAnalytics error:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================
   CREATE GROUP FROM ENGAGEMENT
========================= */
exports.createGroupFromEngagement = async (req, res) => {
  try {
    const campaignId = req.params.id;
    const { type, groupName: customName, groupId } = req.body; // 'read', 'replied', etc., and optional custom name or groupId

    const campaign = await Campaign.findOne({ _id: campaignId, userId: req.userId });
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    let filter = { campaignId };
    let segmentLabel = "";

    if (type === "read") {
      // Strict: Seen but NOT replied
      filter.status = "read";
      filter.repliedAt = null;
      segmentLabel = "Seen (Not Replied)";
    } else if (type === "replied") {
      // Strict: Must have replied
      filter.repliedAt = { $ne: null };
      segmentLabel = "Replied";
    } else if (type === "failed") {
      filter.status = "failed";
      segmentLabel = "Failed Delivery";
    } else if (type === "all") {
      // No extra filtering needed besides campaignId
      segmentLabel = "All Recipients";
    } else {
      return res.status(400).json({ error: "Invalid engagement type. Use 'read', 'replied', 'failed', or 'all'." });
    }

    const recipients = await CampaignRecipient.find(filter).select('phone name');
    if (!recipients.length) {
      return res.status(404).json({ error: `No recipients found for the segment: ${segmentLabel}` });
    }

    const phones = [...new Set(recipients.map(r => r.phone))];

    // 🔥 ENSURE CONTACTS EXIST (Upsert)
    // This handles CSV/Manual recipients who aren't in the global Contact list yet
    const contactOps = recipients.map(r => ({
      updateOne: {
        filter: { userId: req.userId, phone: r.phone },
        update: {
          $setOnInsert: {
            name: r.name || r.phone,
            source: 'CAMPAIGN_SEGMENT',
            createdAt: new Date()
          }
        },
        upsert: true
      }
    }));

    if (contactOps.length > 0) {
      await Contact.bulkWrite(contactOps);
    }

    // Now fetch all matching contact IDs
    const contacts = await Contact.find({
      userId: req.userId,
      phone: { $in: phones }
    }).select('_id');

    const contactIds = contacts.map(c => c._id);

    if (!contactIds.length) {
      return res.status(404).json({ error: "Mapping failed: Records exist but could not be converted to system contacts." });
    }

    let group;
    if (groupId) {
      // 🔄 Update pre-existing group
      group = await ContactGroup.findOne({ _id: groupId, userId: req.userId });
      if (!group) {
        return res.status(404).json({ error: "Target group not found" });
      }

      const existingIds = (group.contactIds || []).map(id => id.toString());
      const mergedIds = [...new Set([...existingIds, ...contactIds.map(id => id.toString())])];

      group.contactIds = mergedIds;
      group.memberCount = mergedIds.length;
      await group.save();
    } else {
      // 🆕 Create new group
      const finalGroupName = customName || `${campaign.name} - ${type === 'read' ? 'Seen' : 'Replied'} (${new Date().toLocaleDateString()})`;
      group = await ContactGroup.create({
        userId: req.userId,
        name: finalGroupName,
        contactIds,
        memberCount: contactIds.length
      });
    }

    res.json({ success: true, group });

  } catch (err) {
    console.error("❌ createGroupFromEngagement error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getCampaignById = async (req, res) => {
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      userId: req.userId
    }).populate('groupIds').populate('contactIds');

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const campaignPopulated = await populateTemplateData(campaign, req.userId);

    res.json({ success: true, campaign: campaignPopulated });
  } catch (err) {
    console.error("❌ getCampaignById error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.resendCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Reset counts and status
    campaign.status = "draft";
    campaign.sentCount = 0;
    campaign.deliveredCount = 0;
    campaign.readCount = 0;
    campaign.failedCount = 0;
    campaign.replyCount = 0;

    // Clear all timestamps
    campaign.scheduledAt = null;
    campaign.sentAt = null;
    campaign.lastRunAt = null;
    campaign.startedAt = null;
    campaign.completedAt = null;
    campaign.pausedAt = null;
    campaign.resumedAt = null;
    campaign.stoppedAt = null;
    campaign.stopReason = null;
    campaign.repliedContacts = [];

    // Clear recipients log for fresh start
    const CampaignRecipient = require("../models/CampaignRecipient");
    const CampaignNumber = require("../models/CampaignNumber");
    const ContactGroup = require("../models/ContactGroup");
    const Contact = require("../models/Contact");
    const { normalizePhone: globalNormalize } = require("../utils/phoneNormalizer");

    await CampaignRecipient.deleteMany({ campaignId: campaign._id });

    // 🔥 Recalculate Audience and Repopulate Log for UI feedback
    const uniqueRecipients = new Map();

    // 1. Groups
    if (campaign.groupIds?.length) {
      const groups = await ContactGroup.find({ _id: { $in: campaign.groupIds } });
      const cIds = groups.flatMap(g => g.contactIds || []);
      const contacts = await Contact.find({ _id: { $in: cIds } });
      contacts.forEach(c => {
        const p = globalNormalize(c.phone) || String(c.phone || "").replace(/\D/g, "");
        if (p && !uniqueRecipients.has(p)) {
          uniqueRecipients.set(p, {
            campaignId: campaign._id,
            userId: req.userId,
            phone: p,
            name: c.name,
            status: "pending",
            source: "group"
          });
        }
      });
    }

    // 2. Individual Contacts
    if (campaign.contactIds?.length) {
      const contacts = await Contact.find({ _id: { $in: campaign.contactIds } });
      contacts.forEach(c => {
        const p = globalNormalize(c.phone) || String(c.phone || "").replace(/\D/g, "");
        if (p && !uniqueRecipients.has(p)) {
          uniqueRecipients.set(p, {
            campaignId: campaign._id,
            userId: req.userId,
            phone: p,
            name: c.name,
            status: "pending",
            source: "contacts"
          });
        }
      });
    }

    // 3. Manual/CSV Numbers
    const manualNumbers = await CampaignNumber.find({ campaignId: campaign._id });
    manualNumbers.forEach(n => {
      const p = globalNormalize(n.phone) || String(n.phone || "").replace(/\D/g, "");
      if (p && !uniqueRecipients.has(p)) {
        uniqueRecipients.set(p, {
          campaignId: campaign._id,
          userId: req.userId,
          phone: p,
          name: n.name,
          status: "pending",
          source: n.source || (campaign.recipientSource === "importCsv" ? "csv" : "manual")
        });
      }
    });

    const recipientsToLog = Array.from(uniqueRecipients.values());
    if (recipientsToLog.length > 0) {
      await CampaignRecipient.insertMany(recipientsToLog);
    }

    campaign.total = recipientsToLog.length;
    await campaign.save();


    res.json({
      success: true,
      message: "Campaign reset to draft. You can now run it again."
    });
  } catch (err) {
    console.error("❌ resendCampaign error:", err);
    res.status(500).json({ error: err.message });
  }
};
