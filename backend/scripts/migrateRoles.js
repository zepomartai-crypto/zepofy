const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const User = require("../models/User");
const userStatusService = require("../services/userStatusService");

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB for migration...");

        // 1. Update roles to lowercase 'superadmin'
        const users = await User.find({});
        for (let user of users) {
            let newRole = user.role.toLowerCase();
            if (newRole === 'super_admin') newRole = 'superadmin';
            if (newRole === 'user') newRole = 'user';
            if (newRole === 'admin') newRole = 'admin';

            user.role = newRole;
            await user.save();

            // 2. Sync status based on integrations
            await userStatusService.updateUserIntegrationStatus(user._id);
        }

        console.log(`✅ Migrated ${users.length} users successfully to role: superadmin/user/admin`);
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

migrate();
