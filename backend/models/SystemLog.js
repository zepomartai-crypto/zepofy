const mongoose = require("mongoose");

const SystemLogSchema = new mongoose.Schema({
    type: { type: String, enum: ['error', 'info', 'warning'], default: 'info' },
    message: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    details: Object,
    ip: String,
    metadata: Object
}, { timestamps: true });

module.exports = mongoose.model("SystemLog", SystemLogSchema);
