const Tag = require("../models/Tag");

exports.getTags = async (req, res) => {
  try {
    const tags = await Tag.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, tags });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createTag = async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "Tag name is required" });

    const tag = await Tag.create({
      userId: req.user._id,
      name: name.trim(),
      color: color || "#3b82f6",
    });

    res.json({ success: true, tag });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, error: "Tag already exists" });
    }
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateTag = async (req, res) => {
  try {
    const { name, color } = req.body;
    const tag = await Tag.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { name: name.trim(), color },
      { new: true }
    );

    if (!tag) return res.status(404).json({ success: false, error: "Tag not found" });

    res.json({ success: true, tag });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteTag = async (req, res) => {
  try {
    const tag = await Tag.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!tag) return res.status(404).json({ success: false, error: "Tag not found" });

    res.json({ success: true, message: "Tag deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
