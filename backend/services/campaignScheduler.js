const cron = require("node-cron");
const Campaign = require("../models/Campaign");
const CampaignRecipient = require("../models/CampaignRecipient");
const { processCampaign } = require("./processCampaign");

/**
 * Singleton flag so scheduler starts only once
 */
let schedulerStarted = false;
let isRunningTask = false;

/**
 * Start Campaign Scheduler
 * - Will run every 10 minutes
 * - Will process ONLY due scheduled campaigns
 */
function startCampaignScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  cron.schedule("* * * * *", async () => {
    if (isRunningTask) return;
    isRunningTask = true;
    try {
      const now = new Date();

      // Find campaigns that are due
      const campaigns = await Campaign.find({
        status: "scheduled",
        scheduledAt: { $lte: now },
      });

      // 🔕 IMPORTANT: No logs if nothing to do
      if (!campaigns.length) return;

      console.log(`📅 Found ${campaigns.length} scheduled campaign(s) to process`);

      for (const campaign of campaigns) {
        console.log("⏳ Processing campaign:", campaign.name, campaign._id);

        // Atomic lock: scheduled ➜ running
        const lockedCampaign = await Campaign.findOneAndUpdate(
          { _id: campaign._id, status: "scheduled" },
          {
            $set: {
              status: "running",
              startedAt: new Date(),
              sentCount: 0,
              failedCount: 0
            }
          },
          { new: true }
        );

        // If already picked by another worker
        if (!lockedCampaign) {
          continue;
        }

        try {
          // Reset recipients (fresh run)
          await CampaignRecipient.deleteMany({
            campaignId: campaign._id,
          });

          await processCampaign(campaign._id);

          console.log("✅ Campaign processing call completed:", campaign.name);
        } catch (err) {
          console.error("❌ Campaign failed:", campaign.name, err);

          await Campaign.findByIdAndUpdate(campaign._id, {
            status: "failed",
            failedAt: new Date(),
            errorMessage: err.message,
          });
        }
      }
    } catch (err) {
      console.error("❌ Scheduler internal error:", err);
    } finally {
      isRunningTask = false;
    }
  });

  console.log("🚀 Campaign scheduler started");
}

module.exports = {
  startCampaignScheduler,
};
