const mongoose = require("mongoose");

const AdminLogSchema = new mongoose.Schema({
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    details: Object,
    ip: String
}, { timestamps: true });

module.exports = mongoose.model("AdminLog", AdminLogSchema);
