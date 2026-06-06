const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
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
    metaCategoryId: {
      type: String, // Maps to Meta Product Set ID
    },
    isSynced: {
      type: Boolean,
      default: false,
    },
    syncStatus: {
      type: String,
      enum: ["none", "synced", "error"],
      default: "none",
    },
  },
  { timestamps: true }
);

categorySchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Category", categorySchema);
