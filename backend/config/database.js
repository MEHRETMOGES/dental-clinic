const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dental_clinic_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function initializeDatabase() {
  const connection = await pool.getConnection();
  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'dental_clinic_db'}\``);
    await connection.query(`USE \`${process.env.DB_NAME || 'dental_clinic_db'}\``);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id     INT PRIMARY KEY AUTO_INCREMENT,
        username    VARCHAR(50) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role        ENUM('Receptionist', 'Admin') NOT NULL DEFAULT 'Receptionist',
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS patients (
        patient_id    INT PRIMARY KEY AUTO_INCREMENT,
        first_name    VARCHAR(50) NOT NULL,
        last_name     VARCHAR(50) NOT NULL,
        phone_number  VARCHAR(15) NOT NULL UNIQUE,
        age           INT NOT NULL,
        telegram_chat_id BIGINT DEFAULT NULL,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        appointment_id   INT PRIMARY KEY AUTO_INCREMENT,
        patient_id       INT NOT NULL,
        appointment_date DATE NOT NULL,
        appointment_time VARCHAR(5) NOT NULL,
        procedure_type   VARCHAR(100) NOT NULL DEFAULT 'General Checkup',
        status           ENUM('Scheduled','In-Progress','Completed','Cancelled') NOT NULL DEFAULT 'Scheduled',
        booked_by        INT DEFAULT NULL,
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
        UNIQUE KEY unique_slot (appointment_date, appointment_time)
      )
    `);

    console.log('✅ Database tables initialized successfully.');
  } catch (err) {
    console.error('❌ Database initialization error:', err.message);
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = { pool, initializeDatabase };