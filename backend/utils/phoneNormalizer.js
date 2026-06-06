// utils/phoneNormalizer.js

/**
 * Normalizes phone numbers to E.164-like format: +[countryCode][number]
 * @param {string} phone - Raw phone number input
 * @param {string} countryCode - Default country code if not present (default: "91")
 * @returns {string|null} - Normalized phone with '+' prefix or null if invalid
 */
function normalizePhone(phone, countryCode = "91") {
  if (!phone) return null;

  // Convert to string and remove all non-digit characters
  let digits = String(phone).replace(/\D/g, '');

  // Handle leading zeros (e.g., 091... or 0...)
  if (digits.startsWith('0')) {
    digits = digits.substring(1);
  }

  // Rule 1: If 10 digits, it's a local number, prepend countryCode
  if (digits.length === 10) {
    return `+${countryCode}${digits}`;
  }

  // Strict check for Indian numbers (countryCode 91)
  if (countryCode === "91" && digits.startsWith("91")) {
    if (digits.length === 12) {
      return `+${digits}`; // valid 10-digit indian number with 91
    } else {
      return null; // Invalid Indian number length (e.g. 91 + 9 digits)
    }
  }

  // Rule 2: If starts with other country code or is already long (11-15 digits)
  if (digits.length >= 11 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
}

/**
 * Validates if a normalized phone number is valid (starts with +, followed by 10-15 digits)
 * @param {string} normalizedPhone
 * @returns {boolean}
 */
function isValidNormalizedPhone(normalizedPhone) {
  if (!normalizedPhone) return false;
  return /^\+\d{10,15}$/.test(normalizedPhone);
}

module.exports = {
  normalizePhone,
  isValidNormalizedPhone
};