const mongoose = require("mongoose");

const TagSchema = new mongoose.Schema({
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
  color: {
    type: String,
    default: "#3b82f6", // Default blue
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Ensure unique tags per user
TagSchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Tag", TagSchema);
