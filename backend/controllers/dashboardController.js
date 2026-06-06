const mongoose = require("mongoose");
const Campaign = require("../models/Campaign");
const Template = require("../models/Template");
const Contact = require("../models/Contact");
const ContactGroup = require("../models/ContactGroup");
const WhatsAppIntegration = require("../models/WhatsAppIntegration");
const WooCommerceIntegration = require("../models/WooCommerceIntegration");
const ShopifyIntegration = require("../models/ShopifyIntegration");
const WooCommerceOrder = require("../models/WooCommerceOrder");
const ShopifyOrder = require("../models/ShopifyOrder");
const CartSession = require("../models/CartSession");
const ShopifyAbandonedCheckout = require("../models/ShopifyAbandonedCheckout");
const AbandonedCart = require("../models/AbandonedCart");
const SystemTemplate = require("../models/SystemTemplate");
const Appointment = require("../models/Appointment");

exports.getOverview = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);

    const [
      templateStats,
      systemTemplateCount,
      contactCount,
      groupCount,
      campaignStats,
      integrationStatus,
      appointmentStats,
    ] = await Promise.all([

      Template.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            approved: {
              $sum: {
                $cond: [{ $eq: ["$metaStatus", "approved"] }, 1, 0]
              }
            },
            rejected: {
              $sum: {
                $cond: [{ $eq: ["$metaStatus", "rejected"] }, 1, 0]
              }
            },
            pending: {
              $sum: {
                $cond: [{ $eq: ["$metaStatus", "pending"] }, 1, 0]
              }
            }
          }
        }
      ]),
      SystemTemplate.aggregate([
        // Removed userId filter to show global/system assets availability
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            text: { $sum: { $cond: [{ $eq: ["$type", "text"] }, 1, 0] } },
            media: { $sum: { $cond: [{ $in: ["$type", ["image", "media"]] }, 1, 0] } }
          }
        }
      ]),

      // Simple counts for contacts and groups
      Contact.countDocuments({ userId }),
      ContactGroup.countDocuments({ userId }),

      // Campaign statistics with aggregation
      Campaign.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            running: {
              $sum: {
                $cond: [{ $eq: ["$status", "running"] }, 1, 0]
              }
            },
            paused: {
              $sum: {
                $cond: [{ $eq: ["$status", "paused"] }, 1, 0]
              }
            },
            completed: {
              $sum: {
                $cond: [{ $eq: ["$status", "completed"] }, 1, 0]
              }
            },
            saved: {
              $sum: {
                $cond: [{ $eq: ["$status", "saved"] }, 1, 0]
              }
            },
            totalSent: { $sum: "$sentCount" },
            totalFailed: { $sum: "$failedCount" },
            totalReplies: { $sum: "$replyCount" }
          }
        }
      ]),

      WhatsAppIntegration.findOne({ userId })
        .select('wabaId phoneNumberId businessPhoneNumber status metaApiVersion connectedAt lastVerifiedAt errorMessage')
        .lean(),

      Appointment.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            scheduled: { $sum: { $cond: [{ $eq: ["$status", "scheduled"] }, 1, 0] } }
          }
        }
      ]),

      // ...removed email stats aggregation...
    ]);

    // Extract data from aggregation results
    const templates = templateStats[0] || { total: 0, approved: 0, rejected: 0, pending: 0 };
    const campaigns = campaignStats[0] || {
      total: 0, running: 0, paused: 0, completed: 0, saved: 0,
      totalSent: 0, totalFailed: 0, totalReplies: 0
    };

    // ...removed email stats extraction...

    // Build integration status object
    const integration = integrationStatus ? {
      isConnected: integrationStatus.status === 'connected',
      status: integrationStatus.status,
      wabaId: integrationStatus.wabaId,
      phoneNumberId: integrationStatus.phoneNumberId,
      businessPhoneNumber: integrationStatus.businessPhoneNumber,
      metaApiVersion: integrationStatus.metaApiVersion,
      connectedAt: integrationStatus.connectedAt,
      lastVerifiedAt: integrationStatus.lastVerifiedAt,
      errorMessage: integrationStatus.errorMessage
    } : {
      isConnected: false,
      status: 'not_connected',
      message: 'No WhatsApp integration found'
    };

    const systemTemplates = systemTemplateCount[0] || { total: 0, text: 0, media: 0 };

    res.json({
      success: true,
      data: {
        templates: {
          total: templates.total,
          approved: templates.approved,
          rejected: templates.rejected,
          pending: templates.pending,
          system: {
            total: systemTemplates.total,
            text: systemTemplates.text,
            media: systemTemplates.media
          }
        },
        contacts: {
          total: contactCount
        },
        groups: {
          total: groupCount
        },
        campaigns: {
          total: campaigns.total,
          running: campaigns.running,
          paused: campaigns.paused,
          completed: campaigns.completed,
          saved: campaigns.saved,
          totalSent: campaigns.totalSent,
          totalFailed: campaigns.totalFailed,
          totalReplies: campaigns.totalReplies
        },
        // ...removed email stats from overview response...
        integration,
        appointments: appointmentStats[0] || { total: 0, scheduled: 0 },
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error("Dashboard overview error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to load dashboard data",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * Get messages chart data for dashboard
 */
exports.getMessagesChart = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);
    const { period = 'Week' } = req.query;
    let days = 7;
    if (period === 'Day') days = 1;
    else if (period === 'Month') days = 30;
    else if (period === 'Week') days = 7;
    else days = parseInt(period) || 7;

    const startDate = new Date();
    if (period === 'Day') {
      startDate.setHours(startDate.getHours() - 24);
    } else {
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);
    }

    const Message = require("../models/Message");

    // Aggregate messages
    const aggregationPipeline = [
      {
        $match: {
          userId,
          createdAt: { $gte: startDate }
        }
      }
    ];

    if (period === 'Day') {
      aggregationPipeline.push(
        {
          $project: {
            hour: {
              $dateToString: {
                format: "%Y-%m-%dT%H:00:00.000Z",
                date: "$createdAt"
              }
            },
            direction: 1,
            status: 1
          }
        },
        {
          $group: {
            _id: "$hour",
            sent: { $sum: { $cond: [{ $eq: ["$direction", "outgoing"] }, 1, 0] } },
            delivered: { $sum: { $cond: [{ $in: ["$status", ["delivered", "read"]] }, 1, 0] } },
            read: { $sum: { $cond: [{ $eq: ["$status", "read"] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } }
          }
        }
      );
    } else {
      aggregationPipeline.push(
        {
          $project: {
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt"
              }
            },
            direction: 1,
            status: 1
          }
        },
        {
          $group: {
            _id: "$date",
            sent: { $sum: { $cond: [{ $eq: ["$direction", "outgoing"] }, 1, 0] } },
            delivered: { $sum: { $cond: [{ $in: ["$status", ["delivered", "read"]] }, 1, 0] } },
            read: { $sum: { $cond: [{ $eq: ["$status", "read"] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } }
          }
        }
      );
    }

    aggregationPipeline.push({ $sort: { _id: 1 } });

    const messageStats = await Message.aggregate(aggregationPipeline);

    // Fill in missing slots
    const chartData = [];
    let currentDate = new Date(startDate);
    const endDate = new Date();

    if (period === 'Day') {
      // 24 hour slots
      for (let i = 0; i <= 24; i++) {
        const dateStr = currentDate.toISOString().split(':')[0] + ':00:00.000Z';
        const hourData = messageStats.find(s => s._id === dateStr);

        chartData.push({
          date: currentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          sent: hourData?.sent || 0,
          delivered: hourData?.delivered || 0,
          read: hourData?.read || 0,
          failed: hourData?.failed || 0
        });
        currentDate.setHours(currentDate.getHours() + 1);
      }
    } else {
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayData = messageStats.find(s => s._id === dateStr);

        chartData.push({
          date: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          sent: dayData?.sent || 0,
          delivered: dayData?.delivered || 0,
          read: dayData?.read || 0,
          failed: dayData?.failed || 0
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    res.json({
      success: true,
      data: chartData
    });
  } catch (err) {
    console.error("Chart data error:", err);
    res.status(500).json({ error: "Could not fetch chart data" });
  }
};

/**
 * GET /dashboard/recent-activity
 * Combines recent campaigns, contacts, and templates
 */
exports.getRecentActivity = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);

    const [campaigns, contacts, templates, messages] = await Promise.all([
      Campaign.find({ userId }).sort({ createdAt: -1 }).limit(5).select('name status createdAt').lean(),
      Contact.find({ userId }).sort({ createdAt: -1 }).limit(5).select('name phone createdAt').lean(),
      Template.find({ userId }).sort({ createdAt: -1 }).limit(5).select('name createdAt').lean(),
      // Fetch recent messages for live activity feed
      mongoose.model('Message').find({ userId }).sort({ createdAt: -1 }).limit(10).select('phone direction sender type createdAt status').lean().catch(() => [])
    ]);

    const activity = [];

    campaigns.forEach(c => {
      activity.push({
        type: 'campaign',
        title: `Campaign '${c.name || 'Untitled'}' ${c.status}`,
        time: c.createdAt,
        status: c.status
      });
    });

    contacts.forEach(c => {
      activity.push({
        type: 'contact',
        title: `New contact '${c.name || c.phone}' added`,
        time: c.createdAt
      });
    });

    templates.forEach(t => {
      activity.push({
        type: 'template',
        title: `Template '${t.name}' created`,
        time: t.createdAt
      });
    });

    messages.forEach(m => {
      if (m.direction === 'incoming') {
        activity.push({
          type: 'reply',
          title: `New reply from ${m.phone || 'User'}`,
          time: m.createdAt,
          status: 'replied'
        });
      } else {
        // Outgoing message
        let action = 'sent';
        if (m.status === 'delivered') action = 'delivered';
        if (m.status === 'read') action = 'read';
        if (m.status === 'failed') action = 'failed';

        activity.push({
          type: 'message',
          title: `Message ${action} to ${m.phone || 'User'}`,
          time: m.createdAt,
          status: action
        });
      }
    });

    // Sort combined activity by time and limit to 5
    const recentActivity = activity
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 5);

    res.json({
      success: true,
      data: recentActivity
    });
  } catch (err) {
    console.error("Recent activity error:", err);
    res.status(500).json({ error: "Could not fetch activity" });
  }
};

/**
 * Get campaign performance data for dashboard
 */
exports.getCampaignPerformance = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);

    const topCampaigns = await Campaign.aggregate([
      { $match: { userId } },
      {
        $addFields: {
          deliveryRate: {
            $cond: [
              { $eq: ['$total', 0] },
              0,
              { $multiply: [{ $divide: ['$sentCount', '$total'] }, 100] }
            ]
          }
        }
      },
      { $sort: { sentCount: -1 } },
      { $limit: 5 },
      {
        $project: {
          name: 1,
          sent: '$sentCount',
          delivered: { $subtract: ['$sentCount', '$failedCount'] },
          rate: { $round: ['$deliveryRate', 1] },
          status: 1,
          createdAt: 1
        }
      }
    ]);

    res.json({
      success: true,
      data: topCampaigns
    });

  } catch (err) {
    console.error('Campaign performance error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to load campaign performance data'
    });
  }
};

/**
 * Get quality score for dashboard
 */
exports.getQualityScore = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);

    // Get template stats
    const templateStats = await Template.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          approved: {
            $sum: { $cond: [{ $eq: ['$metaStatus', 'approved'] }, 1, 0] }
          },
          rejected: {
            $sum: { $cond: [{ $eq: ['$metaStatus', 'rejected'] }, 1, 0] }
          }
        }
      }
    ]);

    // Get campaign stats
    const campaignStats = await Campaign.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
          totalSent: { $sum: '$sentCount' },
          totalFailed: { $sum: '$failedCount' }
        }
      }
    ]);

    const templates = templateStats[0] || { total: 0, approved: 0, rejected: 0 };
    const campaigns = campaignStats[0] || { total: 0, completed: 0, failed: 0, totalSent: 0, totalFailed: 0 };

    // Calculate quality score components
    const templateApprovalRate = templates.total > 0 ? (templates.approved / templates.total) * 100 : 0;
    const campaignSuccessRate = campaigns.total > 0 ? (campaigns.completed / campaigns.total) * 100 : 0;
    const messageDeliveryRate = campaigns.totalSent > 0 ? ((campaigns.totalSent - campaigns.totalFailed) / campaigns.totalSent) * 100 : 0;
    const templateRejectionRate = templates.total > 0 ? (templates.rejected / templates.total) * 100 : 0;

    // Quality score formula (0-100)
    const qualityScore = Math.round(
      (templateApprovalRate * 0.3) +     // 30% weight
      (campaignSuccessRate * 0.3) +      // 30% weight  
      (messageDeliveryRate * 0.3) +       // 30% weight
      (Math.max(0, 100 - templateRejectionRate) * 0.1) // 10% weight (lower rejection = better)
    );

    res.json({
      success: true,
      data: {
        overall: Math.min(100, Math.max(0, qualityScore)),
        components: {
          templateQuality: Math.round(templateApprovalRate),
          deliveryRate: Math.round(messageDeliveryRate),
          campaignSuccess: Math.round(campaignSuccessRate),
          rejectionRate: Math.round(templateRejectionRate)
        }
      }
    });

  } catch (err) {
    console.error('Quality score error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to load quality score data'
    });
  }
};

/**
 * Get WhatsApp integration details for dashboard
 */
exports.getIntegrationStatus = async (req, res) => {
  try {
    const userId = req.userId;
    const Settings = require("../models/Settings");
    const WooCommerceIntegration = require("../models/WooCommerceIntegration");
    const WooCommerceOrder = require("../models/WooCommerceOrder");
    const AbandonedCart = require("../models/AbandonedCart");

    const [whatsappIntegration, settings, woocommerce, orderCount, abandonedCount] = await Promise.all([
      WhatsAppIntegration.findOne({ userId })
        .select('wabaId phoneNumberId businessPhoneNumber status metaApiVersion connectedAt lastVerifiedAt errorMessage webhookConfigured')
        .lean(),
      Settings.findOne({ userId }).select('emailProvider shopify').lean(),
      WooCommerceIntegration.findOne({ userId }).select('status storeUrl updatedAt').lean(),
      WooCommerceOrder.countDocuments({ userId }),
      AbandonedCart.countDocuments({ userId, status: 'abandoned' })
    ]);

    // Format WhatsApp Data
    const whatsappData = whatsappIntegration ? {
      isConnected: whatsappIntegration.status === 'connected',
      status: whatsappIntegration.status,
      wabaId: whatsappIntegration.wabaId,
      phoneNumberId: whatsappIntegration.phoneNumberId,
      businessPhoneNumber: whatsappIntegration.businessPhoneNumber,
      metaApiVersion: whatsappIntegration.metaApiVersion,
      connectedAt: whatsappIntegration.connectedAt,
      lastVerifiedAt: whatsappIntegration.lastVerifiedAt,
      errorMessage: whatsappIntegration.errorMessage,
      webhookConfigured: whatsappIntegration.webhookConfigured
    } : {
      isConnected: false,
      status: 'not_connected',
      message: 'No WhatsApp integration configured'
    };

    // Format Email Data
    const emailData = settings?.emailProvider ? {
      isConnected: settings.emailProvider.connected || false,
      provider: settings.emailProvider.provider || 'resend',
      fromEmail: settings.emailProvider.fromEmail,
      status: settings.emailProvider.connected ? 'connected' : 'not_connected',
      lastVerified: settings.emailProvider.lastVerified,
      connectedAt: settings.emailProvider.connectedAt
    } : {
      isConnected: false,
      status: 'not_connected',
      message: 'No Email integration configured'
    };

    // Format WooCommerce Data
    const woocommerceData = woocommerce ? {
      isConnected: woocommerce.status === 'connected',
      status: woocommerce.status,
      storeUrl: woocommerce.storeUrl,
      lastSync: woocommerce.updatedAt,
      stats: woocommerce.status === 'connected' ? {
        orders: orderCount || 0,
        abandonedCarts: abandonedCount || 0
      } : null
    } : {
      isConnected: false,
      status: 'not_connected'
    };

    // Format Shopify Data
    const shopifyData = settings?.shopify ? {
      isConnected: settings.shopify.connected || false,
      status: settings.shopify.connected ? 'connected' : 'not_connected',
      storeDomain: settings.shopify.storeDomain,
      lastSync: settings.shopify.lastSync
    } : {
      isConnected: false,
      status: 'not_connected'
    };

    res.json({
      success: true,
      data: {
        whatsapp: whatsappData,
        email: emailData,
        woocommerce: woocommerceData,
        shopify: shopifyData
      }
    });

  } catch (err) {
    console.error("Integration status error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to load integration status"
    });
  }
};

/**
 * Legacy dashboard summary for backward compatibility
 */
exports.dashboardSummary = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);

    const [
      templateStats,
      contactCount,
      groupCount,
      campaignStats,
      integrationStatus
    ] = await Promise.all([
      Template.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            approved: {
              $sum: {
                $cond: [{ $eq: ["$metaStatus", "approved"] }, 1, 0]
              }
            }
          }
        }
      ]),
      Contact.countDocuments({ userId }),
      ContactGroup.countDocuments({ userId }),
      Campaign.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            totalSent: { $sum: "$sentCount" },
            totalFailed: { $sum: "$failedCount" },
            totalReplies: { $sum: "$replyCount" }
          }
        }
      ]),
      WhatsAppIntegration.findOne({ userId }).lean()
    ]);

    const templates = templateStats[0] || { total: 0, approved: 0 };
    const campaigns = campaignStats[0] || {
      total: 0, totalSent: 0, totalFailed: 0, totalReplies: 0
    };

    res.json({
      data: {
        totalTemplates: templates.total,
        approvedTemplates: templates.approved,
        totalContacts: contactCount,
        totalGroups: groupCount,
        totalCampaigns: campaigns.total,
        sentTemplates: campaigns.totalSent,
        failedTemplates: campaigns.totalFailed,
        repliedTemplates: campaigns.totalReplies
      }
    });

  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ NEW: Single Analytics Endpoint for Dashboard
exports.getAnalytics = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);

    console.log('🚀 Starting analytics fetch for user:', userId);

    // Fetch all required data in parallel
    const [
      templateStats,
      contactCount,
      campaignStats,
      runningCampaignsCount,
      integrationStatus,
      systemTemplateStats,
      campaignReachData,
      allCampaigns,
      whatsappDetails,
      wooCommerceStats,
      shopifyStats,
      totalRepliesStats,
      appointmentAnalytics
    ] = await Promise.all([
      // Template count
      Template.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            approved: { $sum: { $cond: [{ $eq: ["$metaStatus", "approved"] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ["$metaStatus", "rejected"] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $eq: ["$metaStatus", "pending"] }, 1, 0] } }
          }
        }
      ]),

      // Contact count
      Contact.countDocuments({ userId }),

      // Campaign stats
      Campaign.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: null,
            totalSent: { $sum: "$sentCount" },
            totalDelivered: { $sum: "$deliveredCount" },
            totalRead: { $sum: "$readCount" },
            totalFailed: { $sum: "$failedCount" }
          }
        }
      ]),

      // Running campaigns count
      Campaign.countDocuments({ userId, status: "running" }),

      // Integration status
      Promise.all([
        WhatsAppIntegration.exists({ userId, status: "connected" }),
        WooCommerceIntegration.exists({ userId, status: "connected" }),
        ShopifyIntegration.exists({ userId, status: "connected" })
      ]),

      // System Templates count
      SystemTemplate.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            text: { $sum: { $cond: [{ $eq: ["$type", "text"] }, 1, 0] } },
            media: { $sum: { $cond: [{ $in: ["$type", ["image", "media"]] }, 1, 0] } }
          }
        }
      ]),

      // Campaign reach data
      Campaign.find({ userId })
        .select('name sentCount deliveredCount readCount failedCount replyCount status total createdAt')
        .sort({ createdAt: -1 })
        .lean(),

      // All campaigns for performance scores
      Campaign.find({ userId })
        .select('name status sentCount deliveredCount readCount failedCount replyCount total createdAt')
        .sort({ createdAt: -1 })
        .lean(),

      // WhatsApp integration details
      WhatsAppIntegration.findOne({ userId })
        .select('phoneNumberId businessPhoneNumber')
        .lean(),

      // WooCommerce statistics
      Promise.all([
        WooCommerceOrder.countDocuments({ userId }),
        AbandonedCart.countDocuments({ userId, status: 'abandoned' })
      ]),

      // Shopify statistics
      Promise.all([
        ShopifyOrder.countDocuments({ userId }),
        ShopifyAbandonedCheckout.countDocuments({ userId })
      ]),
      // Total replies received across all campaigns
      Campaign.aggregate([
        { $match: { userId } },
        { $group: { _id: null, totalReplies: { $sum: "$replyCount" } } }
      ]),
      // Appointment analytics
      Appointment.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            scheduled: { $sum: { $cond: [{ $eq: ["$status", "scheduled"] }, 1, 0] } },
            completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } }
          }
        }
      ])
    ]);

    console.log('📊 Raw analytics data fetched:', {
      templateStats,
      contactCount,
      campaignStats,
      runningCampaignsCount,
      integrationStatus,
      campaignReachData: campaignReachData?.length || 0,
      allCampaigns: allCampaigns?.length || 0,
      whatsappDetails,
      wooCommerceStats,
      shopifyStats,
      totalRepliesStats
    });

    // Safe variable definitions with defaults
    const campaigns = campaignStats && campaignStats[0] ? campaignStats[0] : { totalSent: 0, totalDelivered: 0, totalRead: 0, totalFailed: 0 };
    const totalMessages = (campaigns.totalSent || 0) + (campaigns.totalFailed || 0);
    const totalReplies = totalRepliesStats && totalRepliesStats[0] ? totalRepliesStats[0].totalReplies : 0;
    const deliveryRate = totalMessages > 0 ? Math.round((campaigns.totalDelivered / campaigns.totalSent) * 100) : 0;
    const readRate = campaigns.totalDelivered > 0 ? Math.round((campaigns.totalRead / campaigns.totalDelivered) * 100) : 0;
    const replyRate = campaigns.totalRead > 0 ? ((totalReplies / campaigns.totalRead) * 100).toFixed(1) : 0;

    // Integration status with details
    const [whatsappConnected = false, woocommerceConnected = false, shopifyConnected = false] = integrationStatus || [];
    const wooDetails = await WooCommerceIntegration.findOne({ userId }).select('storeUrl').lean();
    const shopifyDetails = await ShopifyIntegration.findOne({ userId }).select('storeDomain').lean();

    // Campaign reach data with safe mapping
    const campaignReach = Array.isArray(campaignReachData) ? campaignReachData.map(campaign => ({
      campaign: campaign.name || 'Unknown Campaign',
      reach: campaign.sentCount || 0
    })) : [];

    // Performance scores with safe calculations
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const last7DaysCampaignsData = Array.isArray(allCampaigns) ? allCampaigns.filter(c => new Date(c.createdAt) >= last7Days) : [];
    const todayCampaignsData = Array.isArray(allCampaigns) ? allCampaigns.filter(c => new Date(c.createdAt) >= today) : [];

    const last7DaysCampaigns = last7DaysCampaignsData.length;

    // Daily Insights
    const todayMessagesSent = todayCampaignsData.reduce((sum, c) => sum + (c.sentCount || 0), 0);
    const todayMessagesDelivered = todayCampaignsData.reduce((sum, c) => sum + (c.deliveredCount || 0), 0);
    const todayMessagesRead = todayCampaignsData.reduce((sum, c) => sum + (c.readCount || 0), 0);
    const todayMessagesFailed = todayCampaignsData.reduce((sum, c) => sum + (c.failedCount || 0), 0);

    // Delivery Insights Stats for Sidebar
    const last7DaysMessagesSent = last7DaysCampaignsData.reduce((sum, c) => sum + (c.sentCount || 0), 0);
    const last7DaysMessagesFailed = last7DaysCampaignsData.reduce((sum, c) => sum + (c.failedCount || 0), 0);
    const last7DaysMessagesDelivered = last7DaysCampaignsData.reduce((sum, c) => sum + (c.deliveredCount || 0), 0);
    const last7DaysMessagesRead = last7DaysCampaignsData.reduce((sum, c) => sum + (c.readCount || 0), 0);
    const last7DaysDeliveryRate = last7DaysMessagesSent > 0 ? Math.round((last7DaysMessagesDelivered / last7DaysMessagesSent) * 100) : 0;

    const totalCampaigns = Array.isArray(allCampaigns) ? allCampaigns.length : 0;
    const successfulCampaigns = Array.isArray(allCampaigns) ? allCampaigns.filter(c => c.status === 'completed').length : 0;
    const messagingQualityScore = deliveryRate || 0;
    const campaignSuccessScore = totalCampaigns > 0 ? Math.round((successfulCampaigns / totalCampaigns) * 100) : 0;

    // WooCommerce stats with safe defaults - ONLY show if connected
    const wooTotalOrders = woocommerceConnected ? (Array.isArray(wooCommerceStats) ? (wooCommerceStats[0] || 0) : 0) : 0;
    const wooAbandonedCarts = woocommerceConnected ? (Array.isArray(wooCommerceStats) ? (wooCommerceStats[1] || 0) : 0) : 0;

    // Shopify stats with safe defaults - ONLY show if connected
    const shopifyTotalOrders = shopifyConnected ? (Array.isArray(shopifyStats) ? (shopifyStats[0] || 0) : 0) : 0;
    const shopifyAbandonedCarts = shopifyConnected ? (Array.isArray(shopifyStats) ? (shopifyStats[1] || 0) : 0) : 0;

    console.log('📊 Processed analytics data:', {
      totalMessages,
      runningCampaignsCount,
      contactCount,
      deliveryRate,
      templateStats,
      integrationStatus: { whatsappConnected, woocommerceConnected, shopifyConnected },
      whatsappDetails,
      wooCommerceStats: { wooTotalOrders, wooAbandonedCarts },
      shopifyStats: { shopifyTotalOrders, shopifyAbandonedCarts },
      campaignReach: campaignReach.slice(0, 3),
      performanceScores: { messagingQualityScore, campaignSuccessScore }
    });

    const responseData = {
      messagesSent: totalMessages,
      totalCampaigns: totalCampaigns,
      runningCampaigns: runningCampaignsCount || 0,
      contacts: contactCount || 0,
      deliveryRate: deliveryRate,
      templates: {
        ...(templateStats && templateStats[0] ? templateStats[0] : { total: 0, approved: 0, rejected: 0, pending: 0 }),
        system: systemTemplateStats && systemTemplateStats[0] ? systemTemplateStats[0] : { total: 0, text: 0, media: 0 }
      },
      // Integration details
      whatsapp: {
        connected: whatsappConnected,
        phone_id: whatsappDetails?.phoneNumberId || null,
        phone_number: whatsappDetails?.businessPhoneNumber || null
      },
      woocommerce: {
        connected: woocommerceConnected,
        store_url: woocommerceConnected ? (wooDetails?.storeUrl || null) : null,
        orders: wooTotalOrders,
        abandoned: wooAbandonedCarts
      },
      shopify: {
        connected: shopifyConnected,
        store_domain: shopifyConnected ? (shopifyDetails?.storeDomain || null) : null,
        orders: shopifyTotalOrders,
        abandoned: shopifyAbandonedCarts
      },
      // New summary stats
      summary: {
        last7DaysCampaigns,
        totalReplies,
        replyRate,
        readRate,
        // Daily Insights
        todayMessagesSent,
        todayMessagesDelivered,
        todayMessagesRead,
        todayMessagesFailed,
        // Delivery Insights
        last7DaysMessagesSent,
        last7DaysMessagesDelivered,
        last7DaysMessagesRead,
        last7DaysMessagesFailed,
        last7DaysDeliveryRate
      },
      // Campaign reach data
      campaign_reach: campaignReach,
      // Full Campaign list
      all_campaigns: allCampaigns,
      // Performance scores
      messaging_quality_score: messagingQualityScore,
      campaign_success_score: campaignSuccessScore,
      appointments: appointmentAnalytics[0] || { total: 0, scheduled: 0, completed: 0 }
    };

    console.log('📤 Final Analytics API Response:', responseData);

    res.json({
      success: true,
      data: responseData
    });

  } catch (err) {
    console.error("Dashboard analytics error:", err);
    // Return safe fallback data to prevent dashboard crashes
    res.json({
      success: true,
      data: {
        messagesSent: 0,
        totalCampaigns: 0,
        runningCampaigns: 0,
        contacts: 0,
        deliveryRate: 0,
        templates: 0,
        whatsapp: {
          connected: false,
          phone_id: null,
          phone_number: null
        },
        woocommerce: {
          connected: false,
          orders: 0,
          abandoned: 0
        },
        shopify: {
          connected: false,
          orders: 0,
          abandoned: 0
        },
        campaign_reach: [],
        messaging_quality_score: 0,
        campaign_success_score: 0
      }
    });
  }
};
