const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
    imageUrl: {
      type: String,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    googleCategory: {
      type: String,
      default: "OT",
      trim: true,
    },
    stock: {
      type: Number,
      default: 0,
    },
    sku: {
      type: String, // Maps to retailer_id in Meta
      required: true,
    },
    metaProductId: {
      type: String, // The ID returned by Meta after sync
    },
    metaProductSetId: {
      type: String, // For connecting with Meta Product Sets
    },
    status: {
      type: String,
      enum: ["active", "inactive", "archived"],
      default: "active",
    },
    metaStatus: {
      type: String,
      enum: ["approved", "pending", "rejected", "none"],
      default: "none",
    },
    lastStatusCheck: Date,
    syncStatus: {
      type: String,
      enum: ["not_synced", "synced", "error", "failed"],
      default: "not_synced",
    },
    lastSyncAt: Date,
    syncError: String,
  },
  { timestamps: true }
);

// Index for faster lookups
productSchema.index({ userId: 1, sku: 1 }, { unique: true });

module.exports = mongoose.model("Product", productSchema);
