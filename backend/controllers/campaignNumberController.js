// controllers/campaignNumberController.js
const CampaignNumber = require("../models/CampaignNumber");
const Campaign = require("../models/Campaign");
const CampaignRecipient = require("../models/CampaignRecipient");
const Contact = require("../models/Contact");
const { normalizePhone, isValidNormalizedPhone } = require("../utils/phoneNormalizer");

/**
 * Add a single number to a campaign
 * POST /campaigns/:campaignId/numbers
 */
exports.addCampaignNumber = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { name, phone, countryCode = "91" } = req.body;

    // Verify campaign ownership
    const campaign = await Campaign.findOne({
      _id: campaignId,
      userId: req.userId
    });

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    // Normalize phone
    const cleanPhone = normalizePhone(phone, countryCode);
    if (!cleanPhone || !isValidNormalizedPhone(cleanPhone)) {
      return res.status(400).json({
        error: `Invalid phone number format for country code +${countryCode}.`
      });
    }

    // Check for duplicate in this campaign
    const existing = await CampaignNumber.findOne({
      campaignId,
      userId: req.userId,
      phone: cleanPhone
    });

    if (existing) {
      // Ensure it's in tracking too
      const tracking = await CampaignRecipient.findOne({ campaignId, phone: cleanPhone, userId: req.userId });
      if (!tracking) {
        const newTracking = await CampaignRecipient.create({
          campaignId,
          userId: req.userId,
          phone: cleanPhone,
          name: name?.trim() || existing.name,
          source: "manual",
          status: "pending"
        });
        return res.json({ success: true, campaignNumber: newTracking });
      }
      return res.json({ success: true, campaignNumber: tracking });
    }

    // Create campaign number
    const campaignNumber = await CampaignNumber.create({
      campaignId,
      userId: req.userId,
      name: name?.trim() || null,
      phone: cleanPhone,
      source: "manual"
    });

    // 🔥 SYNC: Create/Update main Contact entry
    try {
      await Contact.updateOne(
        { userId: req.userId, phone: cleanPhone },
        {
          $setOnInsert: {
            userId: req.userId,
            name: name?.trim() || "Unknown",
            phone: cleanPhone,
            source: "CAMPAIGN",
            createdAt: new Date()
          }
        },
        { upsert: true }
      );
    } catch (contactErr) {
      console.warn("⚠️ Contact sync failed:", contactErr.message);
    }

    // 🔥 SYNC: Create campaign recipient for real-time tracking
    const recipient = await CampaignRecipient.create({
      campaignId,
      userId: req.userId,
      phone: cleanPhone,
      name: name?.trim() || null,
      source: "manual",
      status: "pending"
    });

    // Update campaign count
    await Campaign.updateOne(
      { _id: campaignId, userId: req.userId },
      {
        $inc: {
          campaignNumbersCount: 1,
          total: 1
        }
      }
    );

    res.json({
      success: true,
      campaignNumber: recipient // 🔥 FIX: Return the recipient object so the ID is correct for removal
    });

  } catch (err) {
    console.error("❌ addCampaignNumber error:", err);
    if (err.code === 11000) { // Duplicate key error
      return res.status(400).json({ error: "Phone number already exists in this campaign" });
    }
    res.status(500).json({ error: err.message });
  }
};

/**
 * Import numbers from CSV to campaign
 * POST /campaigns/:campaignId/import-csv
 */
exports.importCampaignNumbers = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const defaultCountryCode = req.body.countryCode || "91";

    // Verify campaign ownership
    const campaign = await Campaign.findOne({
      _id: campaignId,
      userId: req.userId
    });

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "CSV file is required" });
    }

    // Parse CSV
    const csvData = req.file.buffer.toString('utf-8');
    const lines = csvData.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      return res.status(400).json({ error: "CSV must have at least header and one data row" });
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
    const nameIndex = headers.indexOf('name');
    const phoneIndex = headers.indexOf('phone');
    const countryCodeIndex = headers.indexOf('country_code');

    if (phoneIndex === -1) {
      return res.status(400).json({ error: "CSV must have 'phone' column" });
    }

    const numbers = [];
    const recipients = [];
    const skipped = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = [];
      let current = '';
      let inQuotes = false;
      for (let char of line) {
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) { cols.push(current.trim()); current = ''; }
        else current += char;
      }
      cols.push(current.trim());

      if (cols.length <= phoneIndex) {
        skipped.push({ row: i + 1, phone: cols.join(','), reason: "Insufficient columns" });
        continue;
      }

      const phone = cols[phoneIndex]?.replace(/"/g, '').trim();
      const csvCountryCode = countryCodeIndex !== -1 ? cols[countryCodeIndex]?.replace(/"/g, '').trim() : null;
      const effectiveCountryCode = csvCountryCode || defaultCountryCode;

      const cleanPhone = normalizePhone(phone, effectiveCountryCode);

      if (!cleanPhone || !isValidNormalizedPhone(cleanPhone)) {
        skipped.push({ row: i + 1, phone, reason: `Invalid phone format for +${effectiveCountryCode}` });
        continue;
      }

      const name = nameIndex !== -1 ? cols[nameIndex]?.replace(/"/g, '').trim() : null;

      numbers.push({
        campaignId,
        userId: req.userId,
        name: name || null,
        phone: cleanPhone,
        source: "csv"
      });

      // Prepare recipient data
      recipients.push({
        campaignId,
        userId: req.userId,
        phone: cleanPhone,
        name: name || null,
        source: "csv",
        status: "pending"
      });
    }

    // Bulk insert Campaign Numbers
    let imported = 0;
    try {
      const inserted = await CampaignNumber.insertMany(numbers, { ordered: false });
      imported = inserted.length;
    } catch (err) {
      // Ignore duplicate key errors, they are skipped by ordered:false
      imported = err.result?.nInserted || err.insertedDocs?.length || 0;
    }

    // 🔥 SYNC: Bulk insert/update main Contacts
    if (numbers.length > 0) {
      try {
        const contactOps = numbers.map(n => ({
          updateOne: {
            filter: { userId: req.userId, phone: n.phone },
            update: {
              $setOnInsert: {
                userId: req.userId,
                name: n.name || "Unknown",
                phone: n.phone,
                source: "CAMPAIGN",
                createdAt: new Date()
              }
            },
            upsert: true
          }
        }));
        await Contact.bulkWrite(contactOps, { ordered: false });
      } catch (contactErr) {
        console.warn("⚠️ Bulk contact sync partial failure:", contactErr.message);
      }

      // Bulk insert Campaign Recipients for tracking
      try {
        await CampaignRecipient.insertMany(recipients, { ordered: false });
      } catch (err) {
        // Ignore partial failures (duplicates)
      }
    }

    // Update campaign count
    await Campaign.updateOne(
      { _id: campaignId, userId: req.userId },
      {
        $inc: {
          campaignNumbersCount: imported,
          total: imported
        }
      }
    );

    res.json({
      success: true,
      summary: {
        totalRows: lines.length - 1,
        imported,
        skipped: skipped.length,
        skippedDetails: skipped
      }
    });

  } catch (err) {
    console.error("❌ importCampaignNumbers error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * List recipients for a campaign with full tracking data
 * GET /campaign-numbers/:campaignId/numbers
 */
exports.listCampaignNumbers = async (req, res) => {
  try {
    const { campaignId } = req.params;

    // Fetch from CampaignRecipient to get live status
    const numbers = await CampaignRecipient.find({ campaignId, userId: req.userId })
      .sort({ createdAt: 1 })
      .select('name phone status source messageId sentAt deliveredAt readAt failureReason createdAt');

    res.json({ success: true, numbers });

  } catch (err) {
    console.error("❌ listCampaignNumbers error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Remove a number from campaign
 * DELETE /campaign-numbers/:campaignId/numbers/:recipientId
 */
exports.removeCampaignNumber = async (req, res) => {
  try {
    const { campaignId, numberId } = req.params;

    // 🔥 VALIDATION: Check if numberId is a valid ObjectId string
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(numberId)) {
      return res.status(400).json({ error: "Invalid recipient ID format." });
    }

    // Try to find in tracking collection first
    let recipient = await CampaignRecipient.findOne({
      _id: numberId,
      campaignId,
      userId: req.userId
    });

    let phoneToRemove = null;

    if (recipient) {
      phoneToRemove = recipient.phone;
      await CampaignRecipient.deleteOne({ _id: numberId });
      // Also try to remove from source collection if it exists there
      await CampaignNumber.deleteOne({ campaignId, phone: phoneToRemove, userId: req.userId });
    } else {
      // If not found in tracking, try to find in manual source collection (for drafts)
      const manualNum = await CampaignNumber.findOne({
        _id: numberId,
        campaignId,
        userId: req.userId
      });

      if (manualNum) {
        phoneToRemove = manualNum.phone;
        await CampaignNumber.deleteOne({ _id: numberId });
      }
    }

    if (!phoneToRemove) {
      return res.status(404).json({ error: "Recipient not found or already removed." });
    }

    // Update campaign count
    await Campaign.updateOne(
      { _id: campaignId },
      {
        $inc: {
          campaignNumbersCount: -1,
          total: -1
        }
      }
    );

    res.json({ success: true });

  } catch (err) {
    console.error("❌ removeCampaignNumber error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Remove all manual/csv recipients from campaign
 * DELETE /campaign-numbers/:campaignId/clear-all
 */
exports.clearCampaignNumbers = async (req, res) => {
  try {
    const { campaignId } = req.params;

    // Verify campaign ownership
    const campaign = await Campaign.findOne({
      _id: campaignId,
      userId: req.userId
    });

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Remove manual and csv (those in CampaignRecipient collection for this campaign)
    await CampaignNumber.deleteMany({ campaignId, userId: req.userId });
    await CampaignRecipient.deleteMany({ campaignId, userId: req.userId });

    // Update campaign count
    await Campaign.updateOne(
      { _id: campaignId },
      {
        $set: {
          campaignNumbersCount: 0,
          total: 0
        }
      }
    );

    res.json({
      success: true,
      message: "All recipients cleared"
    });

  } catch (err) {
    console.error("❌ clearCampaignNumbers error:", err);
    res.status(500).json({ error: err.message });
  }
};