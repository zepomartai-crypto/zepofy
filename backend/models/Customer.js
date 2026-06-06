const mongoose = require("mongoose");

const CustomerSchema = new mongoose.Schema(
  {
    name: String,
    phone: String,
    avatar: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Customer", CustomerSchema);
