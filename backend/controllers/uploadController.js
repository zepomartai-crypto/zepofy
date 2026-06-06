const cloudinary = require("../config/cloudinary");

/**
 * Handle Image Upload Response
 * Returns Cloudinary URL and Public ID
 */
exports.uploadImage = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    res.json({
      success: true,
      url: req.file.path, // This is the Cloudinary secure URL
      imageUrl: req.file.path, // Compatibility key
      public_id: req.file.filename,
      message: "Image uploaded successfully to Cloudinary"
    });
  } catch (error) {
    console.error("Upload Response Error:", error);
    res.status(500).json({ error: "Failed to process upload response" });
  }
};

/**
 * Delete Image from Cloudinary
 */
exports.deleteImage = async (req, res) => {
  try {
    const { public_id } = req.body;
    if (!public_id) {
      return res.status(400).json({ error: "public_id is required" });
    }

    const result = await cloudinary.uploader.destroy(public_id);
    res.json({ success: true, result });
  } catch (error) {
    console.error("Cloudinary Delete Error:", error);
    res.status(500).json({ error: "Failed to delete image from Cloudinary" });
  }
};
