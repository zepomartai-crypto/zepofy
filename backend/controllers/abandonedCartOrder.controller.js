// Abandoned Cart Order Controller
// Handles API endpoints for abandoned cart orders

const AbandonedCartOrder = require('../models/AbandonedCart');

class AbandonedCartOrderController {
    // CRITICAL: Middleware to validate userId for multi-tenant safety
    validateUserId(req, res, next) {
        if (!req.userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required - multi-tenant safety violation'
            });
        }
        next();
    }



    
    // Get all abandoned carts with multi-tenant safety
    async getAbandonedCarts(req, res) {
        try {
            // CRITICAL: Validate authentication for multi-tenant safety
            if (!req.userId) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
            }

            console.log('📋 Fetching abandoned carts for user:', req.userId);

            const { page = 1, limit = 20, status, search } = req.query;

            // CRITICAL: Build query with userId filter for multi-tenant safety
            let query = {
                userId: req.userId // STRICT: Only this user's carts
            };

            // Filter by status if provided
            if (status && status !== 'all') {
                query.status = status;
            }

            // Search functionality (within user's carts only)
            if (search) {
                query.$or = [
                    { customerName: { $regex: search, $options: 'i' } },
                    { customerEmail: { $regex: search, $options: 'i' } },
                    { cartId: { $regex: search, $options: 'i' } }
                ];
            }

            // Calculate pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Fetch abandoned carts with userId filter
            const [carts, total] = await Promise.all([
                AbandonedCartOrder.find(query)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(parseInt(limit))
                    .lean(),
                AbandonedCartOrder.countDocuments(query)
            ]);

            console.log(`✅ Found ${carts.length} abandoned carts for user ${req.userId}`);

            res.status(200).json({
                success: true,
                data: carts,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            });

        } catch (error) {
            console.error('❌ Error fetching abandoned carts:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch abandoned carts',
                message: error.message
            });
        }
    }

    // Get abandoned cart statistics with multi-tenant safety
    async getAbandonedCartStats(req, res) {
        try {
            // CRITICAL: Validate authentication for multi-tenant safety
            if (!req.userId) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
            }

            console.log('📊 Fetching abandoned cart statistics for user:', req.userId);

            const [
                totalCarts,
                todayCarts,
                recoveredCarts,
                expiredCarts
            ] = await Promise.all([
                AbandonedCartOrder.countDocuments({
                    userId: req.userId, // STRICT: Only this user's carts
                    status: 'abandoned'
                }),
                AbandonedCartOrder.countDocuments({
                    userId: req.userId, // STRICT: Only this user's carts
                    status: 'abandoned',
                    createdAt: {
                        $gte: new Date(new Date().setHours(0, 0, 0, 0))
                    }
                }),
                AbandonedCartOrder.countDocuments({
                    userId: req.userId, // STRICT: Only this user's carts
                    status: 'recovered'
                }),
                AbandonedCartOrder.countDocuments({
                    userId: req.userId, // STRICT: Only this user's carts
                    status: 'expired'
                })
            ]);

            const stats = {
                totalCarts,
                todayCarts,
                recoveredCarts,
                expiredCarts,
                pendingCarts: totalCarts,
                recoveryRate: totalCarts > 0 ? ((recoveredCarts / totalCarts) * 100).toFixed(2) : 0
            };

            console.log(`✅ Statistics calculated for user ${req.userId}`);

            res.status(200).json({
                success: true,
                data: stats
            });

        } catch (error) {
            console.error('❌ Error fetching abandoned cart statistics:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch abandoned cart statistics',
                message: error.message
            });
        }
    }
}

module.exports = new AbandonedCartOrderController();
