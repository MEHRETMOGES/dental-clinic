const { pool } = require('../config/database');

function isValidPhone(phone) {
  return /^(\+2519\d{8}|09\d{8})$/.test(phone);
}

function isValidName(name) {
  return /^[a-zA-Z\u00C0-\u024F\s'-]+$/.test(name.trim());
}

async function registerPatient(req, res) {
  const { first_name, last_name, phone_number, age } = req.body;
  if (!first_name || !last_name || !phone_number || !age) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }
  if (!isValidName(first_name) || !isValidName(last_name)) {
    return res.status(400).json({ success: false, message: 'Names must not contain numbers or special characters.' });
  }
  if (!isValidPhone(phone_number)) {
    return res.status(400).json({ success: false, message: 'Phone must start with +251 or 09.' });
  }
  const ageNum = parseInt(age);
  if (isNaN(ageNum) || ageNum <= 0 || ageNum >= 120) {
    return res.status(400).json({ success: false, message: 'Age must be between 1 and 119.' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO patients (first_name, last_name, phone_number, age) VALUES (?, ?, ?, ?)',
      [first_name.trim(), last_name.trim(), phone_number.trim(), ageNum]
    );
    return res.status(201).json({ success: true, message: 'Patient registered successfully.', patient_id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'A patient with this phone number already exists.' });
    }
    console.error('Register patient error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function getAllPatients(req, res) {
  const { search } = req.query;
  try {
    let query = 'SELECT patient_id, first_name, last_name, phone_number, age, created_at FROM patients';
    let params = [];
    if (search) {
      query += ' WHERE first_name LIKE ? OR last_name LIKE ? OR phone_number LIKE ?';
      const term = `%${search}%`;
      params = [term, term, term];
    }
    query += ' ORDER BY created_at DESC';
    const [rows] = await pool.query(query, params);
    return res.json({ success: true, patients: rows });
  } catch (err) {
    console.error('Get patients error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function getPatientById(req, res) {
  const { id } = req.params;
  try {
    const [patients] = await pool.query(
      'SELECT patient_id, first_name, last_name, phone_number, age, created_at FROM patients WHERE patient_id = ?', [id]
    );
    if (patients.length === 0) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }
    const [appointments] = await pool.query(
      'SELECT appointment_id, appointment_date, appointment_time, procedure_type, status FROM appointments WHERE patient_id = ? ORDER BY appointment_date DESC', [id]
    );
    return res.json({ success: true, patient: patients[0], appointments });
  } catch (err) {
    console.error('Get patient error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function updatePatient(req, res) {
  const { id } = req.params;
  const { first_name, last_name, phone_number, age } = req.body;
  if (!first_name || !last_name || !phone_number || !age) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }
  if (!isValidPhone(phone_number)) {
    return res.status(400).json({ success: false, message: 'Invalid phone number format.' });
  }
  try {
    const [result] = await pool.query(
      'UPDATE patients SET first_name=?, last_name=?, phone_number=?, age=? WHERE patient_id=?',
      [first_name.trim(), last_name.trim(), phone_number.trim(), parseInt(age), id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }
    return res.json({ success: true, message: 'Patient updated successfully.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Phone number already used by another patient.' });
    }
    console.error('Update patient error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = { registerPatient, getAllPatients, getPatientById, updatePatient };