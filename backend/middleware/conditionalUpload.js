/* 
DEPRECATED: Local storage upload logic.
Ignored in favor of Cloudinary storage.
*/
/*
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const templateDir = path.join(process.cwd(), "uploads/template");

// ensure folder exists (VERY IMPORTANT FOR RENDER)
if (!fs.existsSync(templateDir)) {
  fs.mkdirSync(templateDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, templateDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `template_${Date.now()}${ext}`);
  },
});

module.exports = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files allowed"));
    }
    cb(null, true);
  },
}).single("image");
*/
