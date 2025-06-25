const express = require('express');
const router = express.Router();
const { pool } = require('../server'); // Assuming server.js exports the pool
const { authenticateJWT } = require('../middleware/authMiddleware'); // Assuming you create this middleware file
const fetch = require('node-fetch');

// --- API Route to fetch external events (e.g., from Eventbrite) ---
router.get('/external-events', async (req, res) => {
    const eventbriteToken = process.env.EVENTBRITE_PRIVATE_TOKEN;
    if (!eventbriteToken) {
        console.error('Eventbrite Private Token not found in .env file.');
        return res.status(500).json({ success: false, message: 'Server configuration error for external events.' });
    }

    const page = req.query.page || '1';
    const location = req.query.location || 'Nairobi';
    const query = req.query.q || 'student';

    const eventbriteURL = `https://www.eventbriteapi.com/v3/events/search/?location.address=${encodeURIComponent(location)}&q=${encodeURIComponent(query)}&expand=organizer,venue`;

    console.log(`Backend fetching from Eventbrite: ${eventbriteURL}`);

    try {
        const eventbriteResponse = await fetch(eventbriteURL, {
            headers: {
                'Authorization': `Bearer ${eventbriteToken}`,
                'Accept': 'application/json'
            }
        });

        if (!eventbriteResponse.ok) {
            const errorData = await eventbriteResponse.json().catch(() => ({ message: eventbriteResponse.statusText }));
            console.error(`Eventbrite API Error: ${eventbriteResponse.status}`, errorData);
            return res.status(eventbriteResponse.status).json({
                success: false,
                message: `Failed to fetch events from Eventbrite: ${errorData.error_description || errorData.error || errorData.message || 'Unknown API error'}`
            });
        }

        const eventbriteData = await eventbriteResponse.json();
        res.json({ success: true, eventsData: eventbriteData });
    } catch (error) {
        console.error('Error fetching external events from backend:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch external events.' });
    }
});

// API Endpoint to Create a New Event
router.post('/events', authenticateJWT, async (req, res) => {
    // ... (move logic from server.js here)
    const { title, description, event_type, start_datetime, end_datetime, location, virtual_link, max_attendees, registration_required, tags, image_url } = req.body;
    let organizer_type;
    let organizer_id;

    if (req.user.role === 'department_admin') {
        organizer_type = 'department';
        organizer_id = req.user.department_id;
    } else {
        return res.status(403).json({ success: false, message: 'Your role is not authorized to create events.' });
    }

    // ... (rest of the validation and insertion logic from server.js)
    // For brevity, the full implementation is omitted here but should be moved from server.js
    res.status(201).json({ success: true, message: 'Event created successfully!' });
});

// API Endpoint to GET a single event by ID
router.get('/events/:eventId', authenticateJWT, async (req, res) => {
    // ... (move logic from server.js here)
    res.json({ success: true, message: 'Event details' });
});

// API Endpoint to UPDATE an existing event
router.put('/events/:eventId', authenticateJWT, async (req, res) => {
    // ... (move logic from server.js here)
    res.json({ success: true, message: 'Event updated successfully!' });
});

// API Endpoint to GET events for the logged-in department admin's department
router.get('/events/department', authenticateJWT, async (req, res) => {
    try {
        if (req.user.role !== 'department_admin' || !req.user.department_id) {
            return res.status(403).json({ success: false, message: 'Access denied. User is not a department admin or department ID is missing.' });
        }
        const departmentId = req.user.department_id;
        const [events] = await pool.query(
            `SELECT event_id, title, description, 
                    DATE_FORMAT(start_datetime, '%Y-%m-%d %H:%i') as start_datetime_formatted, 
                    DATE_FORMAT(registration_deadline, '%Y-%m-%d %H:%i') as registration_deadline_formatted, 
                    location 
             FROM events 
             WHERE organizer_type = 'department' AND organizer_id = ? 
             ORDER BY start_datetime DESC`,
            [departmentId]
        );
        console.log(`Found ${events.length} events for department ID ${departmentId} (User: ${req.user.email})`);
        res.json({ success: true, events });
    } catch (error) {
        console.error('Error fetching department events:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch department events.' });
    }
});

module.exports = router;