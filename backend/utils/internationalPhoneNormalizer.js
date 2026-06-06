// utils/internationalPhoneNormalizer.js

// Try to import libphonenumber-js, fallback to basic normalization if not available
let libphonenumber;
try {
  libphonenumber = require('libphonenumber-js');
} catch (error) {
  console.warn('⚠️ libphonenumber-js not installed. Using basic phone normalization. Run: npm install libphonenumber-js');
  libphonenumber = null;
}

/**
 * Enhanced phone number normalization for international campaigns
 * Supports all countries with proper E.164 formatting
 */

class InternationalPhoneNormalizer {
  constructor() {
    // Default country code for numbers without country code
    this.defaultCountryCode = 'IN'; // India as default

    // Common country code mappings for quick detection
    this.countryCodeMap = {
      '91': 'IN',  // India
      '977': 'NP', // Nepal  
      '971': 'AE', // UAE
      '966': 'SA', // Saudi Arabia
      '968': 'OM', // Oman
      '973': 'BH', // Bahrain
      '974': 'QA', // Qatar
      '965': 'KW', // Kuwait
      '1': 'US',   // USA/Canada
      '44': 'GB',  // UK
      '49': 'DE',  // Germany
      '33': 'FR',  // France
      '39': 'IT',  // Italy
      '34': 'ES',  // Spain
      '31': 'NL',  // Netherlands
      '46': 'SE',  // Sweden
      '47': 'NO',  // Norway
      '45': 'DK',  // Denmark
      '41': 'CH',  // Switzerland
      '43': 'AT',  // Austria
      '358': 'FI', // Finland
      '48': 'PL',  // Poland
      '420': 'CZ', // Czech Republic
      '36': 'HU',  // Hungary
      '40': 'RO',  // Romania
      '30': 'GR',  // Greece
      '90': 'TR',  // Turkey
      '20': 'EG',  // Egypt
      '27': 'ZA',  // South Africa
      '234': 'NG', // Nigeria
      '254': 'KE', // Kenya
      '255': 'TZ', // Tanzania
      '256': 'UG', // Uganda
      '250': 'RW', // Rwanda
      '260': 'ZM', // Zambia
      '263': 'ZW', // Zimbabwe
      '265': 'MW', // Malawi
      '266': 'LS', // Lesotho
      '267': 'BW', // Botswana
      '268': 'SZ', // Eswatini
      '269': 'KM', // Comoros
      '230': 'MU', // Mauritius
      '248': 'SC', // Seychelles
      '257': 'DJ', // Djibouti
      '251': 'ET', // Ethiopia
      '258': 'MZ', // Mozambique
      '259': 'SO', // Somalia
      '212': 'MA', // Morocco
      '213': 'DZ', // Algeria
      '216': 'TN', // Tunisia
      '218': 'LY', // Libya
      '220': 'GM', // Gambia
      '221': 'SN', // Senegal
      '222': 'MR', // Mauritania
      '223': 'ML', // Mali
      '224': 'GN', // Guinea
      '225': 'CI', // Ivory Coast
      '226': 'BF', // Burkina Faso
      '227': 'NE', // Niger
      '228': 'TG', // Togo
      '229': 'BJ', // Benin
      '231': 'LR', // Liberia
      '232': 'SL', // Sierra Leone
      '233': 'GH', // Ghana
      '235': 'TD', // Chad
      '236': 'CF', // Central African Republic
      '237': 'CM', // Cameroon
      '238': 'CV', // Cape Verde
      '239': 'ST', // Sao Tome and Principe
      '240': 'GQ', // Equatorial Guinea
      '241': 'GA', // Gabon
      '242': 'CG', // Congo
      '243': 'CD', // Democratic Republic of Congo
      '244': 'AO', // Angola
      '245': 'GW', // Guinea-Bissau
      '246': 'IO', // British Indian Ocean Territory
      '247': 'AC', // Ascension Island
      '248': 'SC', // Seychelles
      '249': 'SD', // Sudan
      '250': 'RW', // Rwanda
      '251': 'ET', // Ethiopia
      '252': 'SO', // Somalia
      '253': 'DJ', // Djibouti
      '254': 'KE', // Kenya
      '255': 'TZ', // Tanzania
      '256': 'UG', // Uganda
      '257': 'BI', // Burundi
      '258': 'MZ', // Mozambique
      '259': 'KM', // Comoros
      '260': 'ZM', // Zambia
      '261': 'MG', // Madagascar
      '262': 'RE', // Reunion
      '263': 'ZW', // Zimbabwe
      '264': 'NA', // Namibia
      '265': 'MW', // Malawi
      '266': 'LS', // Lesotho
      '267': 'BW', // Botswana
      '268': 'SZ', // Eswatini
      '269': 'KM', // Comoros
      '290': 'SH', // Saint Helena
      '291': 'ER', // Eritrea
      '297': 'AW', // Aruba
      '298': 'FO', // Faroe Islands
      '299': 'GL', // Greenland
      '350': 'GI', // Gibraltar
      '351': 'PT', // Portugal
      '352': 'LU', // Luxembourg
      '353': 'IE', // Ireland
      '354': 'IS', // Iceland
      '355': 'AL', // Albania
      '356': 'MT', // Malta
      '357': 'CY', // Cyprus
      '358': 'FI', // Finland
      '359': 'BG', // Bulgaria
      '370': 'LT', // Lithuania
      '371': 'LV', // Latvia
      '372': 'EE', // Estonia
      '373': 'MD', // Moldova
      '374': 'AM', // Armenia
      '375': 'BY', // Belarus
      '376': 'AD', // Andorra
      '377': 'MC', // Monaco
      '378': 'SM', // San Marino
      '380': 'UA', // Ukraine
      '381': 'RS', // Serbia
      '382': 'ME', // Montenegro
      '383': 'XK', // Kosovo
      '385': 'HR', // Croatia
      '386': 'SI', // Slovenia
      '387': 'BA', // Bosnia and Herzegovina
      '389': 'MK', // North Macedonia
      '420': 'CZ', // Czech Republic
      '421': 'SK', // Slovakia
      '423': 'LI', // Liechtenstein
      '500': 'FK', // Falkland Islands
      '501': 'BZ', // Belize
      '502': 'GT', // Guatemala
      '503': 'SV', // El Salvador
      '504': 'HN', // Honduras
      '505': 'NI', // Nicaragua
      '506': 'CR', // Costa Rica
      '507': 'PA', // Panama
      '508': 'PM', // Saint Pierre and Miquelon
      '509': 'HT', // Haiti
      '590': 'GP', // Guadeloupe
      '591': 'BO', // Bolivia
      '592': 'GY', // Guyana
      '593': 'EC', // Ecuador
      '594': 'GF', // French Guiana
      '595': 'PY', // Paraguay
      '596': 'MQ', // Martinique
      '597': 'SR', // Suriname
      '598': 'UY', // Uruguay
      '599': 'CW', // Curacao
      '670': 'TL', // East Timor
      '672': 'NF', // Norfolk Island
      '673': 'BN', // Brunei
      '674': 'NR', // Nauru
      '675': 'PG', // Papua New Guinea
      '676': 'TO', // Tonga
      '677': 'SB', // Solomon Islands
      '678': 'VU', // Vanuatu
      '679': 'FJ', // Fiji
      '680': 'PW', // Palau
      '681': 'WF', // Wallis and Futuna
      '682': 'CK', // Cook Islands
      '683': 'NU', // Niue
      '684': 'AS', // American Samoa
      '685': 'WS', // Samoa
      '686': 'KI', // Kiribati
      '687': 'NC', // New Caledonia
      '688': 'TV', // Tuvalu
      '689': 'PF', // French Polynesia
      '690': 'TK', // Tokelau
      '691': 'FM', // Federated States of Micronesia
      '692': 'MH', // Marshall Islands
      '850': 'KP', // North Korea
      '852': 'HK', // Hong Kong
      '853': 'MO', // Macau
      '855': 'KH', // Cambodia
      '856': 'LA', // Laos
      '880': 'BD', // Bangladesh
      '881': 'XS', // Satellite services
      '882': 'XS', // Satellite services
      '883': 'XS', // Satellite services
      '886': 'TW', // Taiwan
      '888': 'XS', // Satellite services
      '960': 'MV', // Maldives
      '961': 'LB', // Lebanon
      '962': 'JO', // Jordan
      '963': 'SY', // Syria
      '964': 'IQ', // Iraq
      '965': 'KW', // Kuwait
      '966': 'SA', // Saudi Arabia
      '967': 'YE', // Yemen
      '968': 'OM', // Oman
      '970': 'PS', // Palestine
      '971': 'AE', // UAE
      '972': 'IL', // Israel
      '973': 'BH', // Bahrain
      '974': 'QA', // Qatar
      '975': 'BT', // Bhutan
      '976': 'MN', // Mongolia
      '977': 'NP', // Nepal
      '978': 'BT', // Bhutan
      '979': 'XS', // International premium rate
      '992': 'TJ', // Tajikistan
      '993': 'TM', // Turkmenistan
      '994': 'AZ', // Azerbaijan
      '995': 'GE', // Georgia
      '996': 'KG', // Kyrgyzstan
      '998': 'UZ', // Uzbekistan
    };
  }

  /**
   * Normalize phone number to E.164 format with international support
   * @param {string} phone - Raw phone number
   * @param {string} countryCode - Optional country code (ISO 3166-1 alpha-2)
   * @param {string} csvCountryCode - Optional country code from CSV column
   * @returns {Object} - { success: boolean, phoneNumber: string, countryCode: string, error: string }
   */
  normalizePhone(phone, countryCode = null, csvCountryCode = null) {
    if (!phone || typeof phone !== 'string') {
      return {
        success: false,
        error: 'Invalid phone number input'
      };
    }

    // Clean the phone number - remove all non-digit characters except leading +
    let cleanPhone = phone.trim().replace(/[^\d+]/g, '');

    // If empty after cleaning
    if (!cleanPhone) {
      return {
        success: false,
        error: 'Empty phone number after cleaning'
      };
    }

    // Use libphonenumber-js if available
    if (libphonenumber) {
      return this.normalizeWithLibphonenumber(cleanPhone, countryCode, csvCountryCode);
    }

    // Fallback to basic normalization
    return this.normalizeBasic(cleanPhone, countryCode, csvCountryCode);
  }

  /**
   * Normalize using libphonenumber-js library
   */
  normalizeWithLibphonenumber(cleanPhone, countryCode, csvCountryCode) {
    try {
      // Priority 1: If number starts with +, try to parse as international
      if (cleanPhone.startsWith('+')) {
        const parsedNumber = libphonenumber.parsePhoneNumber(cleanPhone);
        if (parsedNumber && parsedNumber.isValid()) {
          return {
            success: true,
            phoneNumber: parsedNumber.number.replace(/^\+/, ''),
            countryCode: parsedNumber.country,
            country: parsedNumber.country,
            type: parsedNumber.getType(),
            isPossible: parsedNumber.isPossible()
          };
        }
      }

      // Priority 2: Use CSV country code if provided
      if (csvCountryCode && csvCountryCode.length >= 2) {
        const csvCountry = csvCountryCode.length === 2 ? csvCountryCode : this.getCountryFromCode(csvCountryCode);
        const parsedNumber = libphonenumber.parsePhoneNumber(cleanPhone, csvCountry);
        if (parsedNumber && parsedNumber.isValid()) {
          return {
            success: true,
            phoneNumber: parsedNumber.number.replace(/^\+/, ''),
            countryCode: parsedNumber.country,
            country: parsedNumber.country,
            type: parsedNumber.getType(),
            isPossible: parsedNumber.isPossible()
          };
        }
      }

      // Priority 3: Use provided country code
      if (countryCode && countryCode.length >= 2) {
        const parsedNumber = libphonenumber.parsePhoneNumber(cleanPhone, countryCode);
        if (parsedNumber && parsedNumber.isValid()) {
          return {
            success: true,
            phoneNumber: parsedNumber.number.replace(/^\+/, ''),
            countryCode: parsedNumber.country,
            country: parsedNumber.country,
            type: parsedNumber.getType(),
            isPossible: parsedNumber.isPossible()
          };
        }
      }

      // Priority 4: Auto-detect country code from number
      const detectedCountry = this.detectCountryFromNumber(cleanPhone);
      if (detectedCountry) {
        const parsedNumber = libphonenumber.parsePhoneNumber(cleanPhone, detectedCountry);
        if (parsedNumber && parsedNumber.isValid()) {
          return {
            success: true,
            phoneNumber: parsedNumber.number.replace(/^\+/, ''),
            countryCode: parsedNumber.country,
            country: parsedNumber.country,
            type: parsedNumber.getType(),
            isPossible: parsedNumber.isPossible()
          };
        }
      }

      // Priority 5: Try with default country (India)
      const parsedNumber = libphonenumber.parsePhoneNumber(cleanPhone, this.defaultCountryCode);
      if (parsedNumber && parsedNumber.isValid()) {
        return {
          success: true,
          phoneNumber: parsedNumber.number.replace(/^\+/, ''),
          countryCode: parsedNumber.country,
          country: parsedNumber.country,
          type: parsedNumber.getType(),
          isPossible: parsedNumber.isPossible()
        };
      }

      // If all attempts fail, return error
      return {
        success: false,
        error: 'Could not validate phone number with any country code',
        originalNumber: phone,
        cleanedNumber: cleanPhone
      };

    } catch (error) {
      return {
        success: false,
        error: `Phone parsing error: ${error.message}`,
        originalNumber: phone,
        cleanedNumber: cleanPhone
      };
    }
  }

  /**
   * Basic normalization without libphonenumber-js
   */
  normalizeBasic(cleanPhone, countryCode, csvCountryCode) {
    try {
      // Remove + if present for processing
      let digitsOnly = cleanPhone.startsWith('+') ? cleanPhone.substring(1) : cleanPhone;

      // Priority 1: If already has + and reasonable length, keep as is
      if (cleanPhone.startsWith('+') && digitsOnly.length >= 10 && digitsOnly.length <= 15) {
        const detectedCountry = this.detectCountryFromNumber(digitsOnly);
        return {
          success: true,
          phoneNumber: cleanPhone.replace(/^\+/, ''),
          countryCode: detectedCountry || 'Unknown',
          country: detectedCountry || 'Unknown',
          type: 'MOBILE',
          isPossible: true
        };
      }

      // Priority 2: Use CSV country code if provided
      if (csvCountryCode && csvCountryCode.length >= 2) {
        const countryPrefix = this.getNumericCountryCode(csvCountryCode);
        if (countryPrefix && !digitsOnly.startsWith(countryPrefix)) {
          digitsOnly = countryPrefix + digitsOnly;
        }
      }
      // Priority 3: Use provided country code
      else if (countryCode && countryCode.length >= 2) {
        const countryPrefix = this.getNumericCountryCode(countryCode);
        if (countryPrefix && !digitsOnly.startsWith(countryPrefix)) {
          digitsOnly = countryPrefix + digitsOnly;
        }
      }
      // Priority 4: Auto-detect from number
      else {
        const detectedCountry = this.detectCountryFromNumber(digitsOnly);
        if (!detectedCountry) {
          // Use default country (India)
          if (digitsOnly.length === 10) {
            digitsOnly = '91' + digitsOnly;
          }
        }
      }

      // Validate final number
      if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
        const detectedCountry = this.detectCountryFromNumber(digitsOnly);
        return {
          success: true,
          phoneNumber: digitsOnly,
          countryCode: detectedCountry || 'Unknown',
          country: detectedCountry || 'Unknown',
          type: 'MOBILE',
          isPossible: true
        };
      }

      return {
        success: false,
        error: 'Phone number length not valid',
        originalNumber: cleanPhone,
        cleanedNumber: digitsOnly
      };

    } catch (error) {
      return {
        success: false,
        error: `Basic normalization error: ${error.message}`,
        originalNumber: cleanPhone
      };
    }
  }

  /**
   * Detect country code from phone number
   * @param {string} phoneNumber - Clean phone number (digits only)
   * @returns {string|null} - Country code or null
   */
  detectCountryFromNumber(phoneNumber) {
    // Sort country codes by length (longest first) for better matching
    const sortedCodes = Object.keys(this.countryCodeMap)
      .sort((a, b) => b.length - a.length);

    for (const code of sortedCodes) {
      if (phoneNumber.startsWith(code)) {
        return this.countryCodeMap[code];
      }
    }

    return null;
  }

  /**
   * Get country from numeric country code
   * @param {string} numericCode - Numeric country code (e.g., '91', '977')
   * @returns {string|null} - ISO country code or null
   */
  getCountryFromCode(numericCode) {
    return this.countryCodeMap[numericCode] || null;
  }

  /**
   * Get numeric country code from ISO country code
   * @param {string} isoCode - ISO country code (e.g., 'IN', 'AE')
   * @returns {string|null} - Numeric country code or null
   */
  getNumericCountryCode(isoCode) {
    for (const [numeric, iso] of Object.entries(this.countryCodeMap)) {
      if (iso === isoCode) {
        return numeric;
      }
    }
    return null;
  }

  /**
   * Validate if phone number is valid for WhatsApp
   * WhatsApp has specific requirements
   * @param {string} phoneNumber - E.164 formatted phone number
   * @returns {Object} - { valid: boolean, reason: string }
   */
  validateForWhatsApp(phoneNumber) {
    try {
      // Use libphonenumber-js if available
      if (libphonenumber) {
        const parsed = libphonenumber.parsePhoneNumber(phoneNumber);

        if (!parsed || !parsed.isValid()) {
          return {
            valid: false,
            reason: 'Invalid phone number format'
          };
        }

        // Check if it's a mobile number (WhatsApp typically works with mobile)
        const type = parsed.getType();
        if (type && !['MOBILE', 'FIXED_LINE_OR_MOBILE'].includes(type)) {
          return {
            valid: false,
            reason: `Number type ${type} may not support WhatsApp`
          };
        }

        // Check number length (WhatsApp typically requires 8-15 digits)
        const nationalNumber = parsed.nationalNumber;
        if (nationalNumber.length < 8 || nationalNumber.length > 15) {
          return {
            valid: false,
            reason: 'Phone number length not suitable for WhatsApp'
          };
        }

        return {
          valid: true,
          type: type,
          country: parsed.country
        };
      }

      // Fallback validation
      if (!phoneNumber || !phoneNumber.startsWith('+')) {
        return {
          valid: false,
          reason: 'Phone number must be in E.164 format (+country_code + number)'
        };
      }

      const digitsOnly = phoneNumber.substring(1);
      if (digitsOnly.length < 10 || digitsOnly.length > 15) {
        return {
          valid: false,
          reason: 'Phone number length not suitable for WhatsApp'
        };
      }

      const detectedCountry = this.detectCountryFromNumber(digitsOnly);
      return {
        valid: true,
        type: 'MOBILE',
        country: detectedCountry || 'Unknown'
      };

    } catch (error) {
      return {
        valid: false,
        reason: `Validation error: ${error.message}`
      };
    }
  }

  /**
   * Batch normalize phone numbers from CSV data
   * @param {Array} csvData - Array of objects from CSV
   * @param {Object} options - Options for processing
   * @returns {Object} - Processing results
   */
  batchNormalizeFromCSV(csvData, options = {}) {
    const {
      phoneColumns = ['phone', 'mobile', 'number', 'contact'],
      countryCodeColumn = 'country_code',
      defaultCountryCode = this.defaultCountryCode,
      skipInvalid = true
    } = options;

    const results = {
      valid: [],
      invalid: [],
      summary: {
        total: csvData.length,
        valid: 0,
        invalid: 0,
        duplicates: 0
      }
    };

    const seenNumbers = new Set();

    csvData.forEach((row, index) => {
      // Find phone number in the row
      let phoneNumber = null;
      let countryCode = null;

      // Look for phone number in specified columns
      for (const col of phoneColumns) {
        if (row[col] && row[col].toString().trim()) {
          phoneNumber = row[col].toString().trim();
          break;
        }
      }

      // Look for country code in specified column
      if (countryCodeColumn && row[countryCodeColumn]) {
        countryCode = row[countryCodeColumn].toString().trim();
      }

      if (!phoneNumber) {
        results.invalid.push({
          row: index + 1,
          data: row,
          error: 'No phone number found in row'
        });
        results.summary.invalid++;
        return;
      }

      // Normalize the phone number
      const normalized = this.normalizePhone(phoneNumber, defaultCountryCode, countryCode);

      if (normalized.success) {
        // Check for duplicates
        if (seenNumbers.has(normalized.phoneNumber)) {
          results.summary.duplicates++;
          return;
        }

        seenNumbers.add(normalized.phoneNumber);

        // Additional WhatsApp validation
        const whatsappValidation = this.validateForWhatsApp(normalized.phoneNumber);

        if (whatsappValidation.valid) {
          results.valid.push({
            row: index + 1,
            originalNumber: phoneNumber,
            normalizedNumber: normalized.phoneNumber,
            countryCode: normalized.countryCode,
            country: normalized.country,
            type: normalized.type,
            name: row.name || row.contact_name || row.customer_name || '',
            data: row
          });
          results.summary.valid++;
        } else {
          results.invalid.push({
            row: index + 1,
            originalNumber: phoneNumber,
            normalizedNumber: normalized.phoneNumber,
            error: whatsappValidation.reason,
            data: row
          });
          results.summary.invalid++;
        }
      } else {
        results.invalid.push({
          row: index + 1,
          originalNumber: phoneNumber,
          error: normalized.error,
          data: row
        });
        results.summary.invalid++;
      }
    });

    return results;
  }

  /**
   * Get country info from phone number
   * @param {string} phoneNumber - E.164 formatted phone number
   * @returns {Object} - Country information
   */
  getCountryInfo(phoneNumber) {
    try {
      // Use libphonenumber-js if available
      if (libphonenumber) {
        const parsed = libphonenumber.parsePhoneNumber(phoneNumber);
        if (!parsed || !parsed.isValid()) {
          return null;
        }

        return {
          country: parsed.country,
          countryCode: parsed.countryCallingCode,
          nationalNumber: parsed.nationalNumber,
          type: parsed.getType(),
          isValid: parsed.isValid(),
          isPossible: parsed.isPossible()
        };
      }

      // Fallback country info
      if (!phoneNumber || !phoneNumber.startsWith('+')) {
        return null;
      }

      const digitsOnly = phoneNumber.substring(1);
      const detectedCountry = this.detectCountryFromNumber(digitsOnly);

      if (detectedCountry) {
        const numericCode = this.getNumericCountryCode(detectedCountry);
        return {
          country: detectedCountry,
          countryCode: numericCode,
          nationalNumber: digitsOnly.substring(numericCode?.length || 0),
          type: 'MOBILE',
          isValid: true,
          isPossible: true
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }
}

// Create singleton instance
const phoneNormalizer = new InternationalPhoneNormalizer();

module.exports = {
  InternationalPhoneNormalizer,
  phoneNormalizer,
  normalizePhone: (phone, countryCode, csvCountryCode) => phoneNormalizer.normalizePhone(phone, countryCode, csvCountryCode),
  validateForWhatsApp: (phoneNumber) => phoneNormalizer.validateForWhatsApp(phoneNumber),
  batchNormalizeFromCSV: (csvData, options) => phoneNormalizer.batchNormalizeFromCSV(csvData, options),
  getCountryInfo: (phoneNumber) => phoneNormalizer.getCountryInfo(phoneNumber)
};
