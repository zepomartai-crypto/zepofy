require("dotenv").config();
const User = require("../models/User");
const OtpVerification = require("../models/OtpVerification");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const bcrypt = require("bcryptjs"); // Ensure bcryptjs is used

// Helper: Generate JWT
const createToken = (user) => {
  return jwt.sign(
    { userId: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// Helper: Normalize Phone (E.164 without +)
const normalizePhone = (phone) => {
  let clean = phone.replace(/\D/g, '');
  // Auto-append 91 if 10 digits (Default to India)
  if (clean.length === 10) {
    clean = '91' + clean;
  }
  return clean;
};

// Helper: Check integration status
const checkWhatsAppConnected = async (userId) => {
  const WhatsAppIntegration = require("../models/WhatsAppIntegration");
  const integration = await WhatsAppIntegration.findOne({ userId });
  return (integration && integration.status === 'connected') || false;
};

// Helper: Format User Response with full details
const formatUserResponse = async (user) => {
  // Re-fetch from DB to ensure we have the absolute latest state (inc. defaults and virtuals)
  const freshUser = await User.findById(user._id).select("-password -__v").lean();

  const userObj = freshUser || user.toObject();

  // Ensure ID consistency for frontend
  userObj.id = userObj._id.toString();

  // Remove sensitive/unnecessary data if fallback was used
  delete userObj.password;
  delete userObj.__v;

  // Add dynamic connection status
  userObj.isWhatsAppConnected = await checkWhatsAppConnected(user._id);

  return userObj;
};

// Helper: Send WhatsApp OTP
const sendWhatsAppOtp = async (to, otp) => {
  const phoneNumberId = process.env.PHONE_NUMBER_ID;
  const accessToken = process.env.ACCESS_TOKEN;
  const templateName = process.env.AUTHENTICATION_TEMPLATE_NAME || "authentication_code_copy_code_button";

  if (!phoneNumberId || !accessToken) {
    throw new Error("Missing WhatsApp API credentials");
  }

  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: to,
    type: "template",
    template: {
      name: templateName,
      language: { code: "en_US" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: otp }
          ]
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [
            { type: "text", text: otp }
          ]
        }
      ]
    }
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    return true;
  } catch (error) {
    const metaError = error.response?.data?.error;
    console.error("WhatsApp OTP Send Error:", JSON.stringify(metaError || error.message, null, 2));
    throw new Error(metaError?.message || "Failed to send WhatsApp OTP");
  }
};

// ===================== REGISTER FLOW ===================== //

// 1. Send Register OTP
exports.sendRegisterOtp = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    // Production-safe validation
    if (!phoneNumber || typeof phoneNumber !== 'string' || phoneNumber.trim() === '') {
      return res.status(400).json({
        error: "Phone number required",
        debug: { received: phoneNumber, type: typeof phoneNumber }
      });
    }

    const cleanPhone = normalizePhone(phoneNumber);

    // Check if phone exists
    const existingUser = await User.findOne({ phoneNumber: cleanPhone });
    if (existingUser) {
      return res.status(400).json({ error: "Phone number already registered. Please login." });
    }

    // Rate Limit (3 attempts in 10 mins)
    const recent = await OtpVerification.countDocuments({
      phoneNumber: cleanPhone,
      type: 'register',
      createdAt: { $gt: new Date(Date.now() - 10 * 60 * 1000) }
    });

    if (recent >= 3 && process.env.NODE_ENV !== 'development') {
      return res.status(429).json({ error: "Too many attempts. Please try again later." });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);

    // Save OTP
    await OtpVerification.create({
      phoneNumber: cleanPhone,
      hashedOtp,
      type: 'register',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });

    // Send via WhatsApp
    try {
      await sendWhatsAppOtp(cleanPhone, otp);
    } catch (otpErr) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ [authController] Failed to send WhatsApp OTP in dev: ${otpErr.message}. Proceeding with devOtp.`);
      } else {
        throw otpErr;
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`🔐 REGISTER OTP for ${cleanPhone}: ${otp}`);
      return res.json({ success: true, message: "OTP sent successfully", devOtp: otp });
    }

    res.json({ success: true, message: "OTP sent successfully" });

  } catch (error) {
    console.error("Send Register OTP Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// 2. Verify Register OTP
exports.verifyRegisterOtp = async (req, res) => {
  try {
    const { fullName, email, phoneNumber, otp, password } = req.body;

    // Production-safe validation: Check for null, undefined, empty string, or whitespace-only
    const hasAllFields =
      fullName && email && phoneNumber && otp && password &&
      typeof fullName === 'string' && fullName.trim() !== '' &&
      typeof email === 'string' && email.trim() !== '' &&
      typeof phoneNumber === 'string' && phoneNumber.trim() !== '' &&
      typeof otp === 'string' && otp.trim() !== '' &&
      typeof password === 'string' && password.trim() !== '';

    if (!hasAllFields) {
      return res.status(400).json({
        error: "All fields are required",
        debug: {
          received: { fullName, email, phoneNumber, otp: otp ? '***' : null, password: password ? '***' : null },
          types: {
            fullName: typeof fullName,
            email: typeof email,
            phoneNumber: typeof phoneNumber,
            otp: typeof otp,
            password: typeof password
          }
        }
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" });
    }

    const cleanPhone = normalizePhone(phoneNumber);

    // Verify OTP
    const record = await OtpVerification.findOne({
      phoneNumber: cleanPhone,
      type: 'register',
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    if (!record) return res.status(400).json({ error: "OTP expired or invalid" });

    const isMatch = await bcrypt.compare(otp, record.hashedOtp);
    if (!isMatch) {
      record.attempts += 1;
      await record.save();
      if (record.attempts >= 5) await OtpVerification.findByIdAndDelete(record._id);
      return res.status(400).json({ error: "Invalid OTP" });
    }

    // Check uniqueness (Email and Phone)
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { phoneNumber: cleanPhone }
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        error: existingUser.email === normalizedEmail ? "Email already exists" : "Phone number already exists with another account"
      });
    }

    // Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create User
    const newUser = await User.create({
      name: fullName,
      email: normalizedEmail,
      password: hashedPassword,
      phoneNumber: cleanPhone,
      phoneVerified: true,
      loginMethod: 'both',
      status: 'ACTIVE'
    });

    // Cleanup OTP
    await OtpVerification.findByIdAndDelete(record._id);

    // Generate Token
    const token = createToken(newUser);

    res.json({
      success: true,
      token,
      user: await formatUserResponse(newUser)
    });

  } catch (error) {
    console.error("Verify Register OTP Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ===================== OTP LOGIN FLOW ===================== //

// 3. Send Login OTP
exports.sendLoginOtp = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    // Production-safe validation
    if (!phoneNumber || typeof phoneNumber !== 'string' || phoneNumber.trim() === '') {
      return res.status(400).json({
        error: "Phone number required",
        debug: { received: phoneNumber, type: typeof phoneNumber }
      });
    }

    const cleanPhone = normalizePhone(phoneNumber);

    // Check User Exists (with Legacy Fallback)
    let user = await User.findOne({ phoneNumber: cleanPhone });
    if (!user) {
      // Fallback: Check 10 digit version if 12 digit (91...)
      const possibilities = [cleanPhone];
      if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
        possibilities.push(cleanPhone.substring(2));
      }

      const legacyUser = await User.findOne({
        $or: [
          { phone: { $in: possibilities } },
          { phoneNumber: { $in: possibilities } }
        ]
      });

      if (!legacyUser) {
        return res.status(404).json({ error: "Phone number not registered. Please Sign Up." });
      }
    }

    // Rate Limit
    const recent = await OtpVerification.countDocuments({
      phoneNumber: cleanPhone,
      type: 'login',
      createdAt: { $gt: new Date(Date.now() - 10 * 60 * 1000) }
    });

    if (recent >= 3 && process.env.NODE_ENV !== 'development') {
      return res.status(429).json({ error: "Too many attempts. Please wait 10 mins." });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);

    // Save OTP
    await OtpVerification.create({
      phoneNumber: cleanPhone,
      hashedOtp,
      type: 'login',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });

    // Send via WhatsApp
    try {
      await sendWhatsAppOtp(cleanPhone, otp);
    } catch (otpErr) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ [authController] Failed to send WhatsApp OTP in dev: ${otpErr.message}. Proceeding with devOtp.`);
      } else {
        throw otpErr;
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`🔐 LOGIN OTP for ${cleanPhone}: ${otp}`);
      return res.json({ success: true, message: "OTP sent successfully", devOtp: otp });
    }

    res.json({ success: true, message: "OTP sent successfully" });

  } catch (error) {
    console.error("Send Login OTP Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// 4. Verify Login OTP
exports.verifyLoginOtp = async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;

    // Production-safe validation
    const hasRequiredFields =
      phoneNumber && otp &&
      typeof phoneNumber === 'string' && phoneNumber.trim() !== '' &&
      typeof otp === 'string' && otp.trim() !== '';

    if (!hasRequiredFields) {
      return res.status(400).json({
        error: "Phone and OTP required",
        debug: {
          received: { phoneNumber, otp: otp ? '***' : null },
          types: { phoneNumber: typeof phoneNumber, otp: typeof otp }
        }
      });
    }

    const cleanPhone = normalizePhone(phoneNumber);

    // Verify OTP
    const record = await OtpVerification.findOne({
      phoneNumber: cleanPhone,
      type: 'login',
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    if (!record) return res.status(400).json({ error: "OTP expired or invalid" });

    const isMatch = await bcrypt.compare(otp, record.hashedOtp);
    if (!isMatch) {
      record.attempts += 1;
      await record.save();
      if (record.attempts >= 5) await OtpVerification.findByIdAndDelete(record._id);
      return res.status(400).json({ error: "Invalid OTP" });
    }

    // Find User
    let user = await User.findOne({ phoneNumber: cleanPhone });

    // Migration Logic
    if (!user) {
      const possibilities = [cleanPhone];
      if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
        possibilities.push(cleanPhone.substring(2));
      }

      const legacyUser = await User.findOne({
        $or: [
          { phone: { $in: possibilities } },
          { phoneNumber: { $in: possibilities } }
        ]
      });

      if (legacyUser) {
        user = legacyUser;
        user.phoneNumber = cleanPhone;
        user.phoneVerified = true;
        // logic: If migrating to OTP, ensure permissions
        if (user.loginMethod === 'password') {
          user.loginMethod = 'both';
        } else if (user.loginMethod !== 'both') {
          user.loginMethod = 'otp';
        }
        await user.save();
      } else {
        return res.status(404).json({ error: "User not found" });
      }
    }

    // NEW: Check if phone is verified if it was a strict password user (though handled by logic above essentially)
    if (!user.phoneVerified) {
      user.phoneVerified = true;
      await user.save();
    }

    // Check Blocking and Inactive Status (Exempt SuperAdmins)
    const normalizedStatus = user.status?.toUpperCase();
    const isSuperAdmin = user.role === 'superadmin';

    if (!isSuperAdmin) {
      // 1. Subscription Expiry Check (Priority - Hard Block)
      if (user.accountExpiry && new Date() > new Date(user.accountExpiry)) {
        return res.status(403).json({
          success: false,
          error: "Your subscription has expired. Please upgrade your plan to continue.",
          code: "SUBSCRIPTION_EXPIRED"
        });
      }

      // 2. Account Status Check
      if (normalizedStatus === 'INACTIVE') {
        return res.status(403).json({ error: "Your account is currently inactive. Please contact support." });
      }

      // 3. Blocking Check (Hard Block)

      const isTempBlocked = normalizedStatus === 'TEMP_BLOCKED' && user.blockUntil && user.blockUntil > new Date();
      const isPermBlocked = normalizedStatus === 'PERMANENT_BLOCKED' || user.isBlocked || user.blocked;

      if (isPermBlocked || isTempBlocked) {
        const reason = user.blockReason ? `: ${user.blockReason}` : "";
        const message = isTempBlocked
          ? `Account is temporarily blocked until ${new Date(user.blockUntil).toLocaleString()}${reason}`
          : `Account is permanently blocked${reason}`;
        return res.status(403).json({ error: message });
      }
    }

    // Cleanup OTP
    await OtpVerification.findByIdAndDelete(record._id);

    // Token
    const token = createToken(user);
    user.lastLogin = new Date();
    await user.save();

    res.json({
      success: true,
      token,
      user: await formatUserResponse(user)

    });

  } catch (error) {
    console.error("Verify Login OTP Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ===================== PASSWORD LOGIN FLOW ===================== //
exports.loginPassword = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Production-safe validation
    const hasValidCredentials =
      email && password &&
      typeof email === 'string' && email.trim() !== '' &&
      typeof password === 'string' && password.trim() !== '';

    if (!hasValidCredentials) {
      return res.status(400).json({
        error: "Email and password required",
        debug: {
          received: { email, password: password ? '***' : null },
          types: { email: typeof email, password: typeof password }
        }
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select("+password"); // Need to explicitly select password
    if (!user) return res.status(400).json({ error: "User not found" });

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    // Check Blocking and Inactive Status (Exempt SuperAdmins)
    const normalizedStatus = user.status?.toUpperCase();
    const isSuperAdmin = user.role === 'superadmin';

    if (!isSuperAdmin) {
      // 1. Subscription Expiry Check (Priority - Hard Block)
      if (user.accountExpiry && new Date() > new Date(user.accountExpiry)) {
        return res.status(403).json({
          success: false,
          error: "Your subscription has expired. Please upgrade your plan to continue.",
          code: "SUBSCRIPTION_EXPIRED"
        });
      }

      // 2. Account Status Check
      if (normalizedStatus === 'INACTIVE') {
        return res.status(403).json({ error: "Your account is currently inactive. Please contact support." });
      }

      // 3. Blocking Check (Hard Block)

      const isTempBlocked = normalizedStatus === 'TEMP_BLOCKED' && user.blockUntil && user.blockUntil > new Date();
      const isPermBlocked = normalizedStatus === 'PERMANENT_BLOCKED' || user.isBlocked || user.blocked;

      if (isPermBlocked || isTempBlocked) {
        const reason = user.blockReason ? `: ${user.blockReason}` : "";
        const message = isTempBlocked
          ? `Account is temporarily blocked until ${new Date(user.blockUntil).toLocaleString()}${reason}`
          : `Account is permanently blocked${reason}`;
        return res.status(403).json({ error: message });
      }
    }

    user.lastLogin = new Date();
    await user.save();

    const token = createToken(user);

    res.json({
      success: true,
      token,
      user: await formatUserResponse(user)

    });

  } catch (error) {
    console.error("Login Password Error:", error);
    res.status(500).json({ error: error.message });
  }
};

//* ---------------- UPLOAD AVATAR ---------------- */
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Avatar file required" });
    }

    // Cloudinary path
    const avatarUrl = req.file.path;
    const publicId = req.file.filename;

    const oldUser = await User.findById(req.userId);
    if (oldUser?.profileImagePublicId) {
      try {
        const cloudinary = require("../config/cloudinary");
        await cloudinary.uploader.destroy(oldUser.profileImagePublicId);
      } catch (e) { }
    }

    await User.findByIdAndUpdate(req.userId, {
      profileImage: avatarUrl,
      profileImagePublicId: publicId,
      photo: avatarUrl // Keep legacy synchronized
    });

    res.json({
      success: true,
      avatar: avatarUrl,
      public_id: publicId
    });
  } catch (error) {
    console.error("Avatar Upload Error:", error);
    return res.status(500).json({
      message: "Avatar upload failed"
    });
  }
};

/* ===================== ME & PROFILE ===================== // */
exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password -__v");
    if (!user) return res.status(401).json({ error: "User not found" });

    // Add connection flag to user object
    const userObj = user.toObject();
    userObj.isWhatsAppConnected = await checkWhatsAppConnected(req.userId);

    res.json({ user: userObj });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("+password"); // Need to check if password exists
    if (!user) return res.status(404).json({ error: "User not found" });

    const { name, email, company, loginMethod } = req.body;

    if (name) user.name = name;
    if (email) {
      // Check if email is already taken by another user
      const existingUser = await User.findOne({ email, _id: { $ne: user._id } });
      if (existingUser) {
        return res.status(400).json({ error: "Email already exists" });
      }
      user.email = email;
    }
    if (company) user.company = company;

    // Handle Login Method Change
    if (loginMethod && ['otp', 'password', 'both'].includes(loginMethod)) {
      // Validate 'password' method requirements
      if ((loginMethod === 'password' || loginMethod === 'both') && !user.password) {
        return res.status(400).json({ error: "Cannot enable password login without setting a password first." });
      }
      // Validate 'otp' method requirements
      if ((loginMethod === 'otp' || loginMethod === 'both') && !user.phoneVerified) {
        return res.status(400).json({ error: "Cannot enable OTP login without verifying phone number." });
      }
      user.loginMethod = loginMethod;
    }

    // ✅ HANDLE FILE UPLOAD (from Cloudinary) or URL
    if (req.file) {
      const oldPublicId = user.profileImagePublicId;

      user.photo = req.file.path;
      user.profileImage = req.file.path;
      user.profileImagePublicId = req.file.filename;

      // Cleanup old image from Cloudinary
      if (oldPublicId) {
        try {
          const cloudinary = require("../config/cloudinary");
          await cloudinary.uploader.destroy(oldPublicId);
        } catch (e) { }
      }
    } else if (req.body.avatarUrl) {
      // Handle direct URL (cartoon selection)
      const oldPublicId = user.profileImagePublicId;

      user.photo = req.body.avatarUrl;
      user.profileImage = req.body.avatarUrl;
      user.profileImagePublicId = null;

      // Cleanup old image if it was on Cloudinary
      if (oldPublicId) {
        try {
          const cloudinary = require("../config/cloudinary");
          await cloudinary.uploader.destroy(oldPublicId);
        } catch (e) { }
      }
    }

    await user.save();

    // Return user without password
    const userObj = user.toObject();
    delete userObj.password;

    res.json({ success: true, user: userObj });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update password (simplified: current password not required while logged in)
exports.updatePassword = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("+password");
    if (!user) return res.status(404).json({ error: "User not found" });

    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: "New password required" });
    }

    // Hash and save new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();

    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Set password (for users who don't have password yet)
exports.setPassword = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("+password");
    if (!user) return res.status(404).json({ error: "User not found" });

    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: "Password required" });
    }

    if (user.password) {
      return res.status(400).json({ error: "Password already exists. Use update-password endpoint instead." });
    }

    // Hash and save password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Update login method to 'both' or 'password' if not already set
    if (user.loginMethod === 'otp') {
      user.loginMethod = 'both';
    }

    await user.save();

    res.json({ success: true, message: "Password set successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add phone number (for email login users)
exports.addPhone = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: "Phone number required" });
    }

    const cleanPhone = normalizePhone(phoneNumber);

    // Check if phone is already taken by another user
    const existingUser = await User.findOne({ phoneNumber: cleanPhone, _id: { $ne: user._id } });
    if (existingUser) {
      return res.status(400).json({ error: "Phone number already exists" });
    }

    user.phoneNumber = cleanPhone;
    user.phone = cleanPhone; // Update legacy field
    user.phoneVerified = false; // Require verification

    // Update login method to 'both' if currently only 'password'
    if (user.loginMethod === 'password') {
      user.loginMethod = 'both';
    }

    await user.save();

    res.json({
      success: true,
      message: "Phone number added successfully. Please verify it.",
      requiresVerification: true
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update photo
exports.updatePhoto = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!req.file) {
      return res.status(400).json({ error: "Photo file required" });
    }

    // Cloudinary details
    const oldPublicId = user.profileImagePublicId;

    user.photo = req.file.path;
    user.profileImage = req.file.path;
    user.profileImagePublicId = req.file.filename;
    await user.save();

    // Cleanup old image
    if (oldPublicId) {
      try {
        const cloudinary = require("../config/cloudinary");
        await cloudinary.uploader.destroy(oldPublicId);
      } catch (e) { }
    }

    res.json({ success: true, photo: user.photo, public_id: user.profileImagePublicId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update avatar (dedicated avatar upload endpoint)
exports.updateAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!req.file) {
      return res.status(400).json({ error: "Avatar file required" });
    }

    // Cloudinary path
    const oldPublicId = user.profileImagePublicId;

    user.profileImage = req.file.path;
    user.profileImagePublicId = req.file.filename;
    user.photo = req.file.path; // Keep synchronized
    await user.save();

    // Cleanup old image
    if (oldPublicId) {
      try {
        const cloudinary = require("../config/cloudinary");
        await cloudinary.uploader.destroy(oldPublicId);
      } catch (e) { }
    }

    res.json({
      success: true,
      avatar: user.profileImage,
      public_id: user.profileImagePublicId,
      message: "Avatar updated successfully"
    });
  } catch (err) {
    console.error("AVATAR UPDATE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};
// Delete account
exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.userId;

    // Delete associated WhatsApp Integration if exists
    const WhatsAppIntegration = require("../models/WhatsAppIntegration");
    await WhatsAppIntegration.deleteMany({ userId });

    // Delete user
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ success: true, message: "Account deleted successfully" });
  } catch (err) {
    console.error("DELETE ACCOUNT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};
