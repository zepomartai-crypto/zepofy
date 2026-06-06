require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const seedAdmin = async () => {
    try {
        const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/wauto";
        await mongoose.connect(mongoUri);
        console.log("Connected to MongoDB for seeding...");

        const adminEmail = "admin@wauto.com";
        const adminPassword = "SuperSecretAdminPath123!"; // User should change this ASAP

        const adminExists = await User.findOne({ email: adminEmail });
        if (adminExists) {
            console.log("Admin already exists. Updating role to superadmin...");
            adminExists.role = "superadmin";
            await adminExists.save();
            console.log("Admin updated successfully.");
            process.exit(0);
        }

        const hashed = await bcrypt.hash(adminPassword, 10);
        const admin = new User({
            name: "Super Admin",
            email: adminEmail,
            password: hashed,
            role: "superadmin",
            status: "ACTIVE"
        });

        await admin.save();
        console.log("==========================================");
        console.log("SUPER_ADMIN CREATED SUCCESSFULLY");
        console.log("Email:", adminEmail);
        console.log("Password:", adminPassword);
        console.log("==========================================");

        process.exit(0);
    } catch (err) {
        console.error("Seed error:", err);
        process.exit(1);
    }
};

seedAdmin();
