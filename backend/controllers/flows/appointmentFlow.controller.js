const WhatsAppIntegration = require("../../models/WhatsAppIntegration");
const Appointment = require("../../models/Appointment");
const encryptionUtil = require("../../utils/meta-flow/encryption.util");
const responseUtil = require("../../utils/meta-flow/response.util");

/**
 * Handles the WhatsApp Flow Data Exchange endpoint specifically for Appointment Booking.
 */
exports.handleAppointmentFlow = async (req, res) => {
  console.log("➡️ [Flow] Appointment Booking request received.");
  
  try {
    let { body, query } = req;
    const { phoneNumberId } = query;

    // The rawParserStandard sets req.body as a Buffer. We must parse it to JSON.
    if (Buffer.isBuffer(body)) {
      try {
        body = JSON.parse(body.toString('utf8'));
      } catch (e) {
        return res.status(400).send("Invalid JSON payload");
      }
    }

    // 1. Fetch available integrations that have a flowPrivateKey
    let integrationQuery = { flowPrivateKey: { $exists: true } };
    if (phoneNumberId) {
      integrationQuery.phoneNumberId = phoneNumberId;
    }
    const integrations = await WhatsAppIntegration.find(integrationQuery).select("+flowPrivateKey");

    // 2. Decrypt the payload
    let decryptedData;
    try {
      decryptedData = encryptionUtil.resolveAndDecrypt(body, integrations);
    } catch (err) {
      if (err.message === "NO_KEYS" || err.message === "DECRYPTION_FAILED") {
        console.error(`❌ [Flow] Decryption failed: ${err.message}. Sending 421 to trigger key refresh.`);
        return res.status(421).send();
      }
      throw err;
    }

    const { decryptedBody, aesKeyBuffer, initialVectorBuffer, integration } = decryptedData;
    console.log(`✅ [Flow] Payload decrypted successfully for integration: ${integration.wabaId}`);
    
    // Add logging to debug incoming payload structures
    console.log("Raw Decrypted Payload", JSON.stringify(decryptedBody, null, 2));

    const action = decryptedBody.action || (decryptedBody.data && decryptedBody.data.action);
    const screen = decryptedBody.screen;
    const data = decryptedBody.data || decryptedBody;
    
    console.log("Action", action);
    console.log("Data", data);
    console.log("Screen", screen);

    // 3. Handle Health Check (ping)
    if (action === "ping") {
      console.log("✅ [Flow] Health check received and verified.");
      const pingResponse = encryptionUtil.encryptFlowResponse(
        { data: { status: "active" } },
        aesKeyBuffer,
        initialVectorBuffer
      );
      return res.status(200).send(pingResponse);
    }

    // 4. Process Form Submission
    if (action === "data_exchange" || screen || action === "submit_form") {
      console.log("➡️ [Flow] Processing appointment submission data:", data);

      // Try to get fields by explicit names first
      let patient_name = data.patient_name;
      let phone_number = data.phone_number;
      let appointment_date = data.appointment_date || data.date;
      let department = data.department;

      // SMART AUTO-DETECTION: Zepofy Builder sometimes uses random IDs (like comp_1234)
      // This logic perfectly matches the values to the correct fields automatically!
      if (!patient_name || !phone_number || !appointment_date) {
        Object.values(data).forEach(val => {
          if (typeof val === 'string') {
            const trimmed = val.trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
              appointment_date = trimmed; // Matches YYYY-MM-DD
            } else if (/^\d{9,15}$/.test(trimmed)) {
              phone_number = trimmed; // Matches Phone numbers
            } else if (!patient_name) {
              patient_name = trimmed; // First normal string is Name
            } else if (!department) {
              department = trimmed; // Second normal string is Department
            }
          }
        });
      }

      // Validation
      if (!patient_name || !phone_number || !appointment_date) {
        console.error(`❌ [Flow] Validation failed. Missing required fields. Parsed -> Name: ${patient_name}, Phone: ${phone_number}, Date: ${appointment_date}`);
        return res.status(400).send("Missing required fields");
      }

      // Format appointment time if not provided (defaulting to a general time or based on further form logic)
      const appointmentTime = data.appointment_time || "09:00";

      // Insert into Database
      const newAppointment = await Appointment.create({
        userId: integration.userId, // Map the appointment to the integration's user account
        customerName: patient_name,
        customerPhone: phone_number,
        appointmentDate: appointment_date,
        appointmentTime: appointmentTime,
        department: department,
        clinicName: department, // Kept for backwards compatibility with existing UI if needed
        status: "pending",
        source: "whatsapp_flow",
        metaData: {
          flowSubmissionData: data
        }
      });

      console.log(`✅ [Flow] Appointment created successfully: ${newAppointment._id}`);

      // 5. Return Success Screen Response
      const successScreen = responseUtil.generateSuccessScreen(
        "Appointment Request Submitted",
        "Thank you for booking an appointment. Our team will contact you shortly to confirm your booking."
      );

      const encryptedResponse = encryptionUtil.encryptFlowResponse(
        successScreen,
        aesKeyBuffer,
        initialVectorBuffer
      );

      console.log("✅ [Flow] Meta response sent.");
      return res.status(200).send(encryptedResponse);
    }

    // Unhandled action
    return res.status(400).send("Unhandled action type");

  } catch (error) {
    console.error("❌ [Flow] Appointment Flow Error:", error);
    res.status(500).send(`Internal Server Error: ${error.message}`);
  }
};
