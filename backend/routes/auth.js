const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const auth = require("../middleware/auth");
const { upload } = require("../middleware/upload");

// ✅ OTP AUTH ROUTES
router.post("/send-register-otp", authController.sendRegisterOtp);
router.post("/verify-register-otp", authController.verifyRegisterOtp);

router.post("/send-login-otp", authController.sendLoginOtp);
router.post("/verify-login-otp", authController.verifyLoginOtp);

// ✅ PASSWORD AUTH
router.post("/login-password", authController.loginPassword);

// ✅ PROTECTED ROUTES
router.get("/me", auth, authController.me);

// ================= UPLOAD AVATAR =================
router.post(
  "/upload-avatar",
  auth,
  upload.single("avatar"),
  authController.uploadAvatar
);

router.put(
  "/profile",
  auth,
  upload.single("photo"),
  authController.updateProfile
);
router.put("/profile/password", auth, authController.updatePassword);
router.post("/profile/set-password", auth, authController.setPassword);
router.post("/profile/add-phone", auth, authController.addPhone);
router.put("/profile/photo", auth, upload.single("photo"), authController.updatePhoto);
router.delete("/profile", auth, authController.deleteAccount);

module.exports = router;
