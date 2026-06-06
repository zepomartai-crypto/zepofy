const axios = require("axios");
const fs = require("fs");
const path = require("path");
const WhatsAppIntegration = require("../models/WhatsAppIntegration");

exports.uploadTemplateImage = async (userId, localImagePathOrUrl) => {
  const integration = await WhatsAppIntegration.findByUserIdWithToken(userId);

  if (!integration || integration.status !== "connected") {
    throw new Error("WhatsApp integration not connected");
  }

  if (!integration.appId) {
    throw new Error("Meta APP_ID missing");
  }

  let imageBuffer;
  let fileSize;

  if (localImagePathOrUrl.startsWith("http")) {
    console.log("📥 [Meta Upload] Downloading image from URL for template submission...");
    const response = await axios.get(localImagePathOrUrl, { responseType: 'arraybuffer' });
    imageBuffer = Buffer.from(response.data);
    fileSize = imageBuffer.length;
  } else {
    if (!fs.existsSync(localImagePathOrUrl)) {
      throw new Error(`Local image file not found: ${localImagePathOrUrl}`);
    }
    const fileStat = fs.statSync(localImagePathOrUrl);
    fileSize = fileStat.size;
    imageBuffer = fs.readFileSync(localImagePathOrUrl);
  }

  /* ===============================
     STEP 1️⃣ INIT RESUMABLE UPLOAD
  =============================== */
  const initRes = await axios.post(
    `https://graph.facebook.com/v18.0/${integration.appId}/uploads`,
    {
      file_length: fileSize,
      file_type: "image/jpeg", // Consider dynamic detection if needed
    },
    {
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  const uploadSessionId = initRes.data?.id;

  if (!uploadSessionId) {
    console.error("UPLOAD INIT FAILED:", initRes.data);
    throw new Error("Failed to init Meta upload");
  }

  /* ===============================
     STEP 2️⃣ UPLOAD IMAGE BINARY
  =============================== */
  // imageBuffer is already set above

  const uploadRes = await axios.post(
    `https://graph.facebook.com/v18.0/${uploadSessionId}`,
    imageBuffer,
    {
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
        "Content-Type": "application/octet-stream",
        "Offset": 0,
      },
    }
  );

  const handle =
    uploadRes.data?.h ||
    uploadRes.data?.handle ||
    uploadRes.data?.upload_handle;

  if (!handle) {
    console.error("UPLOAD FAILED:", uploadRes.data);
    throw new Error("Meta did not return upload_handle");
  }

  return handle; // ✅ THIS HANDLE WILL WORK
};
