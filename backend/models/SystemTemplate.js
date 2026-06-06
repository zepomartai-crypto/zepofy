const mongoose = require("mongoose");

const SystemTemplateSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ["text", "image", "media"],
        default: "text"
    },
    message: {
        type: String,
        required: true
    },
    imageUrl: {
        type: String,
        default: null
    },
    buttons: [
        {
            label: { type: String, required: true },
            actionType: { type: String, enum: ["reply", "url", "flow"], default: "reply" },
            value: { type: String } // Reply ID, URL, or Flow ID
        }
    ],
    variables: [
        {
            name: { type: String },
            defaultValue: { type: String }
        }
    ],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    // 🚩 ADDED: Support for Sub-Flow / Multi-step sequences
    steps: [
        {
            type: { type: String, enum: ["TEXT", "MEDIA", "BUTTON"], required: true },
            message: { type: String },
            imageUrl: { type: String },
            buttons: [String], // Simple array of strings for reusable buttons
            delay: { type: Number, default: 0 } // Delay in seconds after this step
        }
    ]
});

// Update timestamp on save
SystemTemplateSchema.pre('save', function () {
    this.updatedAt = new Date();
});

module.exports = mongoose.model("SystemTemplate", SystemTemplateSchema);
