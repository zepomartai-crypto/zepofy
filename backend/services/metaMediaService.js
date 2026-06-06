const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");
const WhatsAppIntegration = require("../models/WhatsAppIntegration");

/**
 * Upload a local image file to Meta Media API for sending template messages.
 * Returns the media_id (id from Meta) that must be used in header.image.id.
 */
exports.uploadImageForMessage = async (userId, localImagePath) => {
  // Get user's WhatsApp integration
  const integration = await WhatsAppIntegration.findByUserIdWithToken(userId);

  if (!integration) {
    throw new Error("No WhatsApp integration found for user");
  }

  if (integration.status !== "connected") {
    throw new Error("WhatsApp integration not connected");
  }

  if (!fs.existsSync(localImagePath)) {
    throw new Error(`Image file not found at path: ${localImagePath}`);
  }

  const form = new FormData();
  form.append("file", fs.createReadStream(localImagePath));
  // You can improve type detection based on file extension if needed
  form.append("type", "image/jpeg");
  form.append("messaging_product", "whatsapp");

  const url = `https://graph.facebook.com/${process.env.META_API_VERSION}/${integration.phoneNumberId}/media`;

  const res = await axios.post(url, form, {
    headers: {
      Authorization: `Bearer ${integration.accessToken}`,
      ...form.getHeaders(),
    },
    timeout: 30000,
  });

  const mediaId = res.data?.id;
  if (!mediaId) {
    console.error("META MEDIA UPLOAD RESPONSE (no id):", res.data);
    throw new Error("Meta media upload did not return media_id");
  }

  return mediaId;
};

/**
 * Fetch media from Meta Graph API
 * 1. Get the temporary URL for the media ID
 * 2. Download the actual media stream
 */
exports.getMedia = async (userId, mediaId) => {
  // Get user's WhatsApp integration with decrypted token
  const integration = await WhatsAppIntegration.findByUserIdWithToken(userId);

  if (!integration) {
    throw new Error("No WhatsApp integration found for user.");
  }

  if (integration.status !== "connected") {
    throw new Error("WhatsApp integration is not connected.");
  }

  const apiVersion = process.env.META_API_VERSION || "v18.0";
  const token = integration.accessToken;

  // 🛡️ VALIDATION: Media IDs from Meta are numeric strings
  if (!/^\d+$/.test(mediaId)) {
    throw new Error(`Invalid Meta Media ID format: ${mediaId}. IDs must be numeric strings.`);
  }

  // Step 1: Get the media URL from Meta
  const urlRes = await axios.get(`https://graph.facebook.com/${apiVersion}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const downloadUrl = urlRes.data?.url;
  const mimeType = urlRes.data?.mime_type;

  if (!downloadUrl) {
    throw new Error("Failed to retrieve download URL from Meta.");
  }

  // Step 2: Download the actual media content
  const response = await axios({
    method: 'get',
    url: downloadUrl,
    responseType: 'stream',
    headers: { Authorization: `Bearer ${token}` }
  });

  return {
    stream: response.data,
    mimeType: mimeType || 'application/octet-stream'
  };
};
