const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const campaignRecipientController = require("../controllers/campaignRecipientController");

// CSV parsing route
router.post("/parse-csv", auth, campaignRecipientController.parseCsvRecipients);

// Campaign recipients management
router.post("/", auth, campaignRecipientController.createCampaignRecipients);
router.get("/:campaignId", auth, campaignRecipientController.getCampaignRecipients);
router.put("/:recipientId/status", auth, campaignRecipientController.updateRecipientStatus);
router.post("/reply", auth, campaignRecipientController.recordReply);

module.exports = router;