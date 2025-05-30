const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  db.query(`
    SELECT s.id, s.name, s.role 
    FROM staff s 
    JOIN users u ON s.user_id = u.id 
    WHERE u.role = 'staff'
  `, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

router.delete('/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  const staffId = req.params.id;
  db.query('SELECT user_id FROM staff WHERE id = ?', [staffId], (err, results) => {
    if (err || results.length === 0) return res.status(404).json({ error: 'Staff not found' });
    const userId = results[0].user_id;
    db.query('DELETE FROM task_history WHERE task_id IN (SELECT id FROM tasks WHERE staff_id = ?)', [staffId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      db.query('DELETE FROM tasks WHERE staff_id = ?', [staffId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        db.query('DELETE FROM staff WHERE id = ?', [staffId], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          db.query('DELETE FROM users WHERE id = ?', [userId], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Staff deleted' });
          });
        });
      });
    });
  });
});

module.exports = router;