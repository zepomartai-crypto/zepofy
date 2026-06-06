// routes/campaignNumbers.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");
const campaignNumberController = require("../controllers/campaignNumberController");

// All routes require authentication
router.use(auth);

// Add single number to campaign
router.post("/:campaignId/numbers", campaignNumberController.addCampaignNumber);

// Import numbers from CSV
router.post("/:campaignId/import-csv", upload.csvUpload.single('csv'), campaignNumberController.importCampaignNumbers);

// List campaign numbers
router.get("/:campaignId/numbers", campaignNumberController.listCampaignNumbers);

// Remove number from campaign
router.delete("/:campaignId/numbers/:numberId", campaignNumberController.removeCampaignNumber);

// Clear all manual/csv recipients
router.delete("/:campaignId/clear-all", campaignNumberController.clearCampaignNumbers);

module.exports = router;