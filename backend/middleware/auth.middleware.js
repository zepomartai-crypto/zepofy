// Authentication Middleware for Multi-Tenant Safety
// Ensures req.userId is always set for authenticated requests

const jwt = require('jsonwebtoken');
const User = require('../models/User');

class AuthMiddleware {
    constructor() {
        this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    }

    // CRITICAL: Verify JWT token and set req.userId
    verifyToken = async (req, res, next) => {
        try {
            // Get token from Authorization header
            const authHeader = req.headers.authorization;

            if (!authHeader) {
                console.log('❌ Missing Authorization header');
                return res.status(401).json({
                    success: false,
                    error: 'Authorization required - Please login to access this resource'
                });
            }

            // Extract token from "Bearer token" format
            const token = authHeader.split(' ')[1];

            if (!token) {
                console.log('❌ Missing token in Authorization header');
                return res.status(401).json({
                    success: false,
                    error: 'Token required - Please provide a valid authentication token'
                });
            }

            // Verify JWT token
            const decoded = jwt.verify(token, this.jwtSecret);

            if (!decoded || !decoded.userId) {
                console.log('❌ Invalid token structure - missing userId');
                return res.status(401).json({
                    success: false,
                    error: 'Invalid token - Token must contain userId'
                });
            }

            // 🔐 DB SECURITY CHECK (Ensure User is Active & Not Blocked)
            const user = await User.findById(decoded.userId).select('status blocked isBlocked blockType blockUntil forceLogout role blockReason plan accountExpiry permissions');

            if (!user) {
                return res.status(401).json({ success: false, error: 'User no longer exists' });
            }

            if (user.forceLogout) {
                console.log(`🚫 User ${user._id} force logged out`);
                return res.status(401).json({ success: false, error: 'Session invalidated. Please login again.' });
            }

            // console.log(`🔍 [AUTH_MW] User: ${user._id}, Role: ${user.role}, Status: ${user.status}, IsBlocked: ${user.isBlocked || user.blocked}`);

            const isSuperAdmin = user.role === 'superadmin' || user.role === 'SUPER_ADMIN';

            // 💳 1. SUBSCRIPTION EXPIRY CHECK (Exempt SuperAdmins)
            if (!isSuperAdmin && user.accountExpiry && new Date() > new Date(user.accountExpiry)) {
                console.log(`💳 User ${user._id} subscription expired on ${user.accountExpiry}`);
                return res.status(403).json({
                    success: false, 
                    error: 'Your subscription has expired. Please upgrade your plan to continue.',
                    code: "SUBSCRIPTION_EXPIRED"
                });
            }

            // 🚫 2. INACTIVE STATUS CHECK (Exempt SuperAdmins)
            const normalizedStatus = user.status?.toUpperCase();
            if (normalizedStatus === 'INACTIVE' && !isSuperAdmin) {
                console.log(`🚫 User ${user._id} is INACTIVE. Blocking access.`);
                return res.status(403).json({
                    success: false,
                    error: 'Your account is currently inactive. Please contact support.',
                    code: "ACCOUNT_INACTIVE"
                });
            }

            // Check blocking status (Exempt SuperAdmins)
            const isBlockedStatus = ['TEMP_BLOCKED', 'PERMANENT_BLOCKED', 'BLOCKED'].includes(normalizedStatus);
            if ((user.isBlocked || user.blocked || isBlockedStatus) && !isSuperAdmin) {
                // Check expiry for detailed blocking logic
                if (user.blockType === 'TEMPORARY' && user.blockUntil && new Date() > new Date(user.blockUntil)) {
                    // Auto unblock logic (update DB)
                    user.isBlocked = false;
                    user.blocked = false;
                    user.status = 'ACTIVE';
                    user.blockType = null;
                    user.blockUntil = null;
                    user.blockReason = null;
                    user.blockedBy = null;
                    await user.save();
                    console.log(`🔓 [AUTH_MW] User ${user._id} auto-unblocked (expiry passed)`);
                } else {
                    const reason = user.blockReason || "Contact support";
                    console.log(`🚫 Blocked user ${user._id} attempted access. Reason: ${reason}, Status: ${user.status}`);
                    return res.status(403).json({
                        success: false,
                        error: 'Account is blocked: ' + reason,
                        code: "ACCOUNT_BLOCKED",
                        blockUntil: user.blockUntil
                    });
                }
            }

            // CRITICAL: Set req.userId for multi-tenant safety
            req.userId = decoded.userId;
            req.user = decoded; // Keep token data
            req.user.role = user.role; // Enforce latest DB role
            req.user.permissions = user.permissions || {}; // Attach permissions

            // console.log('✅ Authentication successful - User:', req.userId);
            next();

        } catch (error) {
            console.error('❌ Authentication error:', error.message);

            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid token - Please login again'
                });
            }

            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    error: 'Token expired - Please login again'
                });
            }

            return res.status(500).json({
                success: false,
                error: 'Authentication failed - Please try again'
            });
        }
    }

    // Optional: Extract userId from session cookie (alternative to JWT)
    verifySession = (req, res, next) => {
        try {
            // Check if session exists and has userId
            if (!req.session || !req.session.userId) {
                console.log('❌ No valid session found');
                return res.status(401).json({
                    success: false,
                    error: 'Session required - Please login to access this resource'
                });
            }

            // CRITICAL: Set req.userId for multi-tenant safety
            req.userId = req.session.userId;

            // console.log('✅ Session authentication successful - User:', req.userId);
            next();

        } catch (error) {
            console.error('❌ Session authentication error:', error.message);
            return res.status(500).json({
                success: false,
                error: 'Session authentication failed'
            });
        }
    }

    // CRITICAL: Middleware to validate userId exists (defensive check)
    validateUserId = (req, res, next) => {
        if (!req.userId) {
            console.error('❌ MULTI-TENANT SAFETY VIOLATION: req.userId is missing');
            return res.status(401).json({
                success: false,
                error: 'Authentication required - Multi-tenant safety violation'
            });
        }
        next();
    }

    // SUPER ADMIN MIDDLEWARE
    isSuperAdmin = (req, res, next) => {
        if (!req.user || (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'superadmin')) {
            console.warn(`⚠️ Access Denied: User ${req.userId} (Role: ${req.user?.role}) attempted to access Super Admin resource.`);
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Super Admin access required'
            });
        }
        console.log(`✅ Super Admin access granted for User ${req.userId}`);
        next();
    }

    // REGULAR USER MIDDLEWARE
    isUser = (req, res, next) => {
        if (!req.user || req.user.role !== 'USER') {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Regular User access required'
            });
        }
        next();
    }

    // MODULAR PERMISSION MIDDLEWARE
    checkPermission = (permission) => {
        return (req, res, next) => {
            // Super admins have all permissions
            if (req.user && (req.user.role === 'SUPER_ADMIN' || req.user.role === 'superadmin')) {
                return next();
            }

            if (!req.user || !req.user.permissions || req.user.permissions[permission] === false) {
                console.warn(`⚠️ Access Denied: User ${req.userId} lacks permission: ${permission}`);
                return res.status(403).json({
                    success: false,
                    error: `Access Denied: You do not have permission to access ${permission}`,
                    code: "PERMISSION_DENIED"
                });
            }
            next();
        };
    }
}

module.exports = new AuthMiddleware();
