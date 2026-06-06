const generateWebhookUrl = ({ provider, integrationId }) => {
  const isProduction = process.env.NODE_ENV === "production";
  const BASE_URL = process.env.BASE_API_URL || process.env.BASE_URL;

  if (!BASE_URL && isProduction) {
    throw new Error("CRITICAL: BASE_API_URL environment variable is missing in production. Webhooks cannot resolve correctly.");
  }

  const finalBaseUrl = BASE_URL || "http://localhost:5000";
  const sanitizedBaseUrl = finalBaseUrl.replace(/\/$/, "");
  
  return `${sanitizedBaseUrl}/api/webhook/${provider}/${integrationId}`;
};

module.exports = generateWebhookUrl;
