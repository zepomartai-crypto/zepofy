const Campaign = require("../models/Campaign");
const CampaignRecipient = require("../models/CampaignRecipient");
const whatsappService = require("./whatsappService");
const Template = require("../models/Template");

exports.sendTemplateBroadcast = async (campaignId) => {
  const campaign = await Campaign.findById(campaignId).populate("campaignRecipients");
  if (!campaign) return;

  console.log("🚀 Campaign:", campaign.name);

  // RESET COUNTS
  campaign.sentCount = 0;
  campaign.failedCount = 0;

  // 🔥 FETCH TEMPLATE TO CHECK HEADER TYPE
  const template = await Template.findOne({
    userId: campaign.userId,
    metaTemplateName: campaign.template.metaTemplateName,
    language: campaign.template.language
  });

  if (!template) {
    throw new Error(`Template not found: ${campaign.template.metaTemplateName} (${campaign.template.language})`);
  }

  const hasImageHeader = template.header?.type === 'image';
  console.log("📋 Template has image header:", hasImageHeader);

  // Get all campaign recipients
  const recipients = await CampaignRecipient.find({
    campaignId,
    status: "pending"
  });

  for (const recipient of recipients) {
    try {
      if (!campaign.templateId) {
        throw new Error("Template ID missing");
      }

      if (!recipient.mobile) {
        throw new Error("Phone missing");
      }

      // Send template message
      const result = await whatsappService.sendTemplateMessage({
        userId: campaign.userId,
        to: recipient.mobile,
        templateName: campaign.template.metaTemplateName,
        language: campaign.template.language,
        bodyParams: recipient.templateVariables || [],
        metaImageHandle: hasImageHeader ? null : (campaign.template.headerImageId || null)
      });

      // Update recipient status
      recipient.status = "sent";
      recipient.sentAt = new Date();
      recipient.messageId = result?.messages?.[0]?.id;
      await recipient.save();

      campaign.sentCount++;

    } catch (err) {
      console.error(`Failed to send to ${recipient.mobile}:`, err);

      recipient.status = "failed";
      recipient.failedAt = new Date();
      recipient.failureReason = err.message;
      await recipient.save();

      campaign.failedCount++;
    }
  }

  campaign.status = "completed";
  await campaign.save();

  console.log(
    `✅ Sent: ${campaign.sentCount}, Failed: ${campaign.failedCount}`
  );
};
