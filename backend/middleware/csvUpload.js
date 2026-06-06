const multer = require('multer');

const storage = multer.memoryStorage(); // ✅ IMPORTANT

const csvUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (!file.originalname.match(/\.csv$/)) {
      return cb(new Error('Only CSV files are allowed'), false);
    }
    cb(null, true);
  }
});

module.exports = csvUpload;
