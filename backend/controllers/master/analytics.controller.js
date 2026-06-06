const User = require("../../models/User");
const Message = require("../../models/Message");
const Campaign = require("../../models/Campaign");

// 🔥 Get Analytics for Graph (User Growth, Messages, Campaigns)
exports.getAnalytics = async (req, res) => {
    try {
        console.log('📊 [MASTER] Analytics requested');

        let range = parseInt(req.query.range);
        if (isNaN(range) || range <= 0) range = 7; // Default to 7 days if invalid

        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - range + 1); // Go back 'range - 1' days to include today
        startDate.setHours(0, 0, 0, 0);

        console.log(`🔍 [MASTER] Fetching analytics from: ${startDate.toISOString()} (Range: ${range} days)`);

        // Helper to generate date labels array for the last X days
        const labels = [];
        for (let i = 0; i < range; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            labels.push(d.toISOString().split('T')[0]); // YYYY-MM-DD
        }

        // Helper function for daily aggregation
        const getDailyCount = async (model, matchFilter = {}) => {
            const results = await model.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate },
                        ...matchFilter
                    }
                },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]);

            // Transform into map for O(1) lookup
            const countMap = {};
            results.forEach(item => {
                countMap[item._id] = item.count;
            });

            // Map back to the labels array to ensure zero-filling for missing days
            return labels.map(date => countMap[date] || 0);
        };

        // Run aggregations in parallel
        const [dailyUsers, dailyMessages, dailyCampaigns] = await Promise.all([
            getDailyCount(User, { role: 'user' }), // Only count regular users, not admins/bots
            getDailyCount(Message, { direction: 'outgoing' }), // Count only outgoing messages sent
            getDailyCount(Campaign, {}) // Count all campaigns created
        ]);

        console.log(`✅ [MASTER] Analytics fetched successfully`);

        res.json({
            success: true,
            data: {
                labels, // ["2026-02-12", "2026-02-13", ...]
                users: dailyUsers,
                messages: dailyMessages,
                campaigns: dailyCampaigns
            }
        });

    } catch (err) {
        console.error("❌ [MASTER] Analytics Error:", err);
        res.status(500).json({ success: false, error: "Failed to fetch analytics" });
    }
};