const express = require("express");
const router = express.Router();
const appointmentController = require("../controllers/appointment.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.use(authMiddleware.verifyToken);
router.use(authMiddleware.checkPermission("appointments"));
router.get("/", appointmentController.getAppointments);
router.patch("/:id/status", appointmentController.updateAppointmentStatus);
router.delete("/:id", appointmentController.deleteAppointment);

module.exports = router;
