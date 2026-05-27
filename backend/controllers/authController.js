const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  }
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }
    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }
    req.session.user = {
      user_id: user.user_id,
      username: user.username,
      role: user.role
    };
    return res.json({ success: true, message: 'Login successful.', user: { username: user.username, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
}

function logout(req, res) {
  req.session.destroy(() => {
    res.json({ success: true, message: 'Logged out successfully.' });
  });
}

function me(req, res) {
  if (req.session && req.session.user) {
    return res.json({ success: true, user: req.session.user });
  }
  return res.status(401).json({ success: false, message: 'Not logged in.' });
}

async function seedAdminIfEmpty() {
  try {
    const [rows] = await pool.query('SELECT COUNT(*) AS count FROM users');
    if (rows[0].count === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      await pool.query('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', ['admin', hash, 'Admin']);
      console.log('✅ Default admin created → username: admin | password: admin123');
    }
  } catch (err) {
    console.error('Seed admin error:', err.message);
  }
}

module.exports = { login, logout, me, seedAdminIfEmpty };