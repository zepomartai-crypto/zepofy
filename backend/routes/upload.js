const express = require("express");
const router = express.Router();
const { upload } = require("../middleware/upload");
const uploadController = require("../controllers/uploadController");
const auth = require("../middleware/auth");

// Standardize: Field name should be "image" for all, but assigned a dynamic folder via uploadType

// TEMPLATE IMAGE UPLOAD
router.post("/template-image",
  auth,
  (req, res, next) => { req.uploadType = "templates"; next(); },
  upload.single("image"),
  uploadController.uploadImage
);

// AVATAR UPLOAD
router.post("/avatar",
  auth,
  (req, res, next) => { req.uploadType = "avatars"; next(); },
  upload.single("image"),
  uploadController.uploadImage
);

// PRODUCT UPLOAD
router.post("/product",
  auth,
  (req, res, next) => { req.uploadType = "products"; next(); },
  upload.single("image"),
  uploadController.uploadImage
);

// CAMPAIGN IMAGE UPLOAD
router.post("/campaign",
  auth,
  (req, res, next) => { req.uploadType = "campaigns"; next(); },
  upload.single("image"),
  uploadController.uploadImage
);

// GENERIC UPLOAD
router.post("/",
  auth,
  (req, res, next) => { req.uploadType = "misc"; next(); },
  upload.single("image"),
  uploadController.uploadImage
);

// DELETE IMAGE
router.post("/delete", auth, uploadController.deleteImage);

module.exports = router;
