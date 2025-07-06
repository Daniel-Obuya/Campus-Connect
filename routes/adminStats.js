// Admin stats endpoints for dashboard
const express = require('express');
const router = express.Router();
const { pool } = require('../server');

// Get total registered students
router.get('/stats/students', async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT COUNT(*) as count FROM users WHERE role = 'student'");
        res.json({ count: rows[0].count });
    } catch (err) {
        res.status(500).json({ count: 0 });
    }
});

// Get total clubs & societies
router.get('/stats/clubs', async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT COUNT(*) as count FROM clubs_societies");
        res.json({ count: rows[0].count });
    } catch (err) {
        res.status(500).json({ count: 0 });
    }
});

// Get total announcements
router.get('/stats/announcements', async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT COUNT(*) as count FROM announcements");
        res.json({ count: rows[0].count });
    } catch (err) {
        res.status(500).json({ count: 0 });
    }
});

// Get total events
router.get('/stats/events', async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT COUNT(*) as count FROM events");
        res.json({ count: rows[0].count });
    } catch (err) {
        res.status(500).json({ count: 0 });
    }
});

module.exports = router;
