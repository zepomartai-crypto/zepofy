const cloudinary = require('cloudinary').v2;

// Clean environment variables strictly
const cloud_name = (process.env.CLOUDINARY_CLOUD_NAME || "").trim().replace(/['" \r\n]/g, '');
const api_key = (process.env.CLOUDINARY_API_KEY || "").trim().replace(/['" \r\n]/g, '');
const api_secret = (process.env.CLOUDINARY_API_SECRET || "").trim().replace(/['" \r\n]/g, '');

console.log("🔍 [Cloudinary] Checking Credentials...");
console.log("Cloud:", cloud_name);
console.log("Key:", api_key);
console.log("Secret Length:", api_secret.length);

cloudinary.config({
  cloud_name,
  api_key,
  api_secret
});

// Temporarily disable connection test to prevent startup errors
// Test connection will be enabled when correct credentials are provided
if (api_secret && api_secret !== 'your_correct_cloudinary_api_secret_here') {
  cloudinary.api.ping()
    .then(() => console.log("✅ [Cloudinary] Connection Successful"))
    .catch(err => {
      console.error("❌ [Cloudinary] Authentication Failed!");
      console.error("Full Error:", JSON.stringify(err, null, 2));
    });
} else {
  console.log("⚠️ [Cloudinary] Connection test skipped - API secret needs to be updated");
}

module.exports = cloudinary;
