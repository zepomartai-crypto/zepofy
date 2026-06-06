const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    customerName: {
      type: String,
      required: true,
    },
    customerPhone: {
      type: String,
      required: true,
    },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        name: String,
        price: Number,
        quantity: {
          type: Number,
          default: 1,
        },
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "paid", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    source: {
      type: String,
      default: "whatsapp",
    },
    paymentLink: String,
    address: {
      type: String,
    },
    notes: String,
    metaOrderData: {
      type: Object, // Stores raw data from WhatsApp selection if needed
    },
    paymentMethod: {
      type: String,
      enum: ["cod", "online"],
      default: "cod"
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "refunded"],
      default: "unpaid"
    },
    metaMessageId: {
      type: String,
      unique: true,
      sparse: true // Only for WhatsApp orders
    },
    flowTriggered: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

// Virtuals for snake_case compatibility as requested
orderSchema.virtual('customer_name').get(function () { return this.customerName; });
orderSchema.virtual('customer_phone').get(function () { return this.customerPhone; });
orderSchema.virtual('amount').get(function () { return this.totalAmount; });

orderSchema.set("toJSON", { virtuals: true });
orderSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Order", orderSchema);
