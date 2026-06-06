const User = require('../models/User');
const jwt = require('jsonwebtoken');

/**
 * 🔥 Super Admin Access Control Middleware
 * Only allows SUPER_ADMIN role to access protected routes
 */
const requireSuperAdmin = async (req, res, next) => {
    try {
        console.log('🔐 [ROLE] Checking Super Admin access');

        // Get token from header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Access token required'
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from database
        const user = await User.findById(decoded.userId).select('role status');

        console.log('🔍 [ROLE] User fetched from DB:', JSON.stringify(user, null, 2));

        if (!user) {
            console.log('❌ [ROLE] User not found in database');
            return res.status(401).json({
                success: false,
                error: 'User not found'
            });
        }

        // Check if user has SUPER_ADMIN role first
        console.log(`🔍 [ROLE] Checking user role: ${user.role}`);

        if (user.role !== 'superadmin' && user.role !== 'SUPER_ADMIN') {
            // If not Super Admin, deny access
            console.log(`❌ [ROLE] Access denied. User role: ${user.role}`);
            return res.status(403).json({
                success: false,
                error: 'Super Admin access required'
            });
        }

        // Super Admin access granted - bypass all checks
        console.log(`✅ [ROLE] Master access granted to: ${user.email || user._id}`);
        console.log(`✅ [ROLE] Super Admin bypassed all restrictions`);

        // Add user to request object
        req.user = user;
        req.userId = user._id;

        console.log('✅ [ROLE] Super Admin access granted');
        next();

    } catch (error) {
        console.error('❌ [ROLE] Super Admin middleware error:', error);

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Invalid token'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expired'
            });
        }

        return res.status(500).json({
            success: false,
            error: 'Authentication failed'
        });
    }
};

/**
 * 🔥 Admin or Super Admin Access Control Middleware
 * Allows ADMIN and SUPER_ADMIN roles
 */
const requireAdmin = async (req, res, next) => {
    try {
        console.log('🔐 [ROLE] Checking Admin access');

        // Get token from header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Access token required'
            });
        }

        const token = authHeader.substring(7);

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from database
        const user = await User.findById(decoded.userId).select('role status');

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'User not found'
            });
        }

        // Check if user is active
        if (user.status !== 'active') {
            return res.status(403).json({
                success: false,
                error: 'Account is not active'
            });
        }

        // Check if user has ADMIN or SUPER_ADMIN role
        if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
            console.log(`❌ [ROLE] Access denied. User role: ${user.role}`);
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }

        // Add user to request object
        req.user = user;
        req.userId = user._id;

        console.log(`✅ [ROLE] Admin access granted. Role: ${user.role}`);
        next();

    } catch (error) {
        console.error('❌ [ROLE] Admin middleware error:', error);

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Invalid token'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expired'
            });
        }

        return res.status(500).json({
            success: false,
            error: 'Authentication failed'
        });
    }
};

/**
 * 🔥 Check if user is blocked (for API access control)
 */
const checkUserStatus = async (req, res, next) => {
    try {
        // Skip for public routes
        if (req.path.includes('/webhooks/') || req.path.includes('/public/')) {
            return next();
        }

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next(); // Let other middleware handle auth
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.userId).select('status role');

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'User not found'
            });
        }

        // Block access if user is blocked
        if (user.status === 'blocked') {
            console.log(`🚫 [STATUS] Blocked user access denied: ${user._id}`);
            return res.status(403).json({
                success: false,
                error: 'Account has been blocked. Please contact support.'
            });
        }

        // Block access if user is inactive
        if (user.status === 'inactive') {
            console.log(`⏸️ [STATUS] Inactive user access denied: ${user._id}`);
            return res.status(403).json({
                success: false,
                error: 'Account is inactive. Please contact support.'
            });
        }

        next();

    } catch (error) {
        // If token verification fails, let other middleware handle it
        next();
    }
};

module.exports = {
    requireSuperAdmin,
    requireAdmin,
    checkUserStatus
};
