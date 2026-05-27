const { pool } = require('../config/database');

const VALID_TIMES = [
  '08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
  '12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30',
  '16:00','16:30','17:00'
];

async function bookAppointment(req, res) {
  const { patient_id, appointment_date, appointment_time, procedure_type } = req.body;
  if (!patient_id || !appointment_date || !appointment_time) {
    return res.status(400).json({ success: false, message: 'Patient, date, and time are required.' });
  }
  if (!VALID_TIMES.includes(appointment_time)) {
    return res.status(400).json({ success: false, message: 'Time must be between 08:00 and 17:00.' });
  }
  const today = new Date().toISOString().split('T')[0];
  if (appointment_date < today) {
    return res.status(400).json({ success: false, message: 'Appointment date cannot be in the past.' });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.query(
      'SELECT appointment_id FROM appointments WHERE appointment_date = ? AND appointment_time = ? FOR UPDATE',
      [appointment_date, appointment_time]
    );
    if (existing.length > 0) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'That time slot is already booked.' });
    }
    const [result] = await connection.query(
      'INSERT INTO appointments (patient_id, appointment_date, appointment_time, procedure_type, status, booked_by) VALUES (?, ?, ?, ?, "Scheduled", ?)',
      [patient_id, appointment_date, appointment_time, procedure_type || 'General Checkup', req.session?.user?.user_id || null]
    );
    await connection.commit();
    return res.status(201).json({ success: true, message: 'Appointment booked successfully.', appointment_id: result.insertId });
  } catch (err) {
    await connection.rollback();
    console.error('Book appointment error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    connection.release();
  }
}

async function getTodayAppointments(req, res) {
  const today = new Date().toISOString().split('T')[0];
  try {
    const [rows] = await pool.query(
      `SELECT a.appointment_id, a.appointment_date, a.appointment_time, a.procedure_type, a.status,
              p.first_name, p.last_name, p.phone_number, p.patient_id
       FROM appointments a
       JOIN patients p ON a.patient_id = p.patient_id
       WHERE a.appointment_date = ?
       ORDER BY a.appointment_time ASC`,
      [today]
    );
    return res.json({ success: true, appointments: rows });
  } catch (err) {
    console.error('Get today error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function getAppointmentsByDate(req, res) {
  const { date } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT a.appointment_id, a.appointment_date, a.appointment_time, a.procedure_type, a.status,
              p.first_name, p.last_name, p.phone_number, p.patient_id
       FROM appointments a
       JOIN patients p ON a.patient_id = p.patient_id
       WHERE a.appointment_date = ?
       ORDER BY a.appointment_time ASC`,
      [date]
    );
    return res.json({ success: true, appointments: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function updateAppointmentStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ['Scheduled', 'In-Progress', 'Completed', 'Cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status.' });
  }
  try {
    const [result] = await pool.query(
      'UPDATE appointments SET status = ? WHERE appointment_id = ?', [status, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }
    return res.json({ success: true, message: 'Status updated.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function cancelAppointment(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT status FROM appointments WHERE appointment_id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Appointment not found.' });
    if (rows[0].status === 'Completed') {
      return res.status(400).json({ success: false, message: 'Cannot cancel a completed appointment.' });
    }
    await pool.query('UPDATE appointments SET status = "Cancelled" WHERE appointment_id = ?', [id]);
    return res.json({ success: true, message: 'Appointment cancelled.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function getAvailableSlots(req, res) {
  const { date } = req.params;
  try {
    const [booked] = await pool.query(
      'SELECT appointment_time FROM appointments WHERE appointment_date = ? AND status != "Cancelled"',
      [date]
    );
    const bookedTimes = booked.map(r => r.appointment_time);
    const available = VALID_TIMES.filter(t => !bookedTimes.includes(t));
    return res.json({ success: true, available_slots: available });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = { bookAppointment, getTodayAppointments, getAppointmentsByDate, updateAppointmentStatus, cancelAppointment, getAvailableSlots };