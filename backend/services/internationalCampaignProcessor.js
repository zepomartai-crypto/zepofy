// services/internationalCampaignProcessor.js

const Campaign = require("../models/Campaign");
const CampaignRecipient = require("../models/CampaignRecipient");
const { normalizePhone, validateForWhatsApp } = require("../utils/internationalPhoneNormalizer");
const whatsappService = require("./whatsappService");

/**
 * International Campaign Processor
 * Handles WhatsApp campaigns for all countries with proper phone number normalization
 */
class InternationalCampaignProcessor {
  constructor() {
    this.processingCampaigns = new Map(); // Track active campaigns
    this.rateLimits = new Map(); // Per-country rate limiting
  }

  /**
   * Start processing an international campaign
   * @param {string} campaignId - Campaign ID
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - Processing result
   */
  async startCampaign(campaignId, options = {}) {
    try {
      // Get campaign details
      const campaign = await Campaign.findById(campaignId)
        .populate('campaignRecipients');

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Check if campaign is already running
      if (this.processingCampaigns.has(campaignId)) {
        throw new Error('Campaign is already running');
      }

      // Update campaign status
      campaign.status = 'running';
      campaign.startedAt = new Date();
      await campaign.save();

      // Initialize processing state
      const processingState = {
        campaignId,
        total: campaign.campaignRecipients.length,
        processed: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        countryStats: {},
        startTime: new Date(),
        isRunning: true,
        options: {
          batchSize: options.batchSize || 10,
          delayBetweenBatches: options.delayBetweenBatches || 1000,
          retryFailed: options.retryFailed || false,
          maxRetries: options.maxRetries || 3,
          ...options
        }
      };

      this.processingCampaigns.set(campaignId, processingState);

      console.log(`🚀 Starting international campaign: ${campaign.name} (${processingState.total} recipients)`);

      // Start processing in background
      this.processCampaignBatch(campaignId).catch(err => {
        console.error(`❌ Campaign processing error: ${err.message}`);
        this.stopCampaign(campaignId, 'error', err.message);
      });

      return {
        success: true,
        campaignId,
        total: processingState.total,
        status: 'started'
      };

    } catch (error) {
      console.error(`❌ startCampaign error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process campaign recipients in batches
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<void>}
   */
  async processCampaignBatch(campaignId) {
    const state = this.processingCampaigns.get(campaignId);
    if (!state || !state.isRunning) return;

    try {
      const campaign = await Campaign.findById(campaignId);

      // Get next batch of recipients
      const recipients = await CampaignRecipient.find({
        campaignId,
        status: { $in: ['pending'] }
      })
        .limit(state.options.batchSize)
        .sort({ createdAt: 1 });

      if (recipients.length === 0) {
        // Campaign completed
        await this.completeCampaign(campaignId);
        return;
      }

      console.log(`📊 Processing batch of ${recipients.length} recipients for campaign ${campaignId}`);

      // Process each recipient in the batch
      const batchPromises = recipients.map(recipient =>
        this.processRecipient(recipient, campaign, state)
      );

      const results = await Promise.allSettled(batchPromises);

      // Update batch statistics
      results.forEach((result, index) => {
        const recipient = recipients[index];
        if (result.status === 'fulfilled') {
          state.processed++;
          if (result.value.sent) {
            state.sent++;
          } else if (result.value.failed) {
            state.failed++;
          } else if (result.value.skipped) {
            state.skipped++;
          }
        } else {
          console.error(`❌ Recipient processing failed: ${result.reason}`);
          state.failed++;
          this.updateRecipientStatus(recipient._id, 'failed', result.reason.message);
        }
      });

      // Update campaign progress
      campaign.sentCount = state.sent;
      campaign.failedCount = state.failed;
      await campaign.save();

      // Update country statistics
      await this.updateCountryStats(campaignId, recipients, results);

      // Continue processing next batch
      if (state.isRunning) {
        setTimeout(() => {
          this.processCampaignBatch(campaignId);
        }, state.options.delayBetweenBatches);
      }

    } catch (error) {
      console.error(`❌ Batch processing error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process individual recipient
   * @param {Object} recipient - Campaign recipient document
   * @param {Object} campaign - Campaign document
   * @param {Object} state - Processing state
   * @returns {Promise<Object>} - Processing result
   */
  async processRecipient(recipient, campaign, state) {
    try {
      // Validate phone number for WhatsApp
      const validation = validateForWhatsApp(recipient.phone);

      if (!validation.valid) {
        console.log(`⚠️ Skipping invalid WhatsApp number: ${recipient.phone} (${validation.reason})`);
        await this.updateRecipientStatus(recipient._id, 'skipped', validation.reason);
        return { skipped: true, reason: validation.reason };
      }

      // Check rate limiting for country
      const countryCode = recipient.countryCode || 'Unknown';
      if (!this.checkRateLimit(countryCode)) {
        console.log(`⏳ Rate limit reached for ${countryCode}, skipping batch`);
        return { skipped: true, reason: 'Rate limit reached' };
      }

      // Prepare WhatsApp message payload
      const messagePayload = this.prepareWhatsAppMessage(recipient, campaign);

      // Send message via whatsappService using pre-built components or letting it auto-build
      const sendResult = await whatsappService.sendTemplateMessage({
        userId: campaign.userId,
        to: recipient.phone,
        templateName: campaign.template.metaTemplateName,
        language: campaign.template.language,
        components: messagePayload.template?.components || []
      });

      if (sendResult.success) {
        console.log(`✅ Message sent to ${recipient.phone} (${recipient.countryName})`);
        await this.updateRecipientStatus(
          recipient._id,
          'sent',
          null,
          sendResult.messageId
        );

        // Update country stats
        if (!state.countryStats[countryCode]) {
          state.countryStats[countryCode] = { sent: 0, failed: 0, skipped: 0 };
        }
        state.countryStats[countryCode].sent++;

        return { sent: true, messageId: sendResult.messageId };

      } else {
        const errMsg = sendResult.error || "Unknown send error";
        console.error(`❌ Failed to send to ${recipient.phone}: ${errMsg}`);
        await this.updateRecipientStatus(
          recipient._id,
          'failed',
          errMsg
        );

        // Update country stats
        if (!state.countryStats[countryCode]) {
          state.countryStats[countryCode] = { sent: 0, failed: 0, skipped: 0 };
        }
        state.countryStats[countryCode].failed++;

        return { failed: true, error: errMsg };
      }

    } catch (error) {
      console.error(`❌ Recipient processing error: ${error.message}`);
      await this.updateRecipientStatus(recipient._id, 'failed', error.message);
      return { failed: true, error: error.message };
    }
  }

  /**
   * Prepare WhatsApp message payload
   * @param {Object} recipient - Recipient document
   * @param {Object} campaign - Campaign document
   * @returns {Object} - WhatsApp message payload
   */
  prepareWhatsAppMessage(recipient, campaign) {
    const payload = {
      type: "template",
      template: {
        name: campaign.template.metaTemplateName,
        language: { code: campaign.template.language }
      }
    };

    // Add components if present
    if (campaign.template.headerImageId) {
      payload.template.components = payload.template.components || [];
      payload.template.components.push({
        type: "header",
        parameters: [{
          type: "image",
          image: { id: campaign.template.headerImageId }
        }]
      });
    }

    // Add body variables if present
    if (campaign.template.variables && campaign.template.variables.length > 0) {
      payload.template.components = payload.template.components || [];

      const bodyComponent = {
        type: "body",
        parameters: []
      };

      campaign.template.variables.forEach((variable, index) => {
        // Replace dynamic variables with actual data
        let value = variable;
        if (variable === "{{name}}" && recipient.name) {
          value = recipient.name;
        } else if (variable === "{{phone}}" && recipient.phone) {
          value = recipient.phone;
        } else if (variable.startsWith("{{") && variable.endsWith("}}")) {
          // Handle other dynamic variables
          const fieldName = variable.replace(/[{}]/g, "");
          value = recipient.metadata?.originalData?.[fieldName] || variable;
        }

        bodyComponent.parameters.push({
          type: "text",
          text: value
        });
      });

      payload.template.components.push(bodyComponent);
    }

    return payload;
  }

  /**
   * Check rate limiting for country
   * @param {string} countryCode - Country code
   * @returns {boolean} - True if under rate limit
   */
  checkRateLimit(countryCode) {
    const now = Date.now();
    const windowMs = 60000; // 1 minute window
    const maxRequestsPerMinute = 1000; // Adjust based on WhatsApp limits

    if (!this.rateLimits.has(countryCode)) {
      this.rateLimits.set(countryCode, []);
    }

    const requests = this.rateLimits.get(countryCode);

    // Remove old requests outside the window
    const validRequests = requests.filter(timestamp => now - timestamp < windowMs);
    this.rateLimits.set(countryCode, validRequests);

    return validRequests.length < maxRequestsPerMinute;
  }

  /**
   * Update recipient status
   * @param {string} recipientId - Recipient ID
   * @param {string} status - New status
   * @param {string} failureReason - Failure reason (if applicable)
   * @param {string} messageId - WhatsApp message ID (if applicable)
   * @returns {Promise<void>}
   */
  async updateRecipientStatus(recipientId, status, failureReason = null, messageId = null) {
    const updateData = {
      status,
      updatedAt: new Date()
    };

    if (failureReason) {
      updateData.failureReason = failureReason;
      updateData.failedAt = new Date();
    }

    if (messageId) {
      updateData.messageId = messageId;
      updateData.sentAt = new Date();
    }

    await CampaignRecipient.findByIdAndUpdate(recipientId, updateData);
  }

  /**
   * Update country statistics
   * @param {string} campaignId - Campaign ID
   * @param {Array} recipients - Processed recipients
   * @param {Array} results - Processing results
   * @returns {Promise<void>}
   */
  async updateCountryStats(campaignId, recipients, results) {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) return;

    // Update country stats based on results
    recipients.forEach((recipient, index) => {
      const result = results[index];
      const countryCode = recipient.countryCode || 'Unknown';
      const countryName = recipient.countryName || 'Unknown';

      let countryStat = campaign.countryStats.find(stat => stat.countryCode === countryCode);
      if (!countryStat) {
        countryStat = {
          countryCode,
          countryName,
          total: 0,
          sent: 0,
          failed: 0,
          delivered: 0,
          read: 0,
          replied: 0
        };
        campaign.countryStats.push(countryStat);
      }

      if (result.status === 'fulfilled') {
        if (result.value.sent) {
          countryStat.sent++;
        } else if (result.value.failed) {
          countryStat.failed++;
        }
      } else {
        countryStat.failed++;
      }
    });

    await campaign.save();
  }

  /**
   * Complete campaign processing
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<void>}
   */
  async completeCampaign(campaignId) {
    const state = this.processingCampaigns.get(campaignId);
    if (!state) return;

    try {
      const campaign = await Campaign.findById(campaignId);
      if (campaign) {
        campaign.status = 'completed';
        campaign.completedAt = new Date();
        campaign.sentCount = state.sent;
        campaign.failedCount = state.failed;
        await campaign.save();
      }

      console.log(`🎉 Campaign completed: ${campaignId}`);
      console.log(`📊 Final stats: ${state.sent} sent, ${state.failed} failed, ${state.skipped} skipped`);

    } catch (error) {
      console.error(`❌ Error completing campaign: ${error.message}`);
    } finally {
      this.processingCampaigns.delete(campaignId);
    }
  }

  /**
   * Stop campaign processing
   * @param {string} campaignId - Campaign ID
   * @param {string} reason - Stop reason
   * @param {string} error - Error message (if applicable)
   * @returns {Promise<void>}
   */
  async stopCampaign(campaignId, reason = 'manual', error = null) {
    const state = this.processingCampaigns.get(campaignId);
    if (!state) return;

    state.isRunning = false;

    try {
      const campaign = await Campaign.findById(campaignId);
      if (campaign) {
        campaign.status = reason === 'error' ? 'failed' : 'stopped';
        campaign.stoppedAt = new Date();
        campaign.stopReason = reason;
        if (error) campaign.stopReason = `${reason}: ${error}`;
        campaign.sentCount = state.sent;
        campaign.failedCount = state.failed;
        await campaign.save();
      }

      console.log(`⏹️ Campaign stopped: ${campaignId} (${reason})`);

    } catch (err) {
      console.error(`❌ Error stopping campaign: ${err.message}`);
    } finally {
      this.processingCampaigns.delete(campaignId);
    }
  }

  /**
   * Get campaign processing status
   * @param {string} campaignId - Campaign ID
   * @returns {Object|null} - Processing status
   */
  getCampaignStatus(campaignId) {
    const state = this.processingCampaigns.get(campaignId);
    if (!state) return null;

    return {
      campaignId: state.campaignId,
      total: state.total,
      processed: state.processed,
      sent: state.sent,
      failed: state.failed,
      skipped: state.skipped,
      progress: Math.round((state.processed / state.total) * 100),
      isRunning: state.isRunning,
      startTime: state.startTime,
      countryStats: state.countryStats,
      estimatedCompletion: this.estimateCompletion(state)
    };
  }

  /**
   * Estimate campaign completion time
   * @param {Object} state - Processing state
   * @returns {Date|null} - Estimated completion time
   */
  estimateCompletion(state) {
    if (state.processed === 0) return null;

    const elapsed = Date.now() - state.startTime.getTime();
    const avgTimePerRecipient = elapsed / state.processed;
    const remaining = state.total - state.processed;
    const estimatedRemaining = remaining * avgTimePerRecipient;

    return new Date(Date.now() + estimatedRemaining);
  }

  /**
   * Pause campaign processing
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<void>}
   */
  async pauseCampaign(campaignId) {
    const state = this.processingCampaigns.get(campaignId);
    if (!state) return;

    state.isRunning = false;

    try {
      const campaign = await Campaign.findById(campaignId);
      if (campaign) {
        campaign.status = 'paused';
        campaign.pausedAt = new Date();
        await campaign.save();
      }

      console.log(`⏸️ Campaign paused: ${campaignId}`);

    } catch (error) {
      console.error(`❌ Error pausing campaign: ${error.message}`);
    }
  }

  /**
   * Resume campaign processing
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<void>}
   */
  async resumeCampaign(campaignId) {
    const state = this.processingCampaigns.get(campaignId);
    if (!state) return;

    state.isRunning = true;

    try {
      const campaign = await Campaign.findById(campaignId);
      if (campaign) {
        campaign.status = 'running';
        campaign.resumedAt = new Date();
        await campaign.save();
      }

      console.log(`▶️ Campaign resumed: ${campaignId}`);

      // Resume processing
      this.processCampaignBatch(campaignId).catch(err => {
        console.error(`❌ Campaign processing error: ${err.message}`);
        this.stopCampaign(campaignId, 'error', err.message);
      });

    } catch (error) {
      console.error(`❌ Error resuming campaign: ${error.message}`);
    }
  }

  // ✅ PRODUCTION: Send template to group with individual processing
  async sendTemplateToGroup(req, res) {
    try {
      const { groupId, template, variables = {} } = req.body;

      if (!groupId || !template?.metaTemplateName) {
        return res.status(400).json({
          success: false,
          message: 'Group ID and template name are required'
        });
      }

      // Get group with contacts
      const ContactGroup = require('../models/ContactGroup');
      const group = await ContactGroup.findOne({
        _id: groupId,
        userId: req.user._id
      }).populate('contacts');

      if (!group) {
        return res.status(404).json({
          success: false,
          message: 'Group not found'
        });
      }

      if (!group.contacts.length) {
        return res.status(400).json({
          success: false,
          message: 'Group has no contacts'
        });
      }

      console.log(`👥 Sending template to ${group.contacts.length} contacts in group ${group.name}`);

      const results = {
        total: group.contacts.length,
        sent: 0,
        failed: 0,
        errors: []
      };

      // Process each contact individually
      for (const contact of group.contacts) {
        try {
          // Normalize phone number
          const { normalizePhone, validateForWhatsApp } = require('../utils/internationalPhoneNormalizer');
          const normalizedResult = normalizePhone(contact.phone);

          if (!normalizedResult.success) {
            results.failed++;
            results.errors.push({
              contactId: contact._id,
              phone: contact.phone,
              error: `Invalid phone number: ${normalizedResult.error}`
            });
            continue;
          }

          // Validate for WhatsApp
          const validation = validateForWhatsApp(normalizedResult.phoneNumber);
          if (!validation.valid) {
            console.warn(`⚠️ Phone validation warning for ${contact.phone}: ${validation.reason}`);
          }

          // Prepare variables for this contact
          const contactVariables = {
            ...variables,
            '{{1}}': contact.name || variables['{{1}}'] || '',
            '{{2}}': variables['{{2}}'] || ''
          };

          // Convert to array format
          const variableArray = Object.values(contactVariables).filter(v => v !== '');

          // Send template message
          const whatsappService = require('./whatsappService');
          const sendResult = await whatsappService.sendTemplateMessage({
            to: normalizedResult.phoneNumber,
            templateName: template.metaTemplateName,
            language: template.language || 'en_US',
            bodyParams: variableArray,
            userId: req.user._id
          });

          if (sendResult.success) {
            results.sent++;

            // Save message to database
            const Message = require('../models/Message');
            const message = new Message({
              customerId: contact._id,
              userId: req.user._id,
              groupId: groupId,
              content: {
                type: 'template',
                templateName: template.metaTemplateName,
                variables: contactVariables
              },
              direction: 'outbound',
              status: 'sent',
              metaMessageId: sendResult.data?.messages?.[0]?.id,
              sentAt: new Date()
            });
            await message.save();

          } else {
            results.failed++;
            results.errors.push({
              contactId: contact._id,
              phone: contact.phone,
              error: sendResult.error || 'Failed to send template'
            });
          }

          // Rate limiting: 50ms delay between messages (Meta limit: 100/sec)
          await new Promise(resolve => setTimeout(resolve, 50));

        } catch (error) {
          results.failed++;
          results.errors.push({
            contactId: contact._id,
            phone: contact.phone,
            error: error.message
          });
          console.error(`❌ Failed to send to ${contact.phone}:`, error);
        }
      }

      res.json({
        success: true,
        message: `Template sent to group. ${results.sent} sent, ${results.failed} failed`,
        data: results
      });

    } catch (error) {
      console.error('❌ Send template to group error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send template to group',
        error: error.message
      });
    }
  }
}

// Create singleton instance
const internationalCampaignProcessor = new InternationalCampaignProcessor();

module.exports = {
  InternationalCampaignProcessor,
  internationalCampaignProcessor,
  startCampaign: (campaignId, options) => internationalCampaignProcessor.startCampaign(campaignId, options),
  stopCampaign: (campaignId, reason, error) => internationalCampaignProcessor.stopCampaign(campaignId, reason, error),
  pauseCampaign: (campaignId) => internationalCampaignProcessor.pauseCampaign(campaignId),
  resumeCampaign: (campaignId) => internationalCampaignProcessor.resumeCampaign(campaignId),
  getCampaignStatus: (campaignId) => internationalCampaignProcessor.getCampaignStatus(campaignId),
  sendTemplateToGroup: (req, res) => internationalCampaignProcessor.sendTemplateToGroup(req, res)
};
