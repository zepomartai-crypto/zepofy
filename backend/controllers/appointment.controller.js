const Appointment = require("../models/Appointment");
const Settings = require("../models/Settings");
const whatsappService = require("../services/whatsappService");
const { replaceVariables, processLanguageText } = require("../modules/flowBuilder/node.handlers");
const Contact = require("../models/Contact");

exports.getAppointments = async (req, res) => {
  try {
    const userId = req.userId;
    const { status, date } = req.query;
    
    let query = { userId };
    if (status) query.status = status;
    if (date) query.appointmentDate = date;

    const appointments = await Appointment.find(query)
      .populate("contactId", "name phone")
      .sort({ appointmentDate: 1, appointmentTime: 1 });

    res.json({ success: true, data: appointments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const appointment = await Appointment.findOneAndUpdate(
      { _id: id, userId: req.userId },
      { status },
      { new: true }
    ).populate("contactId");

    if (!appointment) {
      return res.status(404).json({ success: false, error: "Appointment not found" });
    }

    // 🚀 WhatsApp Notification Logic
    try {
        const customerPhone = appointment.contactId?.phone || appointment.customerPhone;
        const customerName = appointment.contactId?.name || appointment.customerName;

        // Fetch user settings for personalized messages
        const settings = await Settings.findOne({ userId: req.userId });
        const apptSettings = settings?.appointments?.reminders || {};

        if (status === 'scheduled') {
            // Only send if confirmation is enabled in settings
            if (apptSettings.enabled !== false && apptSettings.confirmationEnabled !== false) {
                const rawMessage = apptSettings.confirmationMessage || `Hello {{patient_name}}, your appointment has been confirmed for {{appointment_date}} at {{appointment_time}}. See you then!`;
                
                const variables = {
                    patient_name: customerName,
                    appointment_date: appointment.appointmentDate,
                    appointment_time: appointment.appointmentTime,
                    clinic_name: appointment.clinicName || "our clinic"
                };

                const finalMessage = replaceVariables(rawMessage, variables);
                await whatsappService.sendTextMessage(req.userId, customerPhone, finalMessage);
                console.log(`✅ [Appointment] Confirmation message sent to ${customerPhone}`);
            }
            
            // Mark as confirmation handled
            await Appointment.findByIdAndUpdate(appointment._id, { confirmationReminderSent: true });
            appointment.confirmationReminderSent = true; // Update local object for socket emit
        } 
        else if (status === 'cancelled') {
            const message = `Hello ${customerName}, your appointment for ${appointment.appointmentDate} at ${appointment.appointmentTime} has been cancelled. If this was a mistake, please contact us.`;
            await whatsappService.sendTextMessage(req.userId, customerPhone, message);
            console.log(`✅ [Appointment] Cancellation message sent to ${customerPhone}`);
        }

        // 🔥 REAL-TIME SOCKET UPDATE
        if (global.io) {
            global.io.to(req.userId.toString()).emit("appointment_updated", appointment);
        }
    } catch (msgError) {
        console.error(`❌ [Appointment] Failed to send WhatsApp notification:`, msgError.message);
    }

    res.json({ success: true, data: appointment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findOneAndDelete({ _id: id, userId: req.userId });
    
    if (!appointment) {
      return res.status(404).json({ success: false, error: "Appointment not found" });
    }

    // 🔥 REAL-TIME SOCKET UPDATE
    if (global.io) {
        global.io.to(req.userId.toString()).emit("appointment_deleted", id);
    }

    res.json({ success: true, message: "Appointment deleted" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
