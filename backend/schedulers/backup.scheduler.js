const cron = require("node-cron");
const backupService = require("../services/backblazeService");

/**
 * Initializes the automated daily backup scheduler
 */
const initBackupScheduler = () => {
  console.log("⏰ Initializing Automated Daily System Backup Scheduler...");

  // Run every day at midnight (00:00) -> 0 0 * * *
  // To verify or test on server, can be adjusted. We will use standard midnight schedule.
  cron.schedule("0 0 * * *", async () => {
    console.log("⏰ Daily Midnight Cron: Triggering automated system backup...");
    try {
      const result = await backupService.performSystemBackup();
      if (result.success) {
        console.log("⏰ Daily Midnight Cron: System backup completed successfully!", result);
      } else {
        console.error("❌ Daily Midnight Cron: System backup failed!", result.error);
      }
    } catch (error) {
      console.error("❌ Daily Midnight Cron: Unhandled error during automated system backup:", error);
    }
  });

  console.log("⏰ Automated Daily System Backup Scheduler registered successfully! (Runs daily at 00:00)");
};

module.exports = {
  initBackupScheduler,
};
