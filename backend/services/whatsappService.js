const axios = require("axios");
const WhatsAppIntegration = require("../models/WhatsAppIntegration");

const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http')) return imagePath;
  const serverUrl = process.env.SERVER_URL || 'http://localhost:5000';
  return `${serverUrl}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
};

// Helper: Strict Integration Fetch
const getIntegration = async (userId) => {
  if (!userId) {
    throw new Error("Missing userId – cannot send template");
  }

  // 1. Find connected integration and explicitly INCLUDE accessToken (select: false field)
  const integration = await WhatsAppIntegration.findOne({
    userId,
    status: "connected"
  }).select("+accessToken");

  if (!integration) {
    // For better UX, find if they have one but it's disconnected
    const exists = await WhatsAppIntegration.findOne({ userId });
    if (exists) {
      throw new Error(`WhatsApp integration is ${exists.status || 'disconnected'} for this user.`);
    }
    throw new Error(`No connected WhatsApp integration found for user ${userId}. Strict multi-tenant isolation enforced.`);
  }

  // 2. DECRYPT TOKEN
  const decrypted = integration.decryptToken();
  if (!decrypted) {
    console.error("❌ Decryption failed for User:", userId);
    throw new Error("Invalid or corrupted WhatsApp access token. Please reconnect your account.");
  }

  // 3. Assign decrypted token back to object for sending logic
  integration.accessToken = decrypted;

  return integration;
};

/* ================= TEXT MESSAGE ================= */
exports.sendTextMessage = async (userId, to, body) => {
  const integration = await getIntegration(userId);

  // Normalize phone number
  let cleanPhone = to.toString().replace(/\D/g, '');
  if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
  else if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) cleanPhone = '91' + cleanPhone.substring(1);

  const payload = {
    messaging_product: "whatsapp",
    to: cleanPhone,
    type: "text",
    text: { body },
  };

  return await sendToMeta(integration, payload);
};

/* ================= INTERACTIVE BUTTON MESSAGE ================= */
exports.sendButtonMessage = async (userId, to, bodyText, buttons, media = null) => {
  const integration = await getIntegration(userId);

  // Normalize phone number
  let cleanPhone = to.toString().replace(/\D/g, '');
  if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
  else if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) cleanPhone = '91' + cleanPhone.substring(1);

  // WhatsApp supports up to 3 buttons for 'reply' type
  const formattedButtons = (Array.isArray(buttons) ? buttons : []).slice(0, 3).map((btn, index) => {
    const title = typeof btn === 'string' ? btn : (btn.text || btn.title || `Button ${index + 1}`);
    const buttonId = typeof btn === 'object' ? (btn.value || btn.id || `btn-${index}`) : `btn-${index}`;
    return {
      type: "reply",
      reply: {
        id: String(buttonId),
        title: String(title).substring(0, 20)
      }
    };
  });

  const interactive = {
    type: "button",
    body: { text: String(bodyText || "Please choose an option:").substring(0, 1024) },
    action: {
      buttons: formattedButtons
    }
  };

  // ✅ Add Media Header if provided (Optimized for Media Input + Buttons)
  if (media && media.url) {
    const fullMediaUrl = getImageUrl(media.url);
    const mediaType = media.type || "image";

    // Meta supports: image, video, document, text
    if (["image", "video", "document"].includes(mediaType)) {
      interactive.header = {
        type: mediaType,
        [mediaType]: { link: fullMediaUrl }
      };
    }
  }

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: cleanPhone,
    type: "interactive",
    interactive
  };

  return await sendToMeta(integration, payload);
};

/* ================= INTERACTIVE LIST MESSAGE ================= */
exports.sendListMessage = async ({ userId, to, bodyText, buttonText, sections, footerText }) => {
  const integration = await getIntegration(userId);

  // Normalize phone number
  let cleanPhone = to.toString().replace(/\D/g, '');
  if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
  else if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) cleanPhone = '91' + cleanPhone.substring(1);

  const interactive = {
    type: "list",
    body: { text: String(bodyText || "Please select an option:").substring(0, 1024) },
    action: {
      button: String(buttonText || "Open Menu").substring(0, 20),
      sections: sections
    }
  };

  if (footerText) {
    interactive.footer = { text: String(footerText).substring(0, 1024) };
  }

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: cleanPhone,
    type: "interactive",
    interactive
  };

  return await sendToMeta(integration, payload);
};

/* ================= GENERIC INTERACTIVE MESSAGE ================= */
exports.sendInteractiveMessage = async (userId, to, interactive) => {
  const integration = await getIntegration(userId);

  // Normalize phone number
  let cleanPhone = to.toString().replace(/\D/g, '');
  if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
  else if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) cleanPhone = '91' + cleanPhone.substring(1);

  // 🛡️ RE-VALIDATE AND FIX PAYLOAD FOR CTA BUTTONS
  const finalInteractive = { ...interactive };

  if (interactive.type === "cta_url" || interactive.type === "cta_call") {
    // Both Website and Call buttons use "cta_url" as the interactive type
    finalInteractive.type = "cta_url";

    // Ensure the action object has the required 'name' and 'parameters'
    if (finalInteractive.action && !finalInteractive.action.name) {
      if (interactive.type === "cta_call") {
        finalInteractive.action.name = "cta_call";
      } else {
        finalInteractive.action.name = "cta_url";
      }
    }

    if (!finalInteractive.body) finalInteractive.body = { text: "Click the button below:" };
  } else if (interactive.type === "flow") {
    // Native WhatsApp Flow support
    // Must contain action.name = "flow" and action.parameters
    if (!finalInteractive.action || finalInteractive.action.name !== "flow") {
      throw new Error("Interactive flow must have action.name = 'flow'");
    }
  }

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: cleanPhone,
    type: "interactive",
    interactive: finalInteractive
  };

  console.log(`[WhatsApp Service] 📤 Dispatching ${finalInteractive.type} to ${cleanPhone}`);

  try {
    const res = await sendToMeta(integration, payload);
    return res;
  } catch (err) {
    console.error(`[WhatsApp Service] ❌ Interactive Message Failed:`, err.response?.data || err.message);
    throw err;
  }
};

/* ================= IMAGE MESSAGE ================= */
exports.sendImageMessage = async ({ userId, to, imageUrl, caption }) => {
  return exports.sendMediaMessage({ userId, to, mediaUrl: imageUrl, mediaType: "image", caption });
};

/* ================= GENERIC MEDIA MESSAGE ================= */
exports.sendMediaMessage = async ({ userId, to, mediaUrl, mediaType, caption, filename }) => {
  const integration = await getIntegration(userId);
  const fullMediaUrl = getImageUrl(mediaUrl);

  // Normalize phone number
  let cleanPhone = to.toString().replace(/\D/g, '');
  if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
  else if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) cleanPhone = '91' + cleanPhone.substring(1);

  const mediaObject = { link: fullMediaUrl };

  // ✅ Caption: Supported by image, video, document. NOT supported by audio.
  if (caption && ["image", "video", "document"].includes(mediaType)) {
    mediaObject.caption = caption;
  }

  // ✅ Filename: ONLY supported by document. Meta throws error if present elsewhere.
  if (filename && mediaType === "document") {
    mediaObject.filename = filename;
  }

  const payload = {
    messaging_product: "whatsapp",
    to: cleanPhone,
    type: mediaType,
    [mediaType]: mediaObject
  };

  return await sendToMeta(integration, payload);
};

/* ================= TEMPLATE MESSAGE ================= */
exports.sendTemplateMessage = async ({
  userId,
  to,
  templateName,
  language = "en_US",
  bodyParams = [],
  buttonParams = [],
  metaImageHandle = null,
  components = null,
  catalogThumbnailSku = null
}) => {
  let integration;
  try {
    // 🛡️ CENTRALIZED VALIDATION: Handles find, select(+token), status check, and decryption
    integration = await getIntegration(userId);
  } catch (err) {
    return {
      success: false,
      error: err.message || "Access to WhatsApp is disabled or expired"
    };
  }

  const whatsappToken = integration.accessToken;

  // Normalize phone number
  let cleanPhone = to.toString().replace(/\D/g, '');
  if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
  else if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) cleanPhone = '91' + cleanPhone.substring(1);

  if (cleanPhone.length < 10) {
    return { success: false, error: `Invalid phone number format: ${to}` };
  }

  const payload = {
    messaging_product: "whatsapp",
    to: cleanPhone,
    type: "template",
    template: {
      name: templateName,
      language: { code: language || "en_US" } // Default to en_US, but will be refined below
    }
  };

  let finalComponents = [];

  // ✅ PRIORITIZE EXPLICITLY PASSED COMPONENTS
  if (components && Array.isArray(components) && components.length > 0) {
    finalComponents = components;
  } else {
    // FALLBACK: Build from params if no components passed
    const Template = require("../models/Template");

    // 🔥 REQUIREMENT: Detailed logging
    console.log("Template lookup:", templateName, language);

    // ✅ REQUIREMENT: More relaxed query (UserID + Name is usually enough)
    // ✅ DEPTH LOOKUP: Match by MongoID, MetaID, MetaName, or LocalName
    const { isValidObjectId } = require("mongoose");
    let templateRecord = await Template.findOne({
      userId,
      $or: [
        ...(isValidObjectId(templateName) ? [{ _id: templateName }] : []),
        { metaTemplateId: templateName },
        { metaTemplateName: templateName },
        { name: templateName }
      ]
    });

    if (templateRecord) {
      // ✅ PRIORITY RESOLUTION: Use DB language, then passed language, then default
      const finalLang = templateRecord.language || language || "en_US";
      payload.template.language.code = finalLang;
      const bodyVariableCount = (templateRecord.body && templateRecord.body.match(/{{\s*[^}]+\s*}}/g) || []).length;

      // 1. Header (Image support) - REQUIRED if template has image header
      if (templateRecord.header && templateRecord.header.type === "image") {
        const imageLink = metaImageHandle || (templateRecord.header ? templateRecord.header.image : null);
        const fullImageUrl = getImageUrl(imageLink);

        // Meta Handle vs Public URL
        const isMetaHandle = imageLink && !String(imageLink).includes('/') && !String(imageLink).startsWith('http');

        // ✅ ALWAYS push header if type is image, to match template structure
        console.log("🛠️ WhatsApp Send: Resolving header image...", { isMetaHandle, imageLink, finalUrl: fullImageUrl });

        finalComponents.push({
          type: "HEADER",
          parameters: [
            {
              type: "image",
              image: isMetaHandle ? { id: imageLink } : { link: fullImageUrl }
            }
          ]
        });
      }

      // 2. Body Variables
      if (bodyVariableCount > 0) {
        let paramsToUse = Array.isArray(bodyParams) ? [...bodyParams] : [];
        while (paramsToUse.length < bodyVariableCount) paramsToUse.push(" ");
        paramsToUse = paramsToUse.slice(0, bodyVariableCount);

        finalComponents.push({
          type: "BODY",
          parameters: paramsToUse.map(v => ({ type: "text", text: String(v || " ").trim() || " " }))
        });
      }

      // 3. Buttons (URL parameters or CATALOG parameters)
      if (templateRecord.buttons && templateRecord.buttons.length > 0) {
        let urlButtonParamIndex = 0;
        templateRecord.buttons.forEach((btn, index) => {
          if (btn.type === "URL" && btn.url && /{{\s*[^}]+\s*}}/.test(btn.url)) {
            // Only add if we actually have a param for this button
            if (buttonParams[urlButtonParamIndex]) {
              finalComponents.push({
                type: "BUTTON",
                sub_type: "url",
                index: String(index),
                parameters: [{ type: "text", text: String(buttonParams[urlButtonParamIndex]) }]
              });
              urlButtonParamIndex++;
            }
          } else if (btn.type === "CATALOG") {
            // REQUIRED: CATALOG button support
            console.log(`🛠️ WhatsApp Send: Resolving CATALOG button at index ${index} with SKU: ${catalogThumbnailSku}`);
            finalComponents.push({
              type: "BUTTON",
              sub_type: "CATALOG",
              index: String(index),
              parameters: [
                {
                  type: "action",
                  action: {
                    thumbnail_product_retailer_id: catalogThumbnailSku || ""
                  }
                }
              ]
            });
          }
        });
      }
    } else {
      // Emergency fallback if even DB record is missing
      if (metaImageHandle && !String(metaImageHandle).startsWith('blob:') && !String(metaImageHandle).includes('localhost')) {
        const isUrl = String(metaImageHandle).startsWith('http');
        finalComponents.push({
          type: "HEADER", // ✅ FIXED: UPPERCASE
          parameters: [{ type: "image", image: isUrl ? { link: metaImageHandle } : { id: metaImageHandle } }]
        });
      }
      if (bodyParams && bodyParams.length > 0) {
        finalComponents.push({
          type: "BODY",
          parameters: bodyParams.map(v => ({ type: "text", text: String(v || " ").trim() || " " }))
        });
      }
    }
  }

  // ✅ ALWAYS include components array
  payload.template.components = finalComponents;

  // 🚀 DISPATCH LOG: Full transparency for the user
  console.log(`\n📤 [WhatsApp API Request] Template: ${templateName} | Target: ${cleanPhone}`);
  console.log(JSON.stringify(payload, null, 2));

  const sendTemplate = async () => {
    const apiVersion = process.env.META_API_VERSION || "v18.0";
    console.log("Reply Sending");
    const res = await axios.post(
      `https://graph.facebook.com/${apiVersion}/${integration.phoneNumberId}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${whatsappToken}`,
          "Content-Type": "application/json"
        },
        timeout: 15000
      }
    );

    // Response validation & Detailed Logging
    if (res.data && res.data.messages && res.data.messages[0]) {
      console.log("Reply Sent");
      console.log(`\n✅ [WhatsApp API Response] Status: ${res.status} | ID: ${res.data.messages[0].id}`);
      console.log(JSON.stringify(res.data, null, 2));
    }

    return res;
  };

  try {
    const res = await sendTemplate();
    console.log(`✅ [WhatsApp API] Success: ${res.data.messages[0].id}`);
    return {
      success: true,
      data: res.data,
      messages: res.data.messages,
      metaMessageId: res.data.messages[0].id
    };

  } catch (error) {
    console.warn(`⚠️ [WhatsApp API] Send failed, retrying once...`);

    try {
      // Retry once system
      const retryRes = await sendTemplate();
      console.log(`✅ [WhatsApp API] Retry Success: ${retryRes.data.messages[0].id}`);
      return {
        success: true,
        data: retryRes.data,
        messages: retryRes.data.messages,
        metaMessageId: retryRes.data.messages[0].id
      };
    } catch (retryError) {
      const metaError = retryError.response?.data?.error;
      const errorMsg = (metaError?.message || retryError.message).toLowerCase();

      console.error(`❌ [WhatsApp API] FAILED:`, {
        code: metaError?.code,
        message: errorMsg,
        fbtrace_id: metaError?.fbtrace_id
      });

      // ISSUE 2 FIX (Dev Mode Fallback)
      if (errorMsg.includes("trial expired") || errorMsg.includes("tier") || errorMsg.includes("limit was reached")) {
        return {
          success: false,
          error: "WhatsApp plan expired, please upgrade"
        };
      }

      return {
        success: false,
        error: metaError?.message || retryError.message
      };
    }
  }
};

// Common Sending Logic
// Common Sending Logic
async function sendToMeta(integration, payload) {
  const { userId, phoneNumberId, accessToken } = integration;

  // STRICT: Validate Token
  if (!accessToken || accessToken.includes(":")) {
    console.error("❌ Invalid Access Token found in sendToMeta. Likely not decrypted.");
    throw new Error("CRITICAL: WhatsApp Access Token is missing or improperly decrypted.");
  }

  // ✅ LOG FULL REQUEST (Sanitized)
  const logPayload = JSON.parse(JSON.stringify(payload));
  if (logPayload.text?.body) logPayload.text.body = logPayload.text.body.substring(0, 50) + "...";

  console.log(`\n📤 [WhatsApp API Request] User: ${userId} | Target: ${logPayload.to}`);
  console.log(JSON.stringify(logPayload, null, 2));

  try {
    const apiVersion = process.env.META_API_VERSION || "v18.0";
    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

    console.log("Reply Sending");
    const res = await axios.post(
      url,
      payload,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        timeout: 15000 // Increased timeout
      }
    );

    // ✅ LOG FULL RESPONSE
    console.log("Reply Sent");
    console.log(`\n✅ [WhatsApp API Response] Status: ${res.status} | ID: ${res.data.messages?.[0]?.id || 'N/A'}`);
    console.log(JSON.stringify(res.data, null, 2));

    return {
      ...res.data,
      success: true,
      metaMessageId: res.data.messages?.[0]?.id
    };

  } catch (error) {
    // Detailed Error Logging
    const metaError = error.response?.data?.error;
    const msg = metaError?.message || error.message;
    const code = metaError?.code;
    const type = metaError?.type;
    const fbtrace_id = metaError?.fbtrace_id;

    console.error(`\n❌ [WhatsApp API Error] Code: ${code} | Type: ${type}`);
    console.error(`Simple Message: ${msg}`);
    console.error(`Trace ID: ${fbtrace_id}`);

    if (error.response?.data) {
      console.error("Full Error Response:", JSON.stringify(error.response.data, null, 2));
    }

    if (code === 190) {
      throw new Error("WhatsApp Access Token has expired or is invalid. Please reconnect.");
    }

    // Throw detailed error for controller to handle
    throw new Error(msg);
  }
}

/* ================= FLOW BUILDER TEMPLATE SENDING ================= */
// 🚀 SEPARATE FUNCTION: Avoids coupling with message page logic
exports.sendFlowTemplateMessage = async ({
  userId,
  to,
  templateName,
  language = "en_US",
  bodyParams = [],
  headerImageUrl = null
}) => {
  if (!userId || !to || !templateName) {
    throw new Error("Missing required parameters for Flow Template Dispatch (userId, to, or templateName)");
  }

  // Reuse the core logic but in a separate entry point for flows
  return await exports.sendTemplateMessage({
    userId,
    to,
    templateName,
    language,
    bodyParams,
    metaImageHandle: headerImageUrl
  });
};
/* ================= MARK AS READ ================= */
exports.markMessageRead = async (userId, metaMessageId) => {
  const integration = await getIntegration(userId);

  const payload = {
    messaging_product: "whatsapp",
    status: "read",
    message_id: metaMessageId
  };

  return await sendToMeta(integration, payload);
};
