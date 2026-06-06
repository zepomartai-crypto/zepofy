const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      required: false,
    },
    customerName: {
      type: String,
      required: true,
    },
    customerPhone: {
      type: String,
      required: true,
    },
    appointmentDate: {
      type: String, // Storing as string "YYYY-MM-DD" for easy comparison
      required: true,
    },
    appointmentTime: {
      type: String, // Storing as string "HH:mm" or "12 PM"
      required: true,
    },
    clinicName: {
      type: String,
      default: "General Clinic",
    },
    status: {
      type: String,
      enum: ["pending", "scheduled", "completed", "cancelled", "no-show"],
      default: "pending",
    },
    notes: String,
    metaData: {
      type: Object, // Store any additional flow variables
    },
    // --- Automated Reminders System ---
    remindersEnabled: {
      type: Boolean,
      default: true
    },
    confirmationReminderSent: {
      type: Boolean,
      default: false
    },
    dayOfReminderSent: {
      type: Boolean,
      default: false
    },
    // Deprecated in favor of the above
    reminderSent: {
      type: Boolean,
      default: false
    },
    department: {
      type: String,
      required: false // Optional for backwards compatibility, but required in new flows
    },
    source: {
      type: String,
      default: "system" // "whatsapp_flow", "manual", etc.
    }
  },
  { timestamps: true }
);

// Index for double booking check
appointmentSchema.index({ userId: 1, appointmentDate: 1, appointmentTime: 1 }, { unique: false });

module.exports = mongoose.model("Appointment", appointmentSchema);
