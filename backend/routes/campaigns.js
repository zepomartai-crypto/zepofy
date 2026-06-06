const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const { checkLimits, checkPermission } = require("../middleware/resourceLimits.middleware.js");
const campaignController = require("../controllers/campaignController");

console.log("auth:", typeof auth);
console.log("createCampaign:", typeof campaignController.createCampaign);

router.use(auth);
router.use(checkPermission("campaigns"));

router.post("/", checkLimits("campaign"), campaignController.createCampaign);
router.put("/:id", campaignController.updateCampaign);
router.get("/:id", campaignController.getCampaignById);
router.get("/", campaignController.listCampaigns);
router.post("/:id/run", campaignController.runCampaignNow);
router.post("/:id/pause", campaignController.pauseCampaign);
router.post("/:id/resume", campaignController.resumeCampaign);
router.post("/:id/stop", campaignController.stopCampaign);
router.post("/:id/duplicate", campaignController.duplicateCampaign);
router.post("/:id/resend", campaignController.resendCampaign);
router.delete("/:id", campaignController.deleteCampaign);
router.get("/:id/analytics", campaignController.getCampaignAnalytics);
router.post("/:id/create-group-from-engagement", campaignController.createGroupFromEngagement);

module.exports = router;
