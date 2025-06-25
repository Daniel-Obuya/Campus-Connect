const express = require('express');
const router = express.Router();
const { pool } = require('../server'); // Assuming server.js exports the pool
const { authenticateJWT } = require('../middleware/authMiddleware'); // Assuming you create this middleware file

// API Endpoint to Create a New Announcement
router.post('/announcements', authenticateJWT, async (req, res) => {
    try {
        const { title, content, priority, target_audience, tags, attachment_urls, scheduled_publish_at, expires_at, is_pinned, is_published } = req.body;

        if (req.user.role !== 'department_admin' || !req.user.department_id) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }

        const authorType = 'department';
        const authorEntityId = req.user.department_id;
        const authorId = req.user.id;

        if (!title || !content) {
            return res.status(400).json({ success: false, message: 'Title and content are required.' });
        }

        const sql = `INSERT INTO announcements (
                        title, content, author_id, author_type, author_entity_id, 
                        priority, target_audience, tags, attachment_urls, 
                        is_pinned, scheduled_publish_at, expires_at, is_published
                     ) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        const values = [
            title, content, authorId, authorType, authorEntityId,
            priority || 'normal', target_audience || JSON.stringify([]),
            tags || JSON.stringify([]), attachment_urls || JSON.stringify([]),
            is_pinned || false, scheduled_publish_at || null, expires_at || null,
            is_published === undefined ? true : !!is_published
        ];

        const [result] = await pool.query(sql, values);
        res.status(201).json({ success: true, message: 'Announcement created successfully!', announcementId: result.insertId });

    } catch (error) {
        console.error('Error creating announcement:', error);
        res.status(500).json({ success: false, message: 'Failed to create announcement.' });
    }
});

// You would also move the other announcement routes here...

module.exports = router;