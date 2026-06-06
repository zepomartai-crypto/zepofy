const Campaign = require("../models/Campaign");
const CampaignRecipient = require("../models/CampaignRecipient");
const Contact = require("../models/Contact");
const Message = require("../models/Message");
const Template = require("../models/Template");
const whatsappService = require("./whatsappService");
const whatsappMediaService = require("./whatsappMediaService"); // ✅ ADDED for image upload
const { normalizePhone, validateForWhatsApp } = require("../utils/internationalPhoneNormalizer"); // ✅ RE-ENABLED for international support

exports.processCampaign = async (campaignId) => {
  const campaign = await Campaign.findById(campaignId);
  if (!campaign) return;

  console.log("🚀 Processing campaign:", campaign.name);

  // reset counts
  campaign.sentCount = 0;
  campaign.failedCount = 0;

  // 🔥 CRITICAL: Validate template structure
  if (!campaign.template?.metaTemplateName) {
    throw new Error(`Template name missing for campaign ${campaign.name}`);
  }

  if (!campaign.template?.language) {
    throw new Error(`Template language missing for campaign ${campaign.name}`);
  }

  // 🔥 CRITICAL: Validate phoneNumberId and auto-fix if null
  if (!campaign.phoneNumberId) {
    console.warn("⚠️ Campaign phoneNumberId is null, fetching from WhatsAppIntegration");
    const WhatsAppIntegration = require('../models/WhatsAppIntegration');
    const integration = await WhatsAppIntegration.findByUserIdWithToken(campaign.userId);

    if (integration && integration.phoneNumberId) {
      campaign.phoneNumberId = integration.phoneNumberId;
      console.log("✅ Auto-set phoneNumberId from integration:", campaign.phoneNumberId);
      // Save it to campaign for future use
      await campaign.save();
    } else {
      throw new Error(`No WhatsApp phone number found for user ${campaign.userId}. Please connect WhatsApp Business account.`);
    }
  }

  // 🔥 FETCH TEMPLATE TO CHECK HEADER TYPE
  const template = await Template.findOne({
    userId: campaign.userId,
    metaTemplateName: campaign.template.metaTemplateName,
    language: campaign.template.language
  });

  if (!template) {
    throw new Error(`Template not found: ${campaign.template.metaTemplateName} (${campaign.template.language})`);
  }

  const hasImageHeader = template.header?.type === 'image' || template.components?.find(c => c.type === 'HEADER')?.format === 'IMAGE';
  console.log("📋 Template has image header:", hasImageHeader);

  // 🔥 IMAGE HEADER LOGIC (including Overrides)
  let headerImageId = null;
  let headerImageUrl = null;

  // 🔍 DEBUG LOGGING: CHECK DB STATE
  console.log("🔍 CAMPAIGN DB DATA (Overrides):", {
    url: campaign.headerOverrideUrl,
    handle: campaign.headerOverrideHandle,
    raw: campaign.toObject ? campaign.toObject().headerOverrideUrl : 'N/A'
  });

  if (hasImageHeader) {
    // 1. Check for Manual Overrides from Campaign Creation
    const manualUrl = String(campaign.headerOverrideUrl || "").trim();
    const manualHandle = String(campaign.headerOverrideHandle || "").trim();

    if (manualHandle || manualUrl) {
      console.log("🎯 Using manual header override for campaign:", campaign.name);
      console.log("🔗 Override URL/ID:", manualHandle || manualUrl);
      headerImageId = manualHandle || manualUrl;
      headerImageUrl = manualUrl || null;
    }
    // 2. Fallback to Template's Default Image
    else {
      let mediaId = template.header?.mediaId || null;
      let uploadedAt = template.header?.uploadedAt ? new Date(template.header.uploadedAt) : null;

      // Check if mediaId is still valid (~25 days)
      const isCurrentlyValid = mediaId && uploadedAt && Date.now() - uploadedAt.getTime() < 25 * 24 * 60 * 60 * 1000;

      if (isCurrentlyValid) {
        headerImageId = mediaId;
        console.log("📎 Using template default mediaId:", headerImageId);
      } else {
        const isPublicUrl = String(template.header?.image).startsWith('http');
        if (isPublicUrl) {
          headerImageId = null;
          headerImageUrl = template.header.image;
          console.log("🌐 Using template default public URL:", headerImageUrl);
        } else {
          // Need to upload image to Meta from local path
          if (!template.header?.image || typeof template.header.image !== "string") {
            console.warn(`Template "${template.metaTemplateName}" has image header but no local image path. Skipping header.`);
          } else {
            const path = require("path");
            const fs = require("fs");
            const localImagePath = path.join(process.cwd(), template.header.image.replace(/^\/+/, ""));

            if (fs.existsSync(localImagePath)) {
              console.log("🖼️ Uploading template image to Meta for campaign:", localImagePath);
              const metaMediaService = require("./metaMediaService");
              headerImageId = await metaMediaService.uploadImageForMessage(campaign.userId, localImagePath);

              // Update template with new mediaId
              template.header.mediaId = headerImageId;
              template.header.uploadedAt = new Date();
              await template.save();
            }
          }
        }
      }
    }

    // Ensure we have a URL for database storage if not provided by override
    if (!headerImageUrl && template.header?.image) {
      const baseUrl = process.env.BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      headerImageUrl = baseUrl + template.header.image;
    }
  }

  // CRITICAL: Save message to database after sending
  async function saveMessageToDatabase(messageData) {
    try {
      const Message = require('../models/Message');
      const Conversation = require('../models/Conversation');
      const Contact = require('../models/Contact');
      const conversationService = require('./conversation.service');

      let conversationId = null;

      // Ensure customerId is present by finding/creating contact if needed
      let customerId = messageData.customerId;
      if (!customerId && messageData.phone) {
        let contact = await Contact.findOne({ userId: messageData.userId, phone: messageData.phone });
        if (!contact) {
          contact = await Contact.create({
            userId: messageData.userId,
            phone: messageData.phone,
            name: messageData.name || "Customer",
            source: "campaign"
          });
        } else if (messageData.name && (contact.name === "Customer" || !isNaN(contact.name) || contact.name === contact.phone)) {
          // Sync name if it was generic or numeric/phone-only before
          console.log(`👤 Syncing name for ${contact.phone}: ${contact.name} -> ${messageData.name}`);
          contact.name = messageData.name;
          await contact.save();
        }
        customerId = contact._id;
      }

      if (customerId) {
        // Use centralized service for robust conversation management
        const contact = await Contact.findById(customerId);

        // 🔥 UPDATE CONTACT FOR CAMPAIGN FILTERING
        if (messageData.isCampaign && messageData.campaignId) {
          contact.lastCampaignId = messageData.campaignId;
          contact.campaignReplied = false; // Reset for the new campaign
          await contact.save();
        }

        const conversation = await conversationService.getOrCreateConversation(contact);
        conversationId = conversation._id;

        // Mark as outbound in conversation history
        await conversationService.markOutbound({
          conversationId,
          metaMessageId: messageData.metaMessageId,
          templateName: messageData.templateName
        });
      }

      const message = new Message({
        ...messageData,
        customerId,
        conversationId,
        createdAt: new Date()
      });

      await message.save();
      console.log('✅ Campaign message saved and conversation updated:', {
        id: message._id,
        phone: message.phone,
        metaMessageId: message.metaMessageId
      });

      return message;

    } catch (error) {
      console.error('❌ Save message error:', error);
      throw error;
    }
  }

  // ===== RECIPIENT FETCHING =====
  let recipients = await CampaignRecipient.find({ campaignId, status: "pending" });

  // If no pending recipients, fetch and populate from source
  if (!recipients.length) {
    console.log("📋 No pending recipients found, fetching from source...");

    const recipientData = [];

    // 1. Fetch from Selected Groups (if any)
    if (campaign.groupIds && campaign.groupIds.length > 0) {
      console.log(`📋 Fetching recipients from ${campaign.groupIds.length} groups...`);
      const ContactGroup = require("../models/ContactGroup");
      const groups = await ContactGroup.find({ _id: { $in: campaign.groupIds } });
      const contactIds = groups.flatMap(g => g.contactIds || []);
      const contacts = await Contact.find({ _id: { $in: contactIds } });

      recipientData.push(...contacts.map(c => {
        const normalizedResult = normalizePhone(c.phone);
        return {
          campaignId: campaign._id,
          userId: campaign.userId,
          phone: normalizedResult.success ? normalizedResult.phoneNumber : String(c.phone || "").replace(/\D/g, ""),
          name: c.name,
          status: "pending",
          source: "group"
        };
      }));
    }

    // 1.5. Fetch from Individual Contacts (if any)
    if (campaign.contactIds && campaign.contactIds.length > 0) {
      console.log(`📋 Fetching recipients from ${campaign.contactIds.length} individual contacts...`);
      const contacts = await Contact.find({ _id: { $in: campaign.contactIds } });
      recipientData.push(...contacts.map(c => {
        const normalizedResult = normalizePhone(c.phone);
        return {
          campaignId: campaign._id,
          userId: campaign.userId,
          phone: normalizedResult.success ? normalizedResult.phoneNumber : String(c.phone || "").replace(/\D/g, ""),
          name: c.name,
          status: "pending",
          source: "contacts"
        };
      }));
    }

    // 2. Fetch from Manual/CSV Numbers (if any)
    const CampaignNumber = require("../models/CampaignNumber");
    const numbers = await CampaignNumber.find({ campaignId: campaign._id });
    if (numbers.length > 0) {
      console.log(`📋 Fetching ${numbers.length} manual/CSV recipients...`);
      recipientData.push(...numbers.map(n => {
        const normalizedResult = normalizePhone(n.phone);
        return {
          campaignId: campaign._id,
          userId: campaign.userId,
          phone: normalizedResult.success ? normalizedResult.phoneNumber : String(n.phone || "").replace(/\D/g, ""),
          name: n.name,
          status: "pending",
          source: n.source || (campaign.recipientSource === "importCsv" ? "csv" : "manual")
        };
      }));
    }

    // Insert into CampaignRecipient
    if (recipientData.length) {
      await CampaignRecipient.insertMany(recipientData);
      // Re-fetch as Mongoose documents to enable .save()
      recipients = await CampaignRecipient.find({ campaignId: campaign._id, status: "pending" });
      campaign.total = recipientData.length;
      await campaign.save();
    }
  }

  console.log(`📋 Found ${recipients.length} recipients to process`);

  if (!recipients.length) {
    console.error("❌ No recipients found for campaign:", campaign.name);
    campaign.status = "failed";
    await campaign.save();
    return;
  }

  for (const r of recipients) {
    try {
      // 🔥 CRITICAL: Check campaign status before each send
      const currentCampaign = await Campaign.findById(campaignId);
      if (!currentCampaign || currentCampaign.status !== "running") {
        console.log("⏸️ Campaign status changed during processing");
        return;
      }

      // 🔥 CRITICAL: Use global phone normalization
      const { normalizePhone: globalNormalize } = require("../utils/phoneNormalizer");
      const cleanPhone = globalNormalize(r.phone);
      if (!cleanPhone) {
        throw new Error(`Invalid phone number: ${r.phone}`);
      }

      const blockedContact = await Contact.findOne({ userId: campaign.userId, phone: cleanPhone });
      if (blockedContact && blockedContact.isBlocked) {
        r.status = "failed";
        r.failureReason = "Contact is blocked";
        r.failedAt = new Date();
        await r.save();
        campaign.failedCount++;
        await Campaign.findByIdAndUpdate(campaign._id, { $inc: { failedCount: 1 } });
        console.log(`🚫 Skipped blocked contact ${cleanPhone}`);
        continue;
      }

      // ===== VARIABLE MAPPING =====
      let bodyText = template?.body || campaign.template?.body || "";
      if (!bodyText && template?.components) {
        const bodyComp = template.components.find(c => c.type === "BODY");
        if (bodyComp) bodyText = bodyComp.text || "";
      }

      const variablesCount = (bodyText.match(/{{\s*(\d+)\s*}}/g) || []).length;

      const sourceVars = campaign.template?.variableTypes || template?.variableTypes || [];
      const legacyVars = campaign.template?.variables || [];

      let flatVariables = []; // For local DB substitution

      if (variablesCount > 0) {
        for (let i = 0; i < variablesCount; i++) {
          let paramValue = " ";

          if (sourceVars[i]) {
            const vt = sourceVars[i];
            if (vt.type === "dynamic") {
              if (vt.value === "name") paramValue = (r.name && r.name.trim()) ? r.name : "Customer";
              else if (vt.value === "phone") paramValue = r.phone || " ";
              else if (vt.value === "firstName") paramValue = (r.name) ? r.name.split(' ')[0] : "Customer";
            } else {
              paramValue = vt.value || " ";
            }
          } else if (legacyVars[i]) {
            const v = legacyVars[i];
            if (v === "name") paramValue = (r.name && r.name.trim()) ? r.name : "Customer";
            else if (v === "phone") paramValue = r.phone || " ";
            else paramValue = String(v || " ");
          }

          if (!paramValue || String(paramValue).trim() === "") paramValue = " ";
          const finalVal = String(paramValue).substring(0, 1024);
          flatVariables.push(finalVal);
        }
      }

      console.log("🔥 VARIABLES FOR RECIPIENT:", r.phone, "=>", flatVariables);

      // ===== SEND TEMPLATE =====
      const waRes = await whatsappService.sendTemplateMessage({
        userId: campaign.userId,
        to: cleanPhone,
        templateName: campaign.template.metaTemplateName,
        language: campaign.template.language,
        bodyParams: flatVariables,
        metaImageHandle: hasImageHeader ? headerImageId : null
      });

      // 🔥 CRITICAL: Save message to database after successful send
      if (waRes.success) {
        console.log('🔥 Campaign: WhatsApp send successful, saving message to database...');

        let mediaUrl = null;
        if (hasImageHeader && headerImageId) {
          mediaUrl = `https://graph.facebook.com/v18.0/${campaign.userId}/media/${headerImageId}`;
        }

        const metaMessageId = waRes?.metaMessageId || waRes?.messages?.[0]?.id;

        // Resolve body text for DB storage
        let resolvedBody = bodyText;
        if (resolvedBody) {
          flatVariables.forEach((v, i) => {
            // Support both {{1}} and {{ 1 }}
            resolvedBody = resolvedBody.replace(new RegExp(`{{\\s*${i + 1}\\s*}}`, "g"), String(v));
          });
        }

        // UNIFIED LOGGING: Find/Create contact and log single message
        try {
          const contact = await Contact.findOne({
            userId: campaign.userId,
            phone: cleanPhone
          });

          await saveMessageToDatabase({
            customerId: contact ? contact._id : null,
            userId: campaign.userId,
            campaignId: campaign._id,
            phone: cleanPhone,
            name: r.name, // 🔥 PASS NAME FOR SYNC
            sender: "user",
            direction: "outgoing",
            type: "template",
            templateName: campaign.template.metaTemplateName,
            bodyText: resolvedBody,
            mediaType: hasImageHeader ? "image" : null,
            mediaUrl: headerImageUrl || mediaUrl, // Use override URL if exists
            targetType: "campaign",
            isCampaign: true,
            template: {
              name: campaign.template.name,
              language: campaign.template.language,
              components: campaign.template.components
            },
            text: resolvedBody,
            body: resolvedBody,
            header: campaign.template.header?.type === "text" ? campaign.template.header.text : null,
            footer: campaign.template.footer?.text || null,
            image: headerImageUrl || (campaign.template.header?.type === "image" ? campaign.template.header.image : null),
            headerImage: headerImageUrl || (campaign.template.header?.type === "image" ? campaign.template.header.image : null),
            buttons: campaign.template.buttons || [],
            metaMessageId,
            waTimestamp: Math.floor(Date.now() / 1000),
            sentAt: new Date()
          });
          console.log(`✅ Post-send database logging successful for ${cleanPhone}`);
        } catch (postSendError) {
          console.error(`⚠️ Post-send logging failed for ${cleanPhone}, but message was SENT:`, postSendError.message);
          // We continue because the message WAS actually sent to WhatsApp
        }

        // Update Recipient tracking
        console.log(`📝 Updating Recipient Status in DB for ID: ${r._id}`);
        r.status = "sent";
        r.sentAt = new Date();
        r.messageId = metaMessageId;
        await r.save();

        campaign.sentCount++;
        // ✅ ATOMIC UPDATE TO CAMPAIGN (Real-time count fix)
        await Campaign.findByIdAndUpdate(campaign._id, { $inc: { sentCount: 1 } });
        console.log(`✅ Message sent successfully to ${r.phone}. Current Sent count: ${campaign.sentCount}`);
      } else {
        console.error(`❌ WhatsApp Service returned success=false for ${cleanPhone}:`, waRes.error);
        throw new Error(waRes.error || "Unknown WhatsApp API error");
      }

    } catch (err) {
      console.error("❌ Send failed:", err.message);

      // 🔥 CRITICAL: Check if this is a WhatsApp API acceptance (success for image templates)
      if (err.message.includes("accepted") || err.message.includes("Message accepted")) {
        // Treat acceptance as success
        r.status = "sent";
        r.sentAt = new Date();
        await r.save();
        campaign.sentCount++;
        await Campaign.findByIdAndUpdate(campaign._id, { $inc: { sentCount: 1 } });
        console.log(`✅ Message accepted by WhatsApp for ${r.phone}. Sent count: ${campaign.sentCount}`);
      } else if (err.message.includes("WhatsApp API") || err.message.includes("metaSendService")) {
        // Mark as failed only for actual WhatsApp API errors
        r.status = "failed";
        r.failedAt = new Date();
        r.failureReason = err.message;
        await r.save();
        campaign.failedCount++;
        await Campaign.findByIdAndUpdate(campaign._id, { $inc: { failedCount: 1 } });
        console.log(`❌ WhatsApp API failed for ${r.phone}. Failed count: ${campaign.failedCount}`);
      } else {
        // For non-API errors
        console.error(`⚠️ Non-API error for ${r.phone}:`, err.message);
        r.status = "failed";
        r.failedAt = new Date();
        r.failureReason = err.message;
        await r.save();
        campaign.failedCount++;
        await Campaign.findByIdAndUpdate(campaign._id, { $inc: { failedCount: 1 } });
      }
    }
  }

  // ===== FINAL STATUS =====
  // 🔥 CRITICAL: Use atomic update to prevent race conditions
  const finalCampaign = await Campaign.findById(campaignId);
  if (finalCampaign && finalCampaign.status !== "running") {
    console.log("⏸️ Campaign status changed during processing (e.g., paused)");
    // Ensure final counts are synced even on early exit
    await Campaign.findByIdAndUpdate(campaignId, {
      sentCount: campaign.sentCount,
      failedCount: campaign.failedCount,
      lastRunAt: new Date()
    });
    return;
  }

  // 🔥 CRITICAL: Final status decision logic
  let finalStatus;
  if (campaign.sentCount > 0) {
    finalStatus = "completed"; // ✅ At least one message sent successfully
  } else {
    finalStatus = "failed"; // Only failed if no messages sent
  }

  console.log(`🎯 FINAL STATUS DECISION:`);
  console.log(`  - Total sent: ${campaign.sentCount}`);
  console.log(`  - Total failed: ${campaign.failedCount}`);
  console.log(`  - Final status: ${finalStatus}`);

  // 🔥 CRITICAL: Atomic update with all fields
  await Campaign.findByIdAndUpdate(campaignId, {
    status: finalStatus,
    sentCount: campaign.sentCount,
    failedCount: campaign.failedCount,
    completedAt: new Date(),
    lastRunAt: new Date()
  }, { new: true });

  console.log(
    `✅ Campaign completed: status=${finalStatus}, sent=${campaign.sentCount}, failed=${campaign.failedCount}`
  );
};
