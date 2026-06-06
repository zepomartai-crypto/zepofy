const SystemSettings = require("../../models/SystemSettings");
const AdminLog = require("../../models/AdminLog");

exports.getMaintenanceMode = async (req, res) => {
    try {
        const setting = await SystemSettings.findOne({ key: 'maintenance' });
        res.json({
            success: true,
            data: setting ? setting.value : { enabled: false, message: "System is under maintenance" }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.updateMaintenanceMode = async (req, res) => {
    try {
        const { enabled, message } = req.body;

        const setting = await SystemSettings.findOneAndUpdate(
            { key: 'maintenance' },
            {
                value: { enabled, message },
                updatedBy: req.user._id
            },
            { upsert: true, new: true }
        );

        await AdminLog.create({
            adminId: req.user._id,
            action: enabled ? 'ENABLE_MAINTENANCE' : 'DISABLE_MAINTENANCE',
            details: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}: ${message}`,
            ip: req.ip
        });

        res.json({ success: true, data: setting.value, message: "Maintenance mode updated" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};