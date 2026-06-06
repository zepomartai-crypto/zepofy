const CampaignRecipient = require("../models/CampaignRecipient");
const Campaign = require("../models/Campaign");
const Contact = require("../models/Contact");
const ContactGroup = require("../models/ContactGroup");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const { normalizePhone, isValidNormalizedPhone } = require("../utils/phoneNormalizer");

// Configure multer for CSV uploads
const upload = multer({
  dest: path.join(__dirname, "../tmp/uploads"),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

/* =========================
   PARSE CSV RECIPIENTS
========================= */
exports.parseCsvRecipients = [
  upload.single("csv"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No CSV file uploaded" });
      }

      const results = [];
      const invalidNumbers = [];

      // Parse CSV file
      await new Promise((resolve, reject) => {
        fs.createReadStream(req.file.path)
          .pipe(csv())
          .on("data", (data) => {
            // Extract phone number from any column
            const phoneNumber = Object.values(data).find(value =>
              /^\d{10,15}$/.test(value?.toString().replace(/\D/g, ""))
            );

            if (phoneNumber) {
              const cleanNumber = phoneNumber.toString().replace(/\D/g, "");
              const normalized = normalizePhone(cleanNumber);
              if (normalized && isValidNormalizedPhone(normalized)) {
                results.push(normalized);
              } else {
                invalidNumbers.push({
                  number: cleanNumber,
                  reason: "Invalid mobile format",
                });
              }

            } else {
              // If no valid phone found in row, add all values as potentially invalid
              Object.values(data).forEach(value => {
                if (value && value.toString().trim()) {
                  invalidNumbers.push({
                    number: value.toString().trim(),
                    reason: "Not a valid phone number"
                  });
                }
              });
            }
          })
          .on("end", resolve)
          .on("error", reject);
      });

      // Remove duplicates
      const uniqueNumbers = [...new Set(results)];
      const duplicatesRemoved = results.length - uniqueNumbers.length;

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        validNumbers: uniqueNumbers,
        invalidNumbers,
        summary: {
          totalParsed: results.length,
          valid: uniqueNumbers.length,
          invalid: invalidNumbers.length,
          duplicatesRemoved
        }
      });

    } catch (err) {
      console.error("❌ parseCsvRecipients error:", err);

      // Clean up file if it exists
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({ error: err.message });
    }
  }
];

/* =========================
   CREATE CAMPAIGN RECIPIENTS
========================= */
exports.createCampaignRecipients = async (req, res) => {
  try {
    const { campaignId, recipients, source } = req.body;

    if (!campaignId || !recipients || !source) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Verify campaign belongs to user
    const campaign = await Campaign.findOne({
      _id: campaignId,
      userId: req.userId
    });

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const recipientDocs = [];

    if (source === "group") {
      // Create recipients from groups
      for (const groupId of recipients) {
        const group = await ContactGroup.findOne({
          _id: groupId,
          userId: req.userId
        });

        if (group) {
          for (const contactId of group.contactIds) {
            const contact = await Contact.findById(contactId);
            if (contact) {
              recipientDocs.push({
                campaignId,
                name: contact.name,
                mobile: contact.mobile,
                source: "group",
                contactId: contact._id
              });
            }
          }
        }
      }
    } else if (source === "manual") {
      // Create recipients from manual input
      for (const recipient of recipients) {
        recipientDocs.push({
          campaignId,
          name: recipient.name,
          mobile: recipient.mobile,
          source: "manual"
        });
      }
    } else if (source === "csv") {
      // Create recipients from CSV
      for (const mobile of recipients) {
        recipientDocs.push({
          campaignId,
          mobile,
          source: "csv"
        });
      }
    }

    // Remove duplicates based on mobile number
    const uniqueRecipients = recipientDocs.filter((recipient, index, self) =>
      index === self.findIndex(r => r.mobile === recipient.mobile)
    );

    const createdRecipients = await CampaignRecipient.insertMany(uniqueRecipients);

    // Update campaign with recipient references
    campaign.campaignRecipients = createdRecipients.map(r => r._id);
    campaign.total = createdRecipients.length;
    await campaign.save();

    res.json({
      success: true,
      recipients: createdRecipients,
      count: createdRecipients.length
    });

  } catch (err) {
    console.error("❌ createCampaignRecipients error:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================
   GET CAMPAIGN RECIPIENTS
========================= */
exports.getCampaignRecipients = async (req, res) => {
  try {
    const { campaignId } = req.params;

    const campaign = await Campaign.findOne({
      _id: campaignId,
      userId: req.userId
    });

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const recipients = await CampaignRecipient.find({
      campaignId,
      userId: req.userId // 🔒 Scoping
    }).sort({ createdAt: 1 });

    res.json({
      success: true,
      recipients,
      summary: {
        total: recipients.length,
        pending: recipients.filter(r => r.status === "pending").length,
        sent: recipients.filter(r => r.status === "sent").length,
        delivered: recipients.filter(r => r.status === "delivered").length,
        read: recipients.filter(r => r.status === "read").length,
        failed: recipients.filter(r => r.status === "failed").length
      }
    });

  } catch (err) {
    console.error("❌ getCampaignRecipients error:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================
   UPDATE RECIPIENT STATUS
========================= */
exports.updateRecipientStatus = async (req, res) => {
  try {
    const { recipientId } = req.params;
    const { status, messageId, failureReason } = req.body;

    const recipient = await CampaignRecipient.findOne({
      _id: recipientId,
      campaignId: {
        $in: await Campaign.find({ userId: req.userId }).distinct("_id")
      }
    });

    if (!recipient) {
      return res.status(404).json({ error: "Recipient not found" });
    }

    recipient.status = status;

    if (messageId) recipient.messageId = messageId;
    if (failureReason) recipient.failureReason = failureReason;

    // Set timestamps based on status
    const now = new Date();
    switch (status) {
      case "sent":
        recipient.sentAt = now;
        break;
      case "delivered":
        recipient.deliveredAt = now;
        break;
      case "read":
        recipient.readAt = now;
        break;
      case "failed":
        recipient.failedAt = now;
        break;
    }

    await recipient.save();

    // Update campaign counts
    await updateCampaignCounts(recipient.campaignId);

    res.json({ success: true, recipient });

  } catch (err) {
    console.error("❌ updateRecipientStatus error:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================
   RECORD REPLY
========================= */
exports.recordReply = async (req, res) => {
  try {
    const { mobile, campaignId } = req.body;

    // Find recipient by mobile and campaign
    const recipient = await CampaignRecipient.findOne({
      mobile,
      campaignId
    });

    if (!recipient) {
      return res.status(404).json({ error: "Recipient not found" });
    }

    recipient.hasReplied = true;
    recipient.replyCount += 1;
    recipient.lastReplyAt = new Date();

    await recipient.save();

    // Update campaign reply count
    const campaign = await Campaign.findById(campaignId);
    if (campaign) {
      campaign.replyCount += 1;
      await campaign.save();
    }

    res.json({ success: true, recipient });

  } catch (err) {
    console.error("❌ recordReply error:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================
   HELPER: UPDATE CAMPAIGN COUNTS
========================= */
async function updateCampaignCounts(campaignId) {
  try {
    const recipients = await CampaignRecipient.find({ campaignId });

    const counts = {
      sent: recipients.filter(r => r.status === "sent").length,
      delivered: recipients.filter(r => r.status === "delivered").length,
      read: recipients.filter(r => r.status === "read").length,
      failed: recipients.filter(r => r.status === "failed").length
    };

    await Campaign.findOneAndUpdate({ _id: campaignId, userId: req.userId }, {
      sentCount: counts.sent,
      // You can add more count fields as needed
    });

  } catch (err) {
    console.error("❌ updateCampaignCounts error:", err);
  }
}

module.exports = {
  parseCsvRecipients: exports.parseCsvRecipients,
  createCampaignRecipients: exports.createCampaignRecipients,
  getCampaignRecipients: exports.getCampaignRecipients,
  updateRecipientStatus: exports.updateRecipientStatus,
  recordReply: exports.recordReply
};