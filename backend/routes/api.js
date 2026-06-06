const express = require('express');
const router = express.Router();
const whatsappService = require('../services/whatsappService');
const auth = require('../middleware/auth');

router.post("/send", auth, async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ error: "Phone and message required" });
    const result = await whatsappService.sendTextMessage(phone, message);
    res.json({ success: true, message: "Message sent", data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.response?.data || err.message });
  }
});

module.exports = router;
