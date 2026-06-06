const checkSuperAdmin = (req, res, next) => {
    const normalizedRole = req.user?.role?.toLowerCase().replace('_', '');
    if (!req.user || normalizedRole !== 'superadmin') {
        console.warn(`🚨 Access Denied: User ${req.user?.email || 'Unknown'} (Role: ${req.user?.role}) attempted to access Super Admin route.`);
        return res.status(403).json({
            success: false,
            message: 'Access denied: Super Admin privilege required'
        });
    }
    next();
};

module.exports = checkSuperAdmin;
