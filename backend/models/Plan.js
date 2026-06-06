const mongoose = require('mongoose');

const PlanSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        uppercase: true
    },
    label: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        default: 0
    },
    duration: {
        type: Number,
        default: 30
    },
    billingCycle: {
        type: String,
        enum: ['monthly', 'yearly'],
        default: 'monthly'
    },
    features: [String],
    limits: {
        templateLimit: { type: Number, default: 0 },
        campaignLimit: { type: Number, default: 0 },
        contactLimit: { type: Number, default: 0 },
        messageLimit: { type: Number, default: 0 },
        apiLimit: { type: Number, default: 0 }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    recommended: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('Plan', PlanSchema);
