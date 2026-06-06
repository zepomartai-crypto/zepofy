const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  getOverview,
  getIntegrationStatus,
  getMessagesChart,
  getCampaignPerformance,
  getQualityScore,
  dashboardSummary,
  getAnalytics,
  getRecentActivity
} = require("../controllers/dashboardController");

// ✅ NEW ENHANCED ENDPOINTS
router.get("/overview", auth, getOverview);
router.get("/integration", auth, getIntegrationStatus);
router.get("/messages-chart", auth, getMessagesChart);
router.get("/campaign-performance", auth, getCampaignPerformance);
router.get("/quality-score", auth, getQualityScore);
router.get("/analytics", auth, getAnalytics);
router.get("/recent-activity", auth, getRecentActivity);

// ✅ LEGACY ENDPOINT (for backward compatibility)
router.get("/summary", auth, dashboardSummary);

module.exports = router;
