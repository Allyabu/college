const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const router = express.Router();

router.post('/register', async (req, res) => {
  const { username, password, role, name, collegeRole } = req.body;
  if (role !== 'staff') return res.status(400).json({ error: 'Only staff can register' });
  if (!collegeRole || !['Cleaner', 'Security', 'Gardener', 'Cook'].includes(collegeRole)) {
    return res.status(400).json({ error: 'Invalid college role' });
  }
  if (!name || !username) {
    return res.status(400).json({ error: 'Name and username are required' });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  db.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', 
    [username, hashedPassword, role], 
    (err, result) => {
      if (err) return res.status(400).json({ error: 'User already exists or database error' });
      db.query('INSERT INTO staff (user_id, name, role) VALUES (?, ?, ?)',
        [result.insertId, name, collegeRole],
        (staffErr) => {
          if (staffErr) return res.status(500).json({ error: 'Failed to create staff profile' });
          res.status(201).json({ message: 'User registered' });
        }
      );
    }
  );
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
    if (err || results.length === 0) return res.status(400).json({ error: 'Invalid credentials' });
    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: '30m' });
    res.json({ token, role: user.role, id: user.id });
  });
});

router.get('/check-admin', (req, res) => {
  db.query('SELECT COUNT(*) as count FROM users WHERE role = "admin"', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ adminExists: results[0].count > 0 });
  });
});

module.exports = router;