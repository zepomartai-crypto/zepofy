const express = require("express");
const router = express.Router();
const User = require("../models/User");
const WhatsAppIntegration = require("../models/WhatsAppIntegration");
const auth = require("../middleware/auth");
const mongoose = require("mongoose");

// Middleware to validate ObjectId for userId parameter
const validateUserId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
    return res.status(400).json({ error: "Invalid User ID format" });
  }
  next();
};

/**
 * 📱 Get WABA Numbers 
 */
router.get("/numbers", auth, async (req, res) => {
  try {
    const integration = await WhatsAppIntegration.findOne({ userId: req.userId });
    if (!integration || integration.status !== 'connected') return res.json([]);

    const numberObj = {
      id: integration.phoneNumberId,
      display_phone_number: integration.businessPhoneNumber,
      status: integration.status
    };
    res.json([numberObj]); // Campaigns.jsx expects array
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/phone-numbers", auth, async (req, res) => {
  try {
    const integration = await WhatsAppIntegration.findOne({ userId: req.userId });
    if (!integration || integration.status !== 'connected') return res.json({ phoneNumbers: [] });

    const numberObj = {
      id: integration.phoneNumberId,
      display_phone_number: integration.businessPhoneNumber,
      status: integration.status
    };
    res.json({ phoneNumbers: [numberObj] }); // CampaignForm.jsx expects { phoneNumbers: [] }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 💾 Save WABA Info
 */
router.post("/save", auth, async (req, res) => {
  try {
    const userId = req.userId; // Use authenticated user ID
    const { waba } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        waba_connected: true,
        ...waba
      },
      { new: true }
    );

    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 📊 Get WABA Dashboard Info
 * GET /api/waba/:userId
 */
router.get("/:userId", auth, validateUserId, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
