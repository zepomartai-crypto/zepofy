const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const auth = require("../middleware/auth");

// Middleware to check if user is superadmin
const requireSuperAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId);
        if (!user || user.role !== 'superadmin') {
            return res.status(403).json({ error: "Access denied. Super Admin only." });
        }
        next();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ===================== USER MANAGEMENT ===================== //

// GET ALL USERS
router.get("/users", auth, requireSuperAdmin, async (req, res) => {
    try {
        const users = await User.find({}).select("-password").sort({ createdAt: -1 });
        res.json({ users });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE USER (Testing User)
router.post("/users", auth, requireSuperAdmin, async (req, res) => {
    try {
        const { name, email, phone, password, role } = req.body;

        if (!name || !email || !phone) return res.status(400).json({ error: "Name, email, and phone required" });

        const exists = await User.findOne({
            $or: [{ email }, { phoneNumber: phone }, { phone: phone }]
        });

        if (exists) return res.status(400).json({ error: "User already exists" });

        let hashedPassword = null;
        let methods = ['otp'];

        if (password) {
            hashedPassword = await bcrypt.hash(password, 10);
            methods.push('password');
            // If password provided, ensure loginMethod accounts for it
        }

        const newUser = await User.create({
            name,
            email,
            phoneNumber: phone,
            phone, // legacy
            password: hashedPassword,
            role: role || 'user',
            loginMethod: password ? 'both' : 'otp',
            phoneVerified: true, // Manually created users are verified
            isActive: true
        });

        res.json({ success: true, user: newUser });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE USER
router.put("/users/:id", auth, requireSuperAdmin, async (req, res) => {
    try {
        const { name, email, role, isActive } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) return res.status(404).json({ error: "User not found" });
        if (user.role === 'superadmin' && req.userId !== user._id.toString()) {
            return res.status(403).json({ error: "Cannot edit other superadmins" });
        }

        if (name) user.name = name;
        if (email) user.email = email;
        if (role) user.role = role;
        if (isActive !== undefined) user.isActive = isActive;

        await user.save();
        res.json({ success: true, user });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE USER
router.delete("/users/:id", auth, requireSuperAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: "User not found" });

        if (user.role === 'superadmin') {
            return res.status(403).json({ error: "Cannot delete Super Admin" });
        }

        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "User deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===================== DASHBOARD STATS ===================== //
router.get("/dashboard", auth, requireSuperAdmin, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ isActive: true });
        const adminUsers = await User.countDocuments({ role: 'admin' });

        res.json({
            totalUsers,
            activeUsers,
            adminUsers
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
