const { pool } = require('../config/database');

const VALID_TIMES = [
  '08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
  '12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30',
  '16:00','16:30','17:00'
];

const userSessions = {};

async function handleTelegramUpdate(req, res) {
  res.sendStatus(200);
  const update = req.body;
  if (!update.message) return;
  const chatId = update.message.chat.id;
  const text = (update.message.text || '').trim();
  const session = userSessions[chatId] || { step: 'start' };

  try {
    if (text === '/start' || text.toLowerCase() === 'hi' || text.toLowerCase() === 'hello') {
      session.step = 'start';
      await sendMessage(chatId,
        '🦷 Welcome to *Dr. Getaneh Dental Clinic*!\n\nPlease enter your phone number to continue.\n_(Format: 09XXXXXXXX or +251XXXXXXXXX)_',
        { parse_mode: 'Markdown' }
      );
      session.step = 'awaiting_phone';
    } else if (session.step === 'awaiting_phone') {
      const phone = text;
      if (!/^(\+2519\d{8}|09\d{8})$/.test(phone)) {
        await sendMessage(chatId, '❌ Invalid phone number. Please use format: 09XXXXXXXX or +251XXXXXXXXX');
        return;
      }
      const [patients] = await pool.query('SELECT * FROM patients WHERE phone_number = ?', [phone]);
      if (patients.length === 0) {
        await sendMessage(chatId, '❌ No patient found with that phone number. Please visit the clinic to register first.');
        return;
      }
      session.patient = patients[0];
      await pool.query('UPDATE patients SET telegram_chat_id = ? WHERE patient_id = ?', [chatId, patients[0].patient_id]);
      await sendMessage(chatId,
        `✅ Welcome, *${patients[0].first_name}*!\n\nType the date you want to book (YYYY-MM-DD)\nExample: *2026-06-15*`,
        { parse_mode: 'Markdown' }
      );
      session.step = 'awaiting_date';
    } else if (session.step === 'awaiting_date') {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(text)) {
        await sendMessage(chatId, '❌ Invalid date format. Use YYYY-MM-DD. Example: 2026-06-15');
        return;
      }
      const today = new Date().toISOString().split('T')[0];
      if (text < today) {
        await sendMessage(chatId, '❌ Cannot book in the past. Please enter a future date.');
        return;
      }
      session.date = text;
      const [booked] = await pool.query(
        'SELECT appointment_time FROM appointments WHERE appointment_date = ? AND status != "Cancelled"', [text]
      );
      const bookedTimes = booked.map(r => r.appointment_time);
      const available = VALID_TIMES.filter(t => !bookedTimes.includes(t));
      if (available.length === 0) {
        await sendMessage(chatId, `❌ No available slots on ${text}. Please try another date.`);
        return;
      }
      await sendMessage(chatId,
        `📅 Available times on *${text}*:\n\n${available.join('   ')}\n\nReply with your preferred time (e.g. *09:00*)`,
        { parse_mode: 'Markdown' }
      );
      session.step = 'awaiting_time';
    } else if (session.step === 'awaiting_time') {
      if (!VALID_TIMES.includes(text)) {
        await sendMessage(chatId, '❌ Invalid time. Please choose from the available slots shown above.');
        return;
      }
      const [conflict] = await pool.query(
        'SELECT appointment_id FROM appointments WHERE appointment_date = ? AND appointment_time = ? AND status != "Cancelled"',
        [session.date, text]
      );
      if (conflict.length > 0) {
        await sendMessage(chatId, '❌ That slot was just taken. Please choose another time.');
        return;
      }
      await pool.query(
        'INSERT INTO appointments (patient_id, appointment_date, appointment_time, procedure_type, status) VALUES (?, ?, ?, "General Checkup", "Scheduled")',
        [session.patient.patient_id, session.date, text]
      );
      await sendMessage(chatId,
        `✅ *Appointment Confirmed!*\n\n👤 Patient: ${session.patient.first_name} ${session.patient.last_name}\n📅 Date: ${session.date}\n🕐 Time: ${text}\n\nWe look forward to seeing you! 🦷`,
        { parse_mode: 'Markdown' }
      );
      session.step = 'start';
    } else {
      await sendMessage(chatId, 'Type /start to begin booking an appointment.');
    }
  } catch (err) {
    console.error('Telegram handler error:', err);
    await sendMessage(chatId, '❌ Something went wrong. Please try again.');
  }
  userSessions[chatId] = session;
}

async function sendMessage(chatId, text, options = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === 'skip_for_now' || token === 'your_token_here') return;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, ...options })
  });
}

module.exports = { handleTelegramUpdate };