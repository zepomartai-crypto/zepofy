const cron = require("node-cron");
const Appointment = require("../models/Appointment");
const Settings = require("../models/Settings");
const whatsappService = require("../services/whatsappService");
const { replaceVariables, processLanguageText } = require("../modules/flowBuilder/node.handlers");
const Contact = require("../models/Contact");

/**
 * 📅 Appointment Reminder Scheduler
 * Runs every 30 minutes to check for upcoming appointments and send reminders.
 */
const startAppointmentReminderScheduler = () => {
    console.log("⏰ Appointment Reminder Scheduler Started");

    cron.schedule("*/5 * * * *", async () => {
        console.log("🔍 Checking for scheduled appointment reminders (Hour-based)...");
        
        try {
            const now = new Date();
            
            // Find all scheduled appointments that haven't received their main reminder yet
            const appointments = await Appointment.find({
                status: "scheduled",
                remindersEnabled: true,
                reminderSent: { $ne: true }
            });

            for (const appt of appointments) {
                try {
                    const settings = await Settings.findOne({ userId: appt.userId });
                    const config = settings?.appointments?.reminders;

                    if (!config?.enabled || !config?.reminderEnabled) {
                        console.log(`📅 [Reminder] ⏭️ Skipping ${appt.customerPhone}: Reminders disabled in settings.`);
                        continue;
                    }

                    // 🛠️ PARSE APPOINTMENT DATE-TIME
                    const dateStr = appt.appointmentDate;
                    const timeStr = appt.appointmentTime;
                    
                    if (!dateStr || !timeStr) {
                        console.log(`📅 [Reminder] ⚠️ Skipping ${appt.customerPhone}: Missing date/time data.`);
                        continue;
                    }

                    let day, month, year;
                    if (dateStr.includes('/')) {
                        [day, month, year] = dateStr.split('/').map(Number);
                    } else {
                        [year, month, day] = dateStr.split('-').map(Number);
                    }

                    let [timePart, period] = timeStr.split(' ');
                    let [hours, minutes] = timePart.split(':').map(Number);
                    
                    if (period === 'PM' && hours < 12) hours += 12;
                    if (period === 'AM' && hours === 12) hours = 0;
                    
                    const apptDateTime = new Date(year, month - 1, day, hours, minutes);
                    
                    // 🛡️ REMINDER LOGIC: Appt Time - X Hours
                    const hoursBefore = config.reminderHoursBefore || 2;
                    const reminderTargetTime = new Date(apptDateTime.getTime() - (hoursBefore * 60 * 60 * 1000));

                    console.log(`📅 [Reminder] Checking ${appt.customerPhone} | Appt: ${apptDateTime.toLocaleString()} | Target: ${reminderTargetTime.toLocaleString()}`);

                    // Check if it's time to send
                    if (now >= reminderTargetTime) {
                        if (now >= apptDateTime) {
                            console.log(`📅 [Reminder] ⏭️ Skipping ${appt.customerPhone}: Appointment time has already passed.`);
                            // Mark as sent so we don't keep checking old appointments
                            appt.reminderSent = true;
                            await appt.save();
                            continue;
                        }

                        const variables = {
                            patient_name: appt.customerName || "Patient",
                            appointment_date: appt.appointmentDate || "N/A",
                            appointment_time: appt.appointmentTime || "N/A",
                            clinic_name: appt.clinicName || "Zepofy Clinic"
                        };

                        const rawTemplate = config.reminderMessage || "Hello {{patient_name}}, this is a reminder for your appointment on {{appointment_date}} at {{appointment_time}}.";
                        const message = replaceVariables(rawTemplate, variables);

                        console.log(`📅 [Reminder] 🚀 MATCH! Sending ${hoursBefore}h reminder to ${appt.customerPhone}...`);
                        
                        await whatsappService.sendTextMessage(appt.userId, appt.customerPhone, message);
                        
                        // Mark as sent
                        appt.reminderSent = true;
                        appt.dayOfReminderSent = true;
                        await appt.save();

                        console.log(`📅 [Reminder] ✅ DONE: Reminder sent successfully.`);
                    } else {
                        console.log(`📅 [Reminder] ⏳ Still waiting for ${appt.customerPhone}. (Will send at ${reminderTargetTime.toLocaleTimeString()})`);
                    }
                } catch (err) {
                    console.error(`❌ Error processing reminder for ${appt.customerPhone}:`, err.message);
                }
            }
        } catch (err) {
            console.error("❌ Scheduler Error:", err.message);
        }
    });
};

module.exports = { startAppointmentReminderScheduler };
