const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Dynamic folder structure: zepofy/{userId}/templates
    const userId = req.userId || "default";
    const uploadType = req.uploadType || "misc";

    return {
      folder: `zepofy/${userId}/${uploadType}`,
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      transformation: [{ width: 1000, height: 1000, crop: "limit" }]
    };
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// 🔥 NEW: Specialized CSV Upload for Campaign Numbers
const csvStorage = multer.memoryStorage();
const csvFilter = (req, file, cb) => {
  const extension = file.originalname.split('.').pop().toLowerCase();
  if (extension === 'csv' || file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel') {
    cb(null, true);
  } else {
    cb(new Error("Only CSV files are allowed!"), false);
  }
};

const csvUpload = multer({
  storage: csvStorage,
  fileFilter: csvFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit for CSVs
});

module.exports = {
  upload,
  csvUpload
};
