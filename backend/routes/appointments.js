const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  bookAppointment, getTodayAppointments, getAppointmentsByDate,
  updateAppointmentStatus, cancelAppointment, getAvailableSlots
} = require('../controllers/appointmentController');

router.use(requireAuth);
router.post('/', bookAppointment);
router.get('/today', getTodayAppointments);
router.get('/date/:date', getAppointmentsByDate);
router.get('/slots/:date', getAvailableSlots);
router.patch('/:id/status', updateAppointmentStatus);
router.patch('/:id/cancel', cancelAppointment);

module.exports = router;