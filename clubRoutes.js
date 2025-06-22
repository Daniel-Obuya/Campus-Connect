const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const db = require('../config/db'); // Assuming you have a db connection setup file

/**
 * @route   GET /api/club/dashboard
 * @desc    Get all personalized data for the club admin dashboard
 * @access  Private (Club Admin)
 */
router.get('/dashboard', protect, async (req, res) => {
    // Ensure the user has the correct role
    if (req.user.role !== 'club_admin') {
        return res.status(403).json({ success: false, message: 'Forbidden: Access is restricted to Club Admins.' });
    }

    const adminUserId = req.user.id;

    try {
        // First, get the club_id managed by this admin using president_user_id
        const [clubData] = await db.promise().query('SELECT club_id FROM clubs_societies WHERE president_user_id = ?', [adminUserId]);

        if (!clubData.length || !clubData[0].club_id) {
            return res.status(404).json({ success: false, message: 'No club associated with this admin account. Please ensure your admin account is linked to a club.' });
        }
        const clubId = clubData[0].club_id;

        // --- Run all data queries in parallel for efficiency ---
        const [
            overviewResults,
            pendingMembers,
            currentMembers,
            upcomingEvents,
            recentAnnouncements,
            clubProfile
        ] = await Promise.all([
            // Query for overview stats
            Promise.all([
                db.promise().query('SELECT COUNT(*) as count FROM club_memberships WHERE club_id = ? AND status = "active"', [clubId]),
                db.promise().query('SELECT COUNT(*) as count FROM club_memberships WHERE club_id = ? AND status = "pending"', [clubId]),
                db.promise().query('SELECT COUNT(*) as count FROM events WHERE organizer_id = ? AND organizer_type = "club" AND start_datetime > NOW()', [clubId]),
                db.promise().query('SELECT title, start_datetime FROM events WHERE organizer_id = ? AND organizer_type = "club" AND start_datetime > NOW() ORDER BY start_datetime ASC LIMIT 1', [clubId])
            ]),
            // Query for pending members
            db.promise().query(`
                SELECT u.id, u.firstName, u.lastName, sd.major, sd.graduationYear 
                FROM users u 
                JOIN club_memberships cm ON u.id = cm.user_id 
                LEFT JOIN student_details sd ON u.id = sd.user_id
                WHERE cm.club_id = ? AND cm.status = 'pending' LIMIT 5`, [clubId]),
            // Query for current members
            db.promise().query(`
                SELECT u.id, u.firstName, u.lastName, cm.role 
                FROM users u 
                JOIN club_memberships cm ON u.id = cm.user_id 
                WHERE cm.club_id = ? AND cm.status = 'active' ORDER BY 
                CASE cm.role 
                    WHEN 'President' THEN 1 
                    WHEN 'Vice President' THEN 2 
                    ELSE 3 
                END, u.firstName ASC LIMIT 10`, [clubId]),
            // Query for upcoming events
            db.promise().query('SELECT * FROM events WHERE organizer_id = ? AND organizer_type = "club" AND start_datetime > NOW() ORDER BY start_datetime ASC LIMIT 3', [clubId]),
            // Query for recent announcements
            db.promise().query('SELECT * FROM announcements WHERE author_entity_id = ? AND author_type = "club" ORDER BY created_at DESC LIMIT 3', [clubId]),
            // Query for club profile
            db.promise().query('SELECT * FROM clubs_societies WHERE club_id = ?', [clubId])
        ]);

        // --- Assemble the final dashboard data object ---

        // Process overview data
        const overview = {
            totalMembers: overviewResults[0][0][0].count,
            activeMembers: overviewResults[0][0][0].count, // Same for this simplified query
            pendingRequests: overviewResults[1][0][0].count,
            upcomingEvents: overviewResults[2][0][0].count,
            nextEvent: overviewResults[3][0].length ? {
                title: overviewResults[3][0][0].title,
                date: new Date(overviewResults[3][0][0].start_datetime).toLocaleString()
            } : { title: 'No upcoming events', date: '' },
            // These would require more complex queries/logging
            newInteractionsToday: 0, 
            engagementRate: 'N/A'
        };

        // Process members data
        const members = {
            pending: pendingMembers[0].map(m => ({ // Note: m.id here is the user_id, we need membership_id for actions
                id: m.id,
                name: `${m.firstName} ${m.lastName}`,
                role: `${m.major || 'Undecided'} • ${m.graduationYear || 'N/A'}`
            })),
            current: currentMembers[0].map(m => ({
                id: m.id,
                name: `${m.firstName} ${m.lastName}`,
                role: m.role
            }))
        };

        // Process events data (add dummy stats for UI)
        const events = upcomingEvents[0].map(e => ({
            ...e,
            date: new Date(e.start_datetime).toLocaleDateString(),
            rsvps: 0, // Placeholder
            daysLeft: Math.ceil((new Date(e.start_datetime) - new Date()) / (1000 * 60 * 60 * 24))
        }));

        // Process announcements data (add dummy stats for UI)
        const announcements = recentAnnouncements[0].map(a => ({
            ...a,
            time: new Date(a.created_at).toLocaleString(),
            views: 0, // Placeholder
            comments: 0, // Placeholder
            likes: 0 // Placeholder
        }));

        // Mock analytics data
        const analytics = {
            memberGrowth: [45, 52, 61, 78, 95, overview.totalMembers],
            eventAttendance: [32, 28, 35, 42],
            engagement: [40, 30, 20, 10]
        };

        // Process profile data
        const profile = clubProfile[0][0];

        // Combine all data into the final response object
        const dashboardData = {
            overview,
            members,
            events,
            announcements,
            analytics,
            profile
        };

        res.json({
            success: true,
            ...dashboardData
        });

    } catch (error) {
        console.error('Error fetching club dashboard data:', error);
        res.status(500).json({ success: false, message: 'Server error while fetching dashboard data.' });
    }
});

/**
 * @route   GET /api/club/
 * @desc    Get all active clubs for the public directory
 * @access  Public
 */
router.get('/', async (req, res) => {
    try {
        // This query joins clubs with their member counts and admin names.
        // It assumes 'c.admin_id' links to the 'users' table for the club's leader.
        // It uses subqueries to get aggregated counts, which is efficient.
        const [clubs] = await db.promise().query(`
            SELECT 
                c.id,
                c.name,
                c.description,
                c.category,
                c.logo_url,
                c.meeting_schedule,
                (SELECT COUNT(*) FROM club_memberships WHERE club_id = c.id AND status = 'active') as member_count,
                (SELECT COUNT(*) FROM events WHERE organizer_id = c.id AND organizer_type = 'club' AND start_datetime > NOW()) as upcoming_events_count,
                u.firstName as adminFirstName,
                u.lastName as adminLastName,
                c.meeting_schedule,
                c.contact_email
            FROM 
                clubs c
            LEFT JOIN 
                users u ON c.president_user_id = u.id
            WHERE 
                c.status = 'active'
            ORDER BY
                c.name ASC
        `);

        res.json({ success: true, clubs });
    } catch (error) {
        console.error('Error fetching clubs directory data:', error);
        res.status(500).json({ success: false, message: 'Server error while fetching clubs directory.' });
    }
});

/**
 * @route   GET /api/user/memberships
 * @desc    Get all club memberships for the logged-in user
 * @access  Private (Student)
 */
router.get('/user/memberships', protect, async (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ success: false, message: 'Forbidden: Access is restricted to students.' });
    }
    try {
        const [memberships] = await db.promise().query(
            'SELECT membership_id, club_id, status, role FROM club_memberships WHERE user_id = ?',
            [req.user.id]
        );
        res.json({ success: true, memberships });
    } catch (error) {
        console.error('Error fetching user memberships:', error);
        res.status(500).json({ success: false, message: 'Server error while fetching user memberships.' });
    }
});

/**
 * @route   POST /api/club/join-request
 * @desc    Submit a request to join a club
 * @access  Private (Student)
 */
router.post('/join-request', protect, async (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ success: false, message: 'Forbidden: Only students can send join requests.' });
    }
    const { clubId } = req.body;
    const userId = req.user.id;

    if (!clubId) {
        return res.status(400).json({ success: false, message: 'Club ID is required.' });
    }

    try {
        // Check if a membership already exists (pending, active, or rejected)
        const [existingMembership] = await db.promise().query(
            'SELECT status FROM club_memberships WHERE user_id = ? AND club_id = ?',
            [userId, clubId]
        );

        if (existingMembership.length > 0) {
            const status = existingMembership[0].status;
            if (status === 'pending') {
                return res.status(409).json({ success: false, message: 'You already have a pending request for this club.' });
            } else if (status === 'active') {
                return res.status(409).json({ success: false, message: 'You are already an active member of this club.' });
            } else if (status === 'rejected') {
                return res.status(409).json({ success: false, message: 'Your previous request was rejected. Please contact the club directly.' });
            }
        }

        // Insert new pending membership
        const [result] = await db.promise().query(
            'INSERT INTO club_memberships (user_id, club_id, status, role) VALUES (?, ?, ?, ?)',
            [userId, clubId, 'pending', 'member'] // Default role 'member'
        );
        res.status(201).json({ success: true, message: 'Join request sent successfully!', membershipId: result.insertId });
    } catch (error) {
        console.error('Error sending join request:', error);
        res.status(500).json({ success: false, message: 'Server error while sending join request.' });
    }
});

/**
 * @route   POST /api/club/memberships/approve
 * @desc    Approve a pending club membership request
 * @access  Private (Club Admin)
 */
router.post('/memberships/approve', protect, async (req, res) => {
    if (req.user.role !== 'club_admin') {
        return res.status(403).json({ success: false, message: 'Forbidden: Access is restricted to Club Admins.' });
    }
    const { membershipId } = req.body;
    const adminUserId = req.user.id;

    if (!membershipId) {
        return res.status(400).json({ success: false, message: 'Membership ID is required.' });
    }

    const connection = await db.promise().getConnection();
    try {
        await connection.beginTransaction();

        // Verify that the admin manages the club associated with this membership
        const [clubData] = await connection.query('SELECT club_id FROM clubs_societies WHERE president_user_id = ?', [adminUserId]);
        if (!clubData.length || !clubData[0].club_id) {
            await connection.rollback();
            return res.status(403).json({ success: false, message: 'Admin not associated with a club.' });
        }
        const clubId = clubData[0].club_id;

        const [membership] = await connection.query('SELECT club_id, status FROM club_memberships WHERE membership_id = ?', [membershipId]);
        if (!membership.length || membership[0].club_id !== clubId) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Membership not found or not for your club.' });
        }
        if (membership[0].status !== 'pending') {
            await connection.rollback();
            return res.status(400).json({ success: false, message: 'Membership is not in pending status.' });
        }

        // Update membership status to active
        await connection.query('UPDATE club_memberships SET status = "active" WHERE membership_id = ?', [membershipId]);

        // Increment member_count in clubs_societies
        await connection.query('UPDATE clubs_societies SET member_count = member_count + 1 WHERE club_id = ?', [clubId]);

        await connection.commit();
        res.json({ success: true, message: 'Membership approved successfully!' });
    } catch (error) {
        await connection.rollback();
        console.error('Error approving membership:', error);
        res.status(500).json({ success: false, message: 'Server error while approving membership.' });
    } finally {
        connection.release();
    }
});

/**
 * @route   POST /api/club/memberships/reject
 * @desc    Reject a pending club membership request
 * @access  Private (Club Admin)
 */
router.post('/memberships/reject', protect, async (req, res) => {
    if (req.user.role !== 'club_admin') {
        return res.status(403).json({ success: false, message: 'Forbidden: Access is restricted to Club Admins.' });
    }
    const { membershipId } = req.body;
    const adminUserId = req.user.id;

    if (!membershipId) {
        return res.status(400).json({ success: false, message: 'Membership ID is required.' });
    }

    const connection = await db.promise().getConnection();
    try {
        await connection.beginTransaction();

        // Verify that the admin manages the club associated with this membership
        const [clubData] = await connection.query('SELECT club_id FROM clubs_societies WHERE president_user_id = ?', [adminUserId]);
        if (!clubData.length || !clubData[0].club_id) {
            await connection.rollback();
            return res.status(403).json({ success: false, message: 'Admin not associated with a club.' });
        }
        const clubId = clubData[0].club_id;

        const [membership] = await connection.query('SELECT club_id, status FROM club_memberships WHERE membership_id = ?', [membershipId]);
        if (!membership.length || membership[0].club_id !== clubId) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Membership not found or not for your club.' });
        }
        if (membership[0].status !== 'pending') {
            await connection.rollback();
            return res.status(400).json({ success: false, message: 'Membership is not in pending status.' });
        }

        // Update membership status to rejected
        await connection.query('UPDATE club_memberships SET status = "rejected" WHERE membership_id = ?', [membershipId]);

        await connection.commit();
        res.json({ success: true, message: 'Membership rejected successfully!' });
    } catch (error) {
        await connection.rollback();
        console.error('Error rejecting membership:', error);
        res.status(500).json({ success: false, message: 'Server error while rejecting membership.' });
    } finally {
        connection.release();
    }
});

module.exports = router;