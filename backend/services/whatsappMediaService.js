const axios = require("axios");
const FormData = require("form-data");
const WhatsAppIntegration = require("../models/WhatsAppIntegration");

/**
 * WhatsApp Media Upload Service
 * Handles uploading images to WhatsApp Media API for template headers
 * Works directly with Cloudinary URLs - no local file operations
 */
class WhatsAppMediaService {
  /**
   * Upload image from Cloudinary URL directly to WhatsApp Media API
   * @param {string} userId - User ID
   * @param {string} imageUrl - Cloudinary or public HTTPS URL
   * @returns {Promise<string>} - Media ID from WhatsApp
   */
  async uploadImageFromUrl(userId, imageUrl) {
    try {
      console.log('�️ [WhatsApp Media] Processing image from URL:', imageUrl.substring(0, 50) + "...");
      
      // Validate URL
      if (!imageUrl || typeof imageUrl !== 'string') {
        throw new Error('Invalid image URL provided');
      }
      
      // Reject blob:// or local file paths
      if (imageUrl.startsWith('blob:') || imageUrl.startsWith('file:') || imageUrl.startsWith('/')) {
        throw new Error('Invalid image URL. Only public HTTPS URLs are allowed.');
      }
      
      // Ensure HTTPS URL
      if (!imageUrl.startsWith('http')) {
        throw new Error('Image URL must be a public HTTPS URL');
      }
      
      // Get WhatsApp integration
      const integration = await WhatsAppIntegration.findByUserIdWithToken(userId);
      if (!integration || integration.status !== "connected") {
        throw new Error("WhatsApp integration not connected");
      }

      if (!integration.phoneNumberId) {
        throw new Error("WhatsApp phone number ID missing");
      }

      // Step 1: Download image from Cloudinary
      console.log("📥 [WhatsApp Media] Downloading image from URL...");
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });

      if (!imageResponse.data) {
        throw new Error("Failed to download image from URL");
      }

      // Detect content type from response headers
      const contentType = imageResponse.headers['content-type'] || 'image/jpeg';
      const imageBuffer = Buffer.from(imageResponse.data);
      console.log(`📊 [WhatsApp Media] Image downloaded: ${imageBuffer.length} bytes, type: ${contentType}`);

      // Step 2: Upload directly to WhatsApp Media API (no local file)
      console.log("📤 [WhatsApp Media] Uploading to WhatsApp Media API...");
      
      const formData = new FormData();
      formData.append('file', imageBuffer, {
        filename: 'template-image.jpg',
        contentType: contentType
      });
      formData.append('messaging_product', 'whatsapp');

      const uploadResponse = await axios.post(
        `https://graph.facebook.com/${process.env.META_API_VERSION}/${integration.phoneNumberId}/media`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${integration.accessToken}`,
            ...formData.getHeaders()
          },
          timeout: 30000
        }
      );

      const mediaId = uploadResponse.data?.id;
      
      if (!mediaId) {
        console.error("❌ [WhatsApp Media] Upload failed:", uploadResponse.data);
        throw new Error("WhatsApp Media API did not return media ID");
      }

      console.log("✅ [WhatsApp Media] Image uploaded successfully:", mediaId);
      console.log(`📋 [WhatsApp Media] Media will expire in 24 hours`);

      return mediaId;

    } catch (error) {
      console.error("❌ [WhatsApp Media] Upload failed:", error.message);
      if (error.response?.data) {
        console.error("🔍 [WhatsApp Media] API Response:", error.response.data);
      }
      throw new Error(`Failed to upload image to WhatsApp: ${error.message}`);
    }
  }

  /**
   * Upload image buffer directly to WhatsApp Media API
   * @param {string} userId - User ID
   * @param {Buffer} imageBuffer - Image buffer
   * @param {string} filename - Filename
   * @returns {Promise<string>} - Media ID from WhatsApp
   */
  async uploadImageBuffer(userId, imageBuffer, filename = 'template-image.jpg') {
    try {
      console.log("🖼️ [WhatsApp Media] Processing image buffer:", imageBuffer.length, "bytes");

      // Get WhatsApp integration
      const integration = await WhatsAppIntegration.findByUserIdWithToken(userId);
      if (!integration || integration.status !== "connected") {
        throw new Error("WhatsApp integration not connected");
      }

      if (!integration.phoneNumberId) {
        throw new Error("WhatsApp phone number ID missing");
      }

      // Detect content type
      const contentType = 'image/jpeg'; // Default, could be detected from buffer

      // Upload to WhatsApp Media API
      console.log("📤 [WhatsApp Media] Uploading to WhatsApp Media API...");
      
      const formData = new FormData();
      formData.append('file', imageBuffer, {
        filename: filename,
        contentType: contentType
      });
      formData.append('messaging_product', 'whatsapp');

      const uploadResponse = await axios.post(
        `https://graph.facebook.com/${process.env.META_API_VERSION}/${integration.phoneNumberId}/media`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${integration.accessToken}`,
            ...formData.getHeaders()
          },
          timeout: 30000
        }
      );

      const mediaId = uploadResponse.data?.id;
      
      if (!mediaId) {
        console.error("❌ [WhatsApp Media] Upload failed:", uploadResponse.data);
        throw new Error("WhatsApp Media API did not return media ID");
      }

      console.log("✅ [WhatsApp Media] Image uploaded successfully:", mediaId);
      return mediaId;

    } catch (error) {
      console.error("❌ [WhatsApp Media] Upload failed:", error.message);
      if (error.response?.data) {
        console.error("🔍 [WhatsApp Media] API Response:", error.response.data);
      }
      throw new Error(`Failed to upload image to WhatsApp: ${error.message}`);
    }
  }

  /**
   * Check if media ID is still valid (not expired)
   * @param {string} userId - User ID
   * @param {string} mediaId - Media ID to check
   * @returns {Promise<boolean>} - True if valid, false if expired
   */
  async checkMediaValidity(userId, mediaId) {
    try {
      console.log("🔍 [WhatsApp Media] Checking media validity:", mediaId);

      const integration = await WhatsAppIntegration.findByUserIdWithToken(userId);
      if (!integration || integration.status !== "connected") {
        return false;
      }

      const response = await axios.get(
        `https://graph.facebook.com/${process.env.META_API_VERSION}/${mediaId}`,
        {
          headers: {
            'Authorization': `Bearer ${integration.accessToken}`
          },
          timeout: 10000
        }
      );

      // If we get a successful response, media is valid
      console.log("✅ [WhatsApp Media] Media is valid");
      return true;

    } catch (error) {
      if (error.response?.status === 404) {
        console.log("❌ [WhatsApp Media] Media not found or expired");
        return false;
      }
      console.error("❌ [WhatsApp Media] Error checking media:", error.message);
      return false;
    }
  }
}

module.exports = new WhatsAppMediaService();
