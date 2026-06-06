const mongoose = require("mongoose");

const SystemSettingsSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true }, // e.g. 'maintenance'
    value: mongoose.Schema.Types.Mixed,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, {
    timestamps: true,
    collection: 'system_settings'
});

module.exports = mongoose.model("SystemSettings", SystemSettingsSchema);
