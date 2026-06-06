const express = require('express');
const router = express.Router();
const appointmentFlowController = require('../../controllers/flows/appointmentFlow.controller');

// Mount flow-specific webhooks
// Expected URL: POST /api/webhook/whatsapp/flows/appointment-booking 
// Or based on app.js mounting: POST /api/flows-webhook/appointment-booking

router.post('/appointment-booking', appointmentFlowController.handleAppointmentFlow);

// Add future flow handlers here
// router.post('/hotel-booking', hotelFlowController.handleHotelFlow);
// router.post('/customer-registration', registrationFlowController.handleRegistrationFlow);

module.exports = router;
