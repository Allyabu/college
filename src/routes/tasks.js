const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

// Get all tasks (admin) or tasks for logged-in staff
router.get('/', auth, (req, res) => {
  if (req.user.role === 'admin') {
    db.query(`
      SELECT t.*, s.name AS staff_name, rr.id AS rejection_request_id, rr.reason AS rejection_request_reason, rr.status AS rejection_request_status
      FROM tasks t 
      JOIN staff s ON t.staff_id = s.id
      LEFT JOIN rejection_requests rr ON t.id = rr.task_id AND rr.status = 'pending'
    `, (err, results) => {
      if (err) {
        console.error('Error fetching admin tasks:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json(results);
    });
  } else {
    db.query(`
      SELECT t.*, s.name AS staff_name, rr.id AS rejection_request_id, rr.reason AS rejection_request_reason, rr.status AS rejection_request_status
      FROM tasks t 
      JOIN staff s ON t.staff_id = s.id 
      LEFT JOIN rejection_requests rr ON t.id = rr.task_id
      WHERE s.user_id = ?
    `, [req.user.id], (err, results) => {
      if (err) {
        console.error('Error fetching staff tasks:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json(results);
    });
  }
});

// Get all staff for dropdown (admin only)
router.get('/staff', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  db.query(`
    SELECT s.id, s.name, s.role 
    FROM staff s 
    JOIN users u ON s.user_id = u.id 
    WHERE u.role = 'staff'
  `, (err, results) => {
    if (err) {
      console.error('Error fetching staff:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// Create task (admin only)
router.post('/', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  const { staff_id, description, status } = req.body;
  if (!staff_id || !description) return res.status(400).json({ error: 'Staff ID and description required' });
  db.query(`
    SELECT s.id 
    FROM staff s 
    JOIN users u ON s.user_id = u.id 
    WHERE s.id = ? AND u.role = 'staff'
  `, [staff_id], (err, results) => {
    if (err || results.length === 0) {
      console.error('Invalid staff ID:', staff_id, err);
      return res.status(400).json({ error: 'Invalid staff ID' });
    }
    db.query('INSERT INTO tasks (staff_id, description, status, approved) VALUES (?, ?, ?, FALSE)',
      [staff_id, description, status],
      (err, result) => {
        if (err) {
          console.error('Error creating task:', err);
          return res.status(500).json({ error: err.message });
        }
        db.query('INSERT INTO task_history (task_id, user_id, action, details) VALUES (?, ?, ?, ?)',
          [result.insertId, req.user.id, 'Created', `Task assigned to staff ${staff_id}`],
          (historyErr) => {
            if (historyErr) console.error('Error logging history:', historyErr);
            res.status(201).json({ message: 'Task created' });
          }
        );
      }
    );
  });
});

// Update task (admin or staff)
router.put('/:id', auth, (req, res) => {
  const { status, evidence } = req.body;
  const taskId = req.params.id;
  if (req.user.role === 'admin') {
    if (!status) return res.status(400).json({ error: 'Status required' });
    db.query('UPDATE tasks SET status = ? WHERE id = ?',
      [status, taskId],
      (err) => {
        if (err) {
          console.error('Error updating task status:', err);
          return res.status(500).json({ error: err.message });
        }
        db.query('INSERT INTO task_history (task_id, user_id, action, details) VALUES (?, ?, ?, ?)',
          [taskId, req.user.id, 'Updated', `Status: ${status}`],
          (historyErr) => {
            if (historyErr) console.error('Error logging history:', historyErr);
            res.json({ message: 'Task updated' });
          }
        );
      }
    );
  } else {
    if (status !== 'completed') return res.status(403).json({ error: 'Staff can only mark tasks as completed' });
    if (!evidence) return res.status(400).json({ error: 'Evidence required' });
    db.query(`
      UPDATE tasks t 
      JOIN staff s ON t.staff_id = s.id 
      SET t.status = ?, t.evidence = ? 
      WHERE t.id = ? AND s.user_id = ?
    `, [status, evidence, taskId, req.user.id], (err, result) => {
      if (err) {
        console.error('Error updating staff task:', err);
        return res.status(500).json({ error: err.message });
      }
      if (result.affectedRows === 0) {
        console.error('No task updated for taskId:', taskId, 'userId:', req.user.id);
        return res.status(403).json({ error: 'Unauthorized or task not found' });
      }
      db.query('INSERT INTO task_history (task_id, user_id, action, details) VALUES (?, ?, ?, ?)',
        [taskId, req.user.id, 'Marked Completed', `Evidence: ${evidence}`],
        (historyErr) => {
          if (historyErr) console.error('Error logging history:', historyErr);
          console.log(`Task ${taskId} marked completed with evidence: ${evidence}`);
          res.json({ message: 'Task updated' });
        }
      );
    });
  }
});

// Delete task (admin only)
router.delete('/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  const taskId = req.params.id;
  // Check if task exists
  db.query('SELECT id FROM tasks WHERE id = ?', [taskId], (err, results) => {
    if (err) {
      console.error('Error checking task:', err);
      return res.status(500).json({ error: err.message });
    }
    if (results.length === 0) {
      console.error('Task not found:', taskId);
      return res.status(404).json({ error: 'Task not found' });
    }
    // Log to task_history first
    db.query('INSERT INTO task_history (task_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [taskId, req.user.id, 'Deleted', 'Task removed'],
      (historyErr) => {
        if (historyErr) {
          console.error('Error logging history:', historyErr);
          return res.status(500).json({ error: 'Failed to log task deletion' });
        }
        // Delete task
        db.query('DELETE FROM tasks WHERE id = ?', [taskId], (err) => {
          if (err) {
            console.error('Error deleting task:', err);
            return res.status(500).json({ error: err.message });
          }
          console.log(`Task ${taskId} deleted successfully`);
          res.json({ message: 'Task deleted' });
        });
      }
    );
  });
});

// Approve task (admin only)
router.post('/approve/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  const taskId = req.params.id;
  db.query('UPDATE tasks SET approved = TRUE, rejection_reason = NULL WHERE id = ?', [taskId], (err) => {
    if (err) {
      console.error('Error approving task:', err);
      return res.status(500).json({ error: err.message });
    }
    db.query('INSERT INTO task_history (task_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [taskId, req.user.id, 'Approved', 'Task marked as approved'],
      (historyErr) => {
        if (historyErr) console.error('Error logging history:', historyErr);
        res.json({ message: 'Task approved' });
      }
    );
  });
});

// Reject task (admin only)
router.post('/reject/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  const taskId = req.params.id;
  const { rejection_reason } = req.body;
  if (!rejection_reason || rejection_reason.trim() === '') {
    console.error(`Rejection reason missing for task ${taskId}`);
    return res.status(400).json({ error: 'Rejection reason is required' });
  }
  console.log(`Rejecting task ${taskId} with reason: ${rejection_reason}`);
  db.query('UPDATE tasks SET approved = FALSE, rejection_reason = ? WHERE id = ?', [rejection_reason, taskId], (err, result) => {
    if (err) {
      console.error(`Error rejecting task ${taskId}:`, err);
      return res.status(500).json({ error: err.message });
    }
    if (result.affectedRows === 0) {
      console.error('No task found for rejection:', taskId);
      return res.status(404).json({ error: 'Task not found' });
    }
    db.query('INSERT INTO task_history (task_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [taskId, req.user.id, 'Rejected', `Reason: ${rejection_reason}`],
      (historyErr) => {
        if (historyErr) console.error('Error logging history:', historyErr);
        console.log(`Task ${taskId} rejected successfully`);
        res.json({ message: 'Task rejected' });
      }
    );
  });
});

// Request task rejection (staff only)
router.post('/request-rejection', auth, (req, res) => {
  if (req.user.role !== 'staff') return res.status(403).json({ error: 'Staff access required' });
  const { task_id, reason } = req.body;
  if (!task_id || !reason || reason.trim() === '') {
    console.error('Invalid rejection request:', { task_id, reason });
    return res.status(400).json({ error: 'Task ID and reason are required' });
  }
  db.query(`
    SELECT t.id, s.id AS staff_id
    FROM tasks t
    JOIN staff s ON t.staff_id = s.id
    WHERE t.id = ? AND s.user_id = ? AND t.status != 'completed'
  `, [task_id, req.user.id], (err, results) => {
    if (err || results.length === 0) {
      console.error('Invalid task or unauthorized:', err);
      return res.status(400).json({ error: 'Invalid task or unauthorized' });
    }
    const staffId = results[0].staff_id;
    db.query('INSERT INTO rejection_requests (task_id, staff_id, reason, status) VALUES (?, ?, ?, ?)',
      [task_id, staffId, reason, 'pending'],
      (err, result) => {
        if (err) {
          console.error('Error creating rejection request:', err);
          return res.status(500).json({ error: err.message });
        }
        db.query('INSERT INTO task_history (task_id, user_id, action, details) VALUES (?, ?, ?, ?)',
          [task_id, req.user.id, 'Requested Rejection', `Reason: ${reason}`],
          (historyErr) => {
            if (historyErr) console.error('Error logging history:', historyErr);
            console.log(`Rejection request created for task ${task_id}`);
            res.status(201).json({ message: 'Rejection request submitted' });
          }
        );
      }
    );
  });
});

// Approve or deny rejection request (admin only)
router.post('/rejection-request/:id/:action', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  const requestId = req.params.id;
  const action = req.params.action;
  if (!['approve', 'deny'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }
  db.query('SELECT task_id, reason FROM rejection_requests WHERE id = ? AND status = ?', [requestId, 'pending'], (err, results) => {
    if (err || results.length === 0) {
      console.error('Invalid rejection request:', err);
      return res.status(400).json({ error: 'Invalid or processed rejection request' });
    }
    const { task_id, reason } = results[0];
    db.query('UPDATE rejection_requests SET status = ? WHERE id = ?', [action, requestId], (err) => {
      if (err) {
        console.error(`Error updating rejection request ${requestId}:`, err);
        return res.status(500).json({ error: err.message });
      }
      if (action === 'approve') {
        db.query('UPDATE tasks SET status = ?, rejection_reason = ? WHERE id = ?',
          ['rejected', reason, task_id],
          (err) => {
            if (err) {
              console.error(`Error updating task ${task_id}:`, err);
              return res.status(500).json({ error: err.message });
            }
            db.query('INSERT INTO task_history (task_id, user_id, action, details) VALUES (?, ?, ?, ?)',
              [task_id, req.user.id, 'Approved Rejection', `Reason: ${reason}`],
              (historyErr) => {
                if (historyErr) console.error('Error logging history:', historyErr);
                console.log(`Rejection request ${requestId} approved for task ${task_id}`);
                res.json({ message: 'Rejection request approved' });
              }
            );
          }
        );
      } else {
        // Ensure task is pending and actionable
        db.query('UPDATE tasks SET status = ? WHERE id = ?',
          ['pending', task_id],
          (err) => {
            if (err) {
              console.error(`Error updating task ${task_id} status:`, err);
              return res.status(500).json({ error: err.message });
            }
            db.query('INSERT INTO task_history (task_id, user_id, action, details) VALUES (?, ?, ?, ?)',
              [task_id, req.user.id, 'Denied Rejection', `Reason: ${reason}`],
              (historyErr) => {
                if (historyErr) console.error('Error logging history:', historyErr);
                console.log(`Rejection request ${requestId} denied for task ${task_id}`);
                res.json({ message: 'Rejection request denied' });
              }
            );
          }
        );
      }
    });
  });
});

// Get daily report (admin only)
router.get('/report', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  const { date, staff_id, role } = req.query;
  const queryDate = date || new Date().toISOString().split('T')[0];
  let query = `
    SELECT t.*, s.name AS staff_name 
    FROM tasks t 
    JOIN staff s ON t.staff_id = s.id 
    WHERE DATE(t.created_at) = ?
  `;
  const params = [queryDate];
  if (staff_id) {
    query += ' AND t.staff_id = ?';
    params.push(staff_id);
  }
  if (role) {
    query += ' AND s.role = ?';
    params.push(role);
  }
  db.query(query, params, (err, results) => {
    if (err) {
      console.error('Error fetching report:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

module.exports = router;