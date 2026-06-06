const mongoose = require("mongoose");

const OtpVerificationSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: true,
        index: true
    },
    hashedOtp: { // Changed from otpCode to match request
        type: String,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 } // Auto-delete documents after expiry (TTL index)
    },
    attempts: {
        type: Number,
        default: 0
    },
    type: {
        type: String,
        enum: ['register', 'login'],
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model("OtpVerification", OtpVerificationSchema);
