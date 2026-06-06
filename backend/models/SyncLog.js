const mongoose = require("mongoose");

const syncLogSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
        },
        sku: String,
        productName: String,
        operation: {
            type: String,
            enum: ["create", "update", "delete", "bulk_sync"],
            required: true,
        },
        status: {
            type: String,
            enum: ["pending", "success", "error", "warning"],
            required: true,
        },
        message: String,
        details: Object, // Stores Meta API response or error object
        timestamp: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("SyncLog", syncLogSchema);
