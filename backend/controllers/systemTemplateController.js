const SystemTemplate = require("../models/SystemTemplate");

/* ---------------- GET ALL TEMPLATES ---------------- */
exports.getAll = async (req, res) => {
    try {
        const templates = await SystemTemplate.find({ userId: req.userId }).sort({ createdAt: -1 });
        res.json(templates);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

/* ---------------- CREATE NEW TEMPLATE ---------------- */
exports.create = async (req, res) => {
    try {
        const { name, type, message, imageUrl, buttons, variables } = req.body;

        if (!name || !message) {
            return res.status(400).json({ success: false, error: "Name and Message are required" });
        }

        const template = await SystemTemplate.create({
            userId: req.userId,
            name,
            type: type || 'text',
            message,
            imageUrl,
            buttons: buttons || [],
            variables: variables || []
        });

        res.status(201).json({ success: true, data: template });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

/* ---------------- UPDATE TEMPLATE ---------------- */
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, type, message, imageUrl, buttons, variables } = req.body;

        const template = await SystemTemplate.findOneAndUpdate(
            { _id: id, userId: req.userId },
            { name, type, message, imageUrl, buttons, variables },
            { new: true }
        );

        if (!template) return res.status(404).json({ success: false, error: "Template not found" });

        res.json({ success: true, data: template });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

/* ---------------- DELETE TEMPLATE ---------------- */
exports.delete = async (req, res) => {
    try {
        const { id } = req.params;
        const template = await SystemTemplate.findOneAndDelete({ _id: id, userId: req.userId });

        if (!template) return res.status(404).json({ success: false, error: "Template not found" });

        res.json({ success: true, message: "System template deleted successfully" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
