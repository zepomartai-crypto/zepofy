// whatsapp-webhook/services/scheduler.js
const Campaign = require("../models/Campaign");
const sendService = require("./sendService");

async function checkAndRunScheduled() {
  const now = new Date();
  const toRun = await Campaign.find({ status: "scheduled", scheduledAt: { $lte: now } });
  for (const c of toRun) {
    try {
      c.status = "running";
      await c.save();
      sendService.processCampaign(campaign._id).catch(err => console.error("processCampaign", err));
    } catch (err) {
      console.error("schedule run error", err);
    }
  }
}

module.exports = { checkAndRunScheduled };
