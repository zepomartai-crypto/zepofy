const Notification = require("../models/Notification");

/* ================= GET UNREAD COUNT ================= */
exports.getUnreadCount = async (req, res) => {
  try {
    const Contact = require("../models/Contact");
    const contacts = await Contact.find({ userId: req.userId, unreadCount: { $gt: 0 } });
    const count = contacts.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

    res.json({ success: true, count });
  } catch (error) {
    console.error("❌ Error fetching unread count:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/* ================= GET ALL NOTIFICATIONS ================= */
exports.getNotifications = async (req, res) => {
  try {
    const { limit = 20, skip = 0 } = req.query;

    const notifications = await Notification.find({
      userId: req.userId,
    })
      .populate({
        path: "messageId",
        select: "body type sender",
      })
      .populate({
        path: "customerId",
        select: "name phone",
      })
      .populate({
        path: "conversationId",
        select: "_id",
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await Notification.countDocuments({
      userId: req.userId,
    });

    res.json({
      success: true,
      data: notifications,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching notifications:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/* ================= MARK AS READ (for conversation) ================= */
exports.markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.body;

    if (!conversationId) {
      return res
        .status(400)
        .json({
          success: false,
          error: "conversationId is required",
        });
    }

    // Mark all unread notifications for this conversation as read
    const result = await Notification.updateMany(
      {
        userId: req.userId,
        conversationId,
        read: false,
      },
      {
        $set: {
          read: true,
          readAt: new Date(),
        },
      }
    );

    console.log(`🔔 Marked ${result.modifiedCount} notifications as read`);

    res.json({
      success: true,
      markedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("❌ Error marking notifications as read:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/* ================= MARK SINGLE NOTIFICATION AS READ ================= */
exports.markSingleAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        userId: req.userId,
      },
      {
        $set: {
          read: true,
          readAt: new Date(),
        },
      },
      { new: true }
    );

    if (!notification) {
      return res
        .status(404)
        .json({
          success: false,
          error: "Notification not found",
        });
    }

    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    console.error("❌ Error marking notification as read:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
