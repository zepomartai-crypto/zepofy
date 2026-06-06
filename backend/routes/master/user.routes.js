const express = require("express");
const router = express.Router();
const userController = require("../../controllers/master/user.controller");

// 🔥 User Management Routes
router.get("/", userController.getAllUsers);
router.get("/tenants/active", userController.getActiveTenants);
router.get("/:id", userController.getUserById);                // Enhanced user details
router.post("/create", userController.createUser);

// 🔥 User Action Routes
router.patch("/:id/status", userController.updateUserStatus);        // ACTIVE/INACTIVE
router.patch("/:id/block", userController.updateUserBlock);          // Block/Unblock
router.patch("/:id/reset-password", userController.resetUserPassword); // Reset Password
router.patch("/:id/plan", userController.updateUserPlan);             // Update Plan
router.patch("/:id/force-logout", userController.forceLogoutUser);     // Force Logout
router.post("/:id/impersonate", userController.impersonateUser);      // Impersonate Login
router.delete("/:id", userController.deleteUser);                    // Delete User

module.exports = router;
