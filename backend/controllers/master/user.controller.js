const User = require("../../models/User");
const bcrypt = require("bcryptjs");
const AdminLog = require("../../models/AdminLog");
const Template = require("../../models/Template");
const Campaign = require("../../models/Campaign");
const WooCommerceIntegration = require("../../models/WooCommerceIntegration");
const WhatsAppIntegration = require("../../models/WhatsAppIntegration");
const ShopifyIntegration = require("../../models/ShopifyIntegration");
const MetaIntegration = require("../../models/MetaIntegration");
const AIIntegration = require("../../models/AIIntegration");
const SystemLog = require("../../models/SystemLog");
const jwt = require("jsonwebtoken");

// 🔥 Enhanced User Management API
exports.getAllUsers = async (req, res) => {
    try {
        console.log('👥 [MASTER] Fetching all users with detailed counts');

        const users = await User.find({ role: "user" })
            .select("-password")
            .sort({ createdAt: -1 })
            .lean();

        // Enrich users with detailed counts and integration info
        const enrichedUsers = await Promise.all(users.map(async (user) => {
            const [
                templateCount,
                campaignCount,
                wooCommerceIntegration,
                whatsappIntegration,
                shopifyIntegration,
                metaIntegration,
                aiIntegration
            ] = await Promise.all([
                Template.countDocuments({ userId: user._id }),
                Campaign.countDocuments({ userId: user._id }),
                WooCommerceIntegration.findOne({ userId: user._id }).lean(),
                WhatsAppIntegration.findOne({ userId: user._id }).lean(),
                ShopifyIntegration.findOne({ userId: user._id }).lean(),
                MetaIntegration.findOne({ userId: user._id }).lean(),
                AIIntegration.findOne({ userId: user._id }).select('+apiKey').lean()
            ]);

            const hasWooCommerce = wooCommerceIntegration?.status === 'connected';
            const hasWhatsApp = whatsappIntegration?.status === 'connected';
            const hasShopify = shopifyIntegration?.status === 'connected' || !!shopifyIntegration;
            const hasFacebookInstagram = metaIntegration?.isActive === true;
            const hasAiBot = !!aiIntegration && !!aiIntegration.apiKey;
            
            // Integration Status should be based on BOTH actual connection and Super Admin permission
            const wooAllowed = user.integrations?.woocommerce?.enabled !== false;
            const waAllowed = user.integrations?.whatsapp?.enabled !== false;
            const shopifyAllowed = user.integrations?.shopify?.enabled !== false;

            const integrationCount = (hasWooCommerce ? 1 : 0) + (hasWhatsApp ? 1 : 0) + (shopifyIntegration ? 1 : 0);

            // Determine proper status
            let userStatus = 'ACTIVE';
            if (user.blocked) {
                userStatus = user.blockType === 'PERMANENT' ? 'PERMANENT_BLOCKED' : 'TEMP_BLOCKED';
            } else if (user.status === 'INACTIVE') {
                userStatus = 'INACTIVE';
            }

            return {
                ...user,
                templateCount,
                campaignCount,
                integrationCount,
                hasWooCommerce,
                hasWhatsApp,
                hasShopify: !!shopifyIntegration,
                hasFacebookInstagram,
                hasAiBot,
                integrationStatus: integrationCount > 0 ? "ACTIVE" : "INACTIVE",
                derivation: {
                    woo: { connected: hasWooCommerce, allowed: wooAllowed },
                    wa: { connected: hasWhatsApp, allowed: waAllowed },
                    shopify: { connected: !!shopifyIntegration, allowed: shopifyAllowed }
                },
                plan: user.plan || 'basic',
                lastLogin: user.lastLogin || null,
                status: userStatus,
                blocked: user.blocked || false,
                blockType: user.blockType || null,
                blockReason: user.blockReason || null,
                blockExpiresAt: user.blockExpiresAt || null,
                accountExpiry: user.accountExpiry || null
            };
        }));

        console.log(`✅ [MASTER] Retrieved ${enrichedUsers.length} users with detailed info`);

        res.json({
            success: true,
            data: {
                users: enrichedUsers,
                total: enrichedUsers.length
            }
        });

    } catch (error) {
        console.error('❌ [MASTER] Error fetching users:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch users'
        });
    }
};

// 🔥 Update User Status (ACTIVE/INACTIVE)
exports.updateUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Validate status - use uppercase values to match User model
        const validStatuses = ['ACTIVE', 'INACTIVE'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status. Must be: ACTIVE or INACTIVE'
            });
        }

        console.log(`🔧 [MASTER] Updating user ${id} status to: ${status}`);

        // Check if user is blocked first
        const userCheck = await User.findById(id);
        if (!userCheck) return res.status(404).json({ success: false, error: 'User not found' });

        if (userCheck.blocked || ['TEMP_BLOCKED', 'PERMANENT_BLOCKED'].includes(userCheck.status)) {
            return res.status(400).json({
                success: false,
                error: 'Cannot change status of a blocked user. Unblock first.'
            });
        }

        // Find and update user
        const user = await User.findByIdAndUpdate(
            id,
            { status },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Log the action
        await AdminLog.create({
            adminId: req.userId,
            action: `UPDATE_STATUS_${status}`,
            targetUserId: id,
            ip: req.ip,
            details: `Changed user status to ${status}`
        });

        console.log(`✅ [MASTER] User ${id} status updated to: ${status}`);

        res.json({
            success: true,
            data: user,
            message: `User status updated to ${status}`
        });

    } catch (error) {
        console.error('❌ [MASTER] Error updating user status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update user status'
        });
    }
};

// 🔥 Block/Unblock User (Advanced Blocking System)
exports.updateUserBlock = async (req, res) => {
    try {
        const { id } = req.params;
        const { blocked, blockType, blockDuration, blockReason } = req.body;

        console.log(`🚫 [MASTER] ${blocked ? 'Blocking' : 'Unblocking'} user: ${id}, type: ${blockType}`);

        // Find user
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        let updateData = { blocked };
        let newStatus = user.status;

        if (blocked) {
            // Blocking user
            updateData.isBlocked = true;
            updateData.blocked = true;
            updateData.forceLogout = true; // Force logout immediately
            updateData.sessionToken = null; // Invalidate session

            if (blockType === 'TEMPORARY') {
                const blockUntil = new Date();
                blockUntil.setHours(blockUntil.getHours() + (blockDuration || 24)); // Default 24 hours
                updateData = {
                    ...updateData,
                    status: 'TEMP_BLOCKED',
                    blockUntil,
                    blockReason: blockReason || 'Temporary block by admin',
                    blockedBy: req.userId
                };
                newStatus = 'TEMP_BLOCKED';
            } else if (blockType === 'PERMANENT') {
                updateData = {
                    ...updateData,
                    status: 'PERMANENT_BLOCKED',
                    blockUntil: null,
                    blockReason: blockReason || 'Permanent block by admin',
                    blockedBy: req.userId
                };
                newStatus = 'PERMANENT_BLOCKED';
            } else {
                // Legacy blocking - just set blocked flag
                updateData.blockReason = blockReason || 'Blocked by admin';
                updateData.blockedBy = req.userId;
            }
        } else {
            // Unblocking user - restore to ACTIVE if was blocked
            updateData.isBlocked = false;
            updateData.blocked = false;

            if (['TEMP_BLOCKED', 'PERMANENT_BLOCKED'].includes(user.status)) {
                updateData.status = 'ACTIVE';
                updateData.blockUntil = null;
                updateData.blockReason = null;
                updateData.blockedBy = null;
                newStatus = 'ACTIVE';
            }
        }

        // Update user
        const updatedUser = await User.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        // Log the action
        await AdminLog.create({
            adminId: req.userId,
            action: blocked ? (blockType === 'TEMPORARY' ? 'TEMP_BLOCK_USER' : blockType === 'PERMANENT' ? 'PERMANENT_BLOCK_USER' : 'BLOCK_USER') : 'UNBLOCK_USER',
            targetUserId: id,
            ip: req.ip,
            details: `${blocked ? 'Blocked' : 'Unblocked'} user account${blockType ? ` (${blockType})` : ''}${blockReason ? ` - Reason: ${blockReason}` : ''}`
        });

        console.log(`✅ [MASTER] User ${id} ${blocked ? 'blocked' : 'unblocked'} with status: ${newStatus}`);

        res.json({
            success: true,
            data: updatedUser,
            message: `User ${blocked ? 'blocked' : 'unblocked'} successfully`
        });

    } catch (error) {
        console.error('❌ [MASTER] Error updating user block status:', error.message, error.stack);
        res.status(500).json({
            success: false,
            error: 'Failed to update user block status: ' + error.message
        });
    }
};

// 🔥 Reset User Password
exports.resetUserPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        console.log(`🔐 [MASTER] Resetting password for user: ${id}`);

        // Find user
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Generate new password if not provided
        let finalPassword = newPassword;
        if (!finalPassword) {
            // Generate random password
            finalPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase();
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(finalPassword, salt);

        // Update user password & force logout
        const updatedUser = await User.findByIdAndUpdate(id, {
            password: hashedPassword,
            passwordResetAt: new Date(),
            forceLogout: true, // Forces immediate logout
            forceLogoutAt: new Date(),
            sessionToken: null
        }, { new: true, runValidators: true }); // Ensure validators are run, though we relaxed enum

        // Log the action
        const adminId = req.userId; // Extracted from token
        await AdminLog.create({
            adminId: adminId,
            action: 'RESET_PASSWORD',
            targetUserId: id,
            ip: req.ip,
            details: 'Password reset by Super Admin'
        });

        console.log(`✅ [MASTER] Password reset for user: ${id}`);

        res.json({
            success: true,
            data: {
                newPassword: finalPassword
            },
            message: 'Password reset successfully'
        });

    } catch (error) {
        console.error('❌ [MASTER] Error resetting user password:', error.message, error.stack);
        res.status(500).json({
            success: false,
            error: 'Failed to reset user password: ' + error.message
        });
    }
};

// 🔥 Delete User
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        console.log(`🗑️ [MASTER] Deleting user: ${id}`);

        // Find user
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Delete user's related data (optional - uncomment if needed)
        // await Promise.all([
        //     Template.deleteMany({ userId: id }),
        //     Campaign.deleteMany({ userId: id }),
        //     WooCommerceIntegration.deleteMany({ userId: id }),
        //     WhatsAppIntegration.deleteMany({ userId: id })
        // ]);

        // Delete user
        await User.findByIdAndDelete(id);

        // Log the action
        await AdminLog.create({
            adminId: req.user._id,
            action: 'DELETE_USER',
            targetUserId: id,
            ip: req.ip,
            details: `Deleted user: ${user.name} (${user.email})`
        });

        console.log(`✅ [MASTER] User deleted: ${id}`);

        res.json({
            success: true,
            message: 'User deleted successfully'
        });

    } catch (error) {
        console.error('❌ [MASTER] Error deleting user:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete user'
        });
    }
};

// 🔥 Get Single User (Detailed)
exports.getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`👤 [MASTER] Fetching user details: ${id}`);

        const user = await User.findById(id)
            .select("-password")
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Get additional details
        const [
            templateCount,
            campaignCount,
            wooCommerceIntegration,
            whatsappIntegration,
            shopifyIntegration,
            metaIntegration,
            aiIntegration,
            recentLogs
        ] = await Promise.all([
            Template.countDocuments({ userId: user._id }),
            Campaign.countDocuments({ userId: user._id }),
            WooCommerceIntegration.findOne({ userId: user._id }).lean(),
            WhatsAppIntegration.findOne({ userId: user._id }).lean(),
            ShopifyIntegration.findOne({ userId: user._id }).lean(),
            MetaIntegration.findOne({ userId: user._id }).lean(),
            AIIntegration.findOne({ userId: user._id }).select('+apiKey').lean(),
            AdminLog.find({ targetUserId: user._id })
                .sort({ createdAt: -1 })
                .limit(10)
                .lean()
        ]);

        const userDetails = {
            ...user,
            templateCount,
            campaignCount,
            hasWooCommerce: wooCommerceIntegration?.status === 'connected',
            hasWhatsApp: whatsappIntegration?.status === 'connected',
            hasShopify: !!shopifyIntegration,
            hasFacebookInstagram: metaIntegration?.isActive === true,
            hasAiBot: !!aiIntegration && !!aiIntegration.apiKey,
            wooCommerceDetails: wooCommerceIntegration,
            whatsappDetails: whatsappIntegration,
            shopifyDetails: shopifyIntegration,
            recentLogs, // Includes login history if logged as AdminLog (or we should query SystemLog/User.lastLogin)
            // Note: User model has lastLogin. AdminLog has admin actions.
            // If we want login history specifically, we might need a LoginLog or filter AdminLog/SystemLog.
            // For now, returning AdminLogs (actions on user) is good.
            plan: user.plan || 'basic',
            accountExpiry: user.accountExpiry || null,
            lastLogin: user.lastLogin || null
        };

        console.log(`✅ [MASTER] User details fetched for: ${user.email}`);

        res.json({
            success: true,
            data: userDetails
        });

    } catch (error) {
        console.error('❌ [MASTER] Error fetching user details:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user details'
        });
    }
};
exports.getActiveTenants = async (req, res) => {
    try {
        console.log('🏢 [MASTER] Fetching active tenants');

        const activeTenants = await User.find({
            role: "user",
            status: "ACTIVE",
            blocked: false
        })
            .select("-password")
            .sort({ createdAt: -1 })
            .lean();

        console.log(`✅ [MASTER] Retrieved ${activeTenants.length} active tenants`);

        res.json({
            success: true,
            data: activeTenants
        });

    } catch (error) {
        console.error('❌ [MASTER] Error fetching active tenants:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch active tenants'
        });
    }
};

// 🔥 Create User (for existing route compatibility)
exports.createUser = async (req, res) => {
    try {
        const { name, email, password, plan = 'FREE' } = req.body;

        console.log('➕ [MASTER] Creating new user:', { name, email, plan });

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'User with this email already exists'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const newUser = await User.create({
            name,
            email,
            password: hashedPassword,
            role: 'user',
            status: 'ACTIVE',
            blocked: false,
            plan
        });

        // Log the action
        await AdminLog.create({
            adminId: req.userId,
            action: 'CREATE_USER',
            targetUserId: newUser._id,
            ip: req.ip,
            details: `Created user: ${name} (${email})`
        });

        console.log(`✅ [MASTER] User created: ${newUser._id}`);

        res.status(201).json({
            success: true,
            data: {
                _id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                status: newUser.status,
                blocked: newUser.blocked,
                plan: newUser.plan,
                createdAt: newUser.createdAt
            },
            message: 'User created successfully'
        });

    } catch (error) {
        console.error('❌ [MASTER] Error creating user:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create user'
        });
    }
};



// 🔥 NEW: Force Logout User
exports.forceLogoutUser = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🚪 [MASTER] Force logging out user: ${id}`);

        const user = await User.findByIdAndUpdate(
            id,
            {
                lastLogin: null,
                sessionToken: null,
                forceLogout: true,
                forceLogoutAt: new Date()
            },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        await AdminLog.create({
            adminId: req.userId,
            action: `FORCE_LOGOUT`,
            targetUserId: id,
            ip: req.ip,
            details: `User ${user.email} force logged out by Super Admin`
        });

        console.log(`✅ [MASTER] User force logged out: ${user.email}`);

        res.json({
            success: true,
            message: 'User force logged out successfully',
            data: user
        });

    } catch (error) {
        console.error('❌ [MASTER] Error force logging out user:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to force logout user'
        });
    }
};

// 🔥 NEW: Update User Plan
exports.updateUserPlan = async (req, res) => {
    try {
        const { id } = req.params;
        const { plan, expiryDate } = req.body;
        console.log(`📋 [MASTER] Updating user plan: ${id} to ${plan}`);

        const validPlans = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE', 'basic', 'pro', 'enterprise'];
        // Supporting both old and new plan enums temporarily
        
        const updateData = { plan: plan.toUpperCase() };
        if (expiryDate) {
            updateData.accountExpiry = new Date(expiryDate);
        }

        const user = await User.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        await AdminLog.create({
            adminId: req.userId,
            action: `UPDATE_PLAN`,
            targetUserId: id,
            ip: req.ip,
            details: `Plan updated to ${plan}`
        });

        console.log(`✅ [MASTER] User plan updated: ${user.email} -> ${plan}`);

        res.json({
            success: true,
            message: 'User plan updated successfully',
            data: user
        });

    } catch (error) {
        console.error('❌ [MASTER] Error updating user plan:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update user plan'
        });
    }
};

// 🔥 NEW: Update User Limits & Integrations
exports.updateUserLimits = async (req, res) => {
    try {
        const { id } = req.params;
        const { limits, integrations } = req.body;
        
        console.log(`⚖️ [MASTER] Updating limits/integrations for user: ${id}`);

        const updateData = {};
        if (limits) updateData.limits = limits;
        if (integrations) updateData.integrations = integrations;

        const user = await User.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        await AdminLog.create({
            adminId: req.userId,
            action: `UPDATE_USER_LIMITS`,
            targetUserId: id,
            ip: req.ip,
            details: `Updated resource limits and integration permissions`
        });

        res.json({
            success: true,
            message: 'User limits and permissions updated successfully',
            data: user
        });
    } catch (error) {
        console.error('❌ [MASTER] Error updating user limits:', error);
        res.status(500).json({ success: false, error: 'Failed to update user limits' });
    }
};

// 🔥 Update Profile
exports.updateProfile = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password, salt);
        }

        const user = await User.findByIdAndUpdate(req.userId, updateData, { new: true }).select("-password");

        // Log profile update
        await AdminLog.create({
            adminId: req.userId,
            action: 'UPDATE_PROFILE',
            ip: req.ip,
            details: 'Super Admin updated their profile'
        });

        res.json({ success: true, data: user });
    } catch (err) {
        console.error("Profile Update Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
};

// 🔥 NEW: Impersonate User (Login As)
exports.impersonateUser = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🎭 [MASTER] Impersonating user: ${id}`);

        const user = await User.findById(id).lean();
        if (!user) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        if (user.role === 'superadmin') {
            return res.status(403).json({ success: false, error: "Cannot impersonate a Super Admin" });
        }

        // Generate JWT token for the user
        const token = jwt.sign(
            { userId: user._id, role: user.role, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        // Security Log
        await AdminLog.create({
            adminId: req.userId,
            action: 'IMPERSONATE_USER',
            targetUserId: user._id,
            ip: req.ip,
            details: `Super Admin impersonated user: ${user.email}`
        });

        console.log(`✅ [MASTER] Impersonation successful for: ${user.email}`);

        res.json({
            success: true,
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status,
                plan: user.plan
            }
        });

    } catch (err) {
        console.error("❌ [MASTER] Impersonation Error:", err);
        res.status(500).json({ success: false, error: "Impersonation failed" });
    }
};
