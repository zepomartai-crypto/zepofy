const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");
const WhatsAppIntegration = require("../models/WhatsAppIntegration");

/* =========================
   BUILD BODY COMPONENT
========================= */
function buildBodyComponent(template) {
  const text = template.body || "";
  const variableValues = template.variableValues || {};
  const matches = text.match(/{{\d+}}/g) || [];

  const component = { type: "BODY", text };

  if (matches.length) {
    // 🔥 MAP USER SAMPLES: Use values from UI, fallback to generic if empty
    const samples = matches.map((m) => {
      const val = variableValues[m];
      return (val && val.trim()) ? val.trim() : `Sample${m.match(/\d+/)[0]}`;
    });

    component.example = {
      body_text: [samples],
    };
  }

  return component;
}



async function uploadTemplateImage(integration, localImagePath) {
  const form = new FormData();
  form.append("file", fs.createReadStream(localImagePath));
  form.append("messaging_product", "whatsapp");

  const res = await axios.post(
    `https://graph.facebook.com/${process.env.META_API_VERSION}/${integration.appId}/uploads`,
    form,
    {
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
        ...form.getHeaders(),
      },
      timeout: 30000,
    }
  );

  const handle =
    res.data?.upload_handle ||
    res.data?.h ||
    res.data?.id;

  if (!handle) {
    console.error("UPLOAD RESPONSE:", res.data);
    throw new Error("upload_handle missing from Meta");
  }

  return handle; // ✅ THIS IS USED IN TEMPLATE
}


exports.submitTemplateToMeta = async (userId, template, uploadHandle) => {
  const integration = await WhatsAppIntegration.findByUserIdWithToken(userId);

  if (!integration || integration.status !== "connected") {
    throw new Error("WhatsApp integration not connected");
  }

  const components = [];

  /* =========================
     IMAGE HEADER (CORRECT)
  ========================= */
  if (template.header?.type === "image") {
    if (!uploadHandle) {
      throw new Error("upload_handle required for image header");
    }

    components.push({
      type: "HEADER",
      format: "IMAGE",
      example: {
        header_handle: [uploadHandle], // ✅ ONLY HANDLE
      },
    });
  }

  /* =========================
     TEXT HEADER
  ========================= */
  if (template.header?.type === "text" && template.header.text) {
    components.push({
      type: "HEADER",
      format: "TEXT",
      text: template.header.text,
    });
  }

  /* =========================
     BODY (REQUIRED)
  ========================= */
  components.push(buildBodyComponent(template));

  /* =========================
     FOOTER
  ========================= */
  if (template.footer) {
    components.push({
      type: "FOOTER",
      text: template.footer,
    });
  }

  /* =========================
     BUTTONS (STRICT FORMAT)
  ========================= */
  if (Array.isArray(template.buttons) && template.buttons.length) {
    const buttons = template.buttons
      .map((b) => {
        if (b.type === "QUICK_REPLY" && b.text) {
          return { type: "QUICK_REPLY", text: b.text };
        }

        if (b.type === "URL" && b.text && b.url) {
          return { type: "URL", text: b.text, url: b.url };
        }

        if (b.type === "PHONE_NUMBER" && b.text && b.phone) {
          return {
            type: "PHONE_NUMBER",
            text: b.text,
            phone_number: b.phone,
          };
        }

        if (b.type === "CATALOG") {
          return { type: "CATALOG", text: "View catalog" }; // Enforce exact casing required by Meta
        }

        return null;
      })
      .filter(Boolean);

    if (buttons.length) {
      components.push({
        type: "BUTTONS",
        buttons,
      });
    }
  }

  /* =========================
     META PAYLOAD
  ========================= */
  const payload = {
    name: template.metaTemplateName,
    category: String(template.category).toUpperCase(),
    language: template.metaLanguage || (['gu_IN', 'gu', 'hi_IN'].includes(template.language) ? 'hi' : template.language) || "en_US",
    components,
  };

  console.log(
    "META TEMPLATE PAYLOAD:",
    JSON.stringify(payload, null, 2)
  );

  const res = await axios.post(
    `https://graph.facebook.com/${process.env.META_API_VERSION}/${integration.wabaId}/message_templates`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );

  return res.data;
};
