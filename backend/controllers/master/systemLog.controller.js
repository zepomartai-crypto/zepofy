const SystemLog = require("../../models/SystemLog");

exports.getSystemLogs = async (req, res) => {
    try {
        const { type, userId, page = 1, limit = 50 } = req.query;
        const query = {};
        if (type) query.type = type;
        if (userId) query.userId = userId;

        const logs = await SystemLog.find(query)
            .populate("userId", "name email")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await SystemLog.countDocuments(query);

        res.json({
            success: true,
            data: {
                logs: logs,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: "Failed to fetch system logs" });
    }
};