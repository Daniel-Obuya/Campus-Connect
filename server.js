require('dotenv').config();
const secret = process.env.JWT_SECRET;
const jwt = require('jsonwebtoken');
const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const crypto = require('crypto'); // For generating tokens
const fetch = require('node-fetch'); // For making HTTP requests from the backend
const { google } = require('googleapis'); // For Google Calendar API
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const PORT = process.env.PORT || 3001; // Changed default port to 3001 to avoid conflict with MySQL default

// Middleware
app.use(express.json({ limit: '50mb' })); // Increased Limit to 50mb to accomodate image uploads
app.use(express.urlencoded({ extended: true }));

// Socket.IO Setup
const server = http.createServer(app);
const io = new Server(server);

// --- Admin Stats API Routes ---
const adminStatsRoutes = require('./routes/adminStats');
app.use('/api/admin', adminStatsRoutes);

// Google OAuth2 Client Setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);


// Serve static files
app.use(express.static(__dirname));
// Explicitly serve the images directory at /images
app.use('/images', express.static(path.join(__dirname, 'images')));

// Nodemailer transporter setup
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    service: 'gmail', // Or your email provider
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    }
});

// Database connection pool (reuse connections efficiently)
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'campus_connect',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Connected to the database successfully');
    connection.release();
  } catch (err) {
    console.error('❌ Failed to connect to the database:', err);
  }
})();
exports.pool = pool; // Export the pool for use in other modules

// --- Authentication Middleware ---
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, secret, (err, userPayload) => {
            if (err) {
                console.error('JWT verification failed:', err.message);
                return res.status(403).json({ success: false, message: 'Forbidden: Invalid or expired token.' });
            }
            req.user = userPayload;
            next();
        });
    } else {
        console.warn(`JWT Authentication: No token provided for ${req.method} ${req.originalUrl}`);
        return res.status(401).json({ success: false, message: 'Unauthorized: No token provided.' });
    }
};


// --- HTML Serving Routes ---

// Root redirects to welcome
// app.get('/', (req, res) => {
//   res.redirect('/welcome');
// });

app.get('/welcome', (req, res) => {
  res.sendFile(path.join(__dirname, 'welcome.html'));
});

// --- Combined Admin Portals Welcome Page ---
app.get('/welcome-admin-portals', (req, res) => {
  res.sendFile(path.join(__dirname, 'welcome_admin_portals.html'));
});


// New specific signup and login pages
app.get('/signup-student', (req, res) => {
  res.sendFile(path.join(__dirname, 'signup-student.html'));
});
app.get('/login-student', (req, res) => {
  res.sendFile(path.join(__dirname, 'login-student.html'));
});
app.get('/signup-admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'signup-admin.html'));
});
app.get('/login-admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'login-admin.html'));
});

app.get('/events-management', (req, res) => {
  res.sendFile(path.join(__dirname, 'events_management.html'));
});

app.get('/department-dashboard', (req, res) => {  // New route
    res.sendFile(path.join(__dirname, 'department_admin.html')); // Corrected filename
});
// -- Route for Student Profile Directory --
app.get('/student-dashboard', (req, res) => { // This route was outside the conflict block but is related
  res.sendFile(path.join(__dirname, 'student_dashboard.html'));
});

app.get('/club-admin-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'club-admin-dashboard.html'));
});

app.get('/departments-directory', (req, res) => {
  res.sendFile(path.join(__dirname, 'departments_directory.html'));
});

app.get('/clubs-directory', (req, res) => {
  res.sendFile(path.join(__dirname, 'clubs-directory.html'));
});
// --- Route for Departments Directory -de--
app.get('/projects', (req, res) => {
  res.sendFile(path.join(__dirname, 'projects_directory.html'));
});

// --- Route for Events Directory ---
app.get('/events-directory', (req, res) => {
    res.sendFile(path.join(__dirname, 'events_directory.html'));
});

// --- Route for Interactive Calendar ---
app.get('/interactive-calendar', (req, res) => {
    res.sendFile(path.join(__dirname, 'interactive_calendar.html'));
});

// --- Route for Edit Student Profile Page ---
app.get('/edit-student-profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'edit-student-profile.html'));
});

// --- Route for Reset Password Page ---
app.get('/reset-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'reset_password.html'));
});

// --- Route for Messaging Page ---
app.get('/messaging', (req, res) => {
    res.sendFile(path.join(__dirname, 'messaging.html'));
});

// --- Google Calendar Auth Routes ---
const G_SCOPES = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events'
];

app.get('/auth/google', (req, res) => {
    // Check if user is logged into Campus Connect first
    // For simplicity, we'll assume this check happens on the frontend before calling this.
    // Or, you can use authenticateJWT middleware here if the user must be logged in.

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline', // To get a refresh token
        scope: G_SCOPES,
        // prompt: 'consent', // Optional: forces consent screen every time, useful for testing refresh tokens
    });
    console.log('Generated Google Auth URL:', authUrl);
    res.redirect(authUrl);
});

app.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) {
        return res.status(400).send('Authorization code missing.');
    }
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        console.log('Google OAuth tokens received:', tokens);

        // TODO: Securely store these tokens (access_token, refresh_token, expiry_date, id_token)
        // associated with the logged-in Campus Connect user.
        // For example, update the user's record in your database.
        // The id_token contains user profile information if you need it.
        // const idTokenInfo = await oauth2Client.getTokenInfo(tokens.id_token);
        // console.log('ID Token Info:', idTokenInfo);

        // For now, just send a success message and redirect back to the calendar or a success page.
        // In a real app, you'd store tokens and then redirect.
        // res.send('Google authentication successful! Tokens received. You can now close this tab or be redirected.');
        res.redirect('/interactive-calendar?google_auth_success=true'); // Redirect back to calendar

    } catch (error) {
        console.error('Error exchanging Google auth code for tokens:', error.response ? error.response.data : error.message);
        res.status(500).send('Failed to authenticate with Google. Please try again.');
    }
});

function generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
}

// --- New API Route to fetch external events (e.g., from Eventbrite) ---
app.get('/api/external-events', async (req, res) => {
    const eventbriteToken = process.env.EVENTBRITE_PRIVATE_TOKEN;
    if (!eventbriteToken) {
        console.error('Eventbrite Private Token not found in .env file.');
        return res.status(500).json({ success: false, message: 'Server configuration error for external events.' });
    }

    // Get page number from query string, default to 1
    const page = req.query.page || '1';
    const location = req.query.location || 'Nairobi'; // Example: allow location to be passed
    const query = req.query.q || 'student'; // Example: allow query to be passed

    // Simplified URL to closely match the successful direct test
            // Ensure the base path ends with a slash before query parameters
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
        res.json({ success: true, eventsData: eventbriteData }); // Send the whole Eventbrite response structure
    } catch (error) {
        console.error('Error fetching external events from backend:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch external events.' });
    }
});

// --- API Routes ---

// --- Messaging API Routes ---

// Get all conversations for the logged-in user
app.get('/api/conversations', authenticateJWT, async (req, res) => {
    try {
        // This query now handles both DMs and Group Chats
        const [conversations] = await pool.query(`
            SELECT 
                c.conversation_id,
                c.is_group_chat,
                c.last_message_at,
                -- Determine the display name: group name for groups, other user's name for DMs
                IF(c.is_group_chat, c.group_name, CONCAT(other_user.first_name, ' ', other_user.last_name)) AS display_name,
                -- Determine the avatar: group avatar for groups, other user's avatar for DMs
                IF(c.is_group_chat, c.group_avatar_url, other_user.profile_picture_url) AS avatar_url,
                -- For DMs, get the other user's ID as receiver_id, else NULL for group chats
                IF(c.is_group_chat, NULL, other_user.user_id) AS receiver_id,
                -- Get the last message content
                (SELECT content FROM messages WHERE conversation_id = c.conversation_id ORDER BY created_at DESC LIMIT 1) AS last_message,
                -- Get the last message sender's name
                (SELECT u_sender.first_name FROM messages m JOIN users u_sender ON m.sender_id = u_sender.user_id WHERE m.conversation_id = c.conversation_id ORDER BY m.created_at DESC LIMIT 1) AS last_message_sender
            FROM 
                conversations c
            JOIN 
                conversation_participants cp ON c.conversation_id = cp.conversation_id
            LEFT JOIN 
                conversation_participants other_cp ON c.conversation_id = other_cp.conversation_id AND other_cp.user_id != ?
            LEFT JOIN 
                users other_user ON other_cp.user_id = other_user.user_id AND c.is_group_chat = FALSE
            WHERE cp.user_id = ?
            GROUP BY c.conversation_id
            ORDER BY c.last_message_at DESC;
        `, [req.user.id, req.user.id]);
        res.json({ success: true, conversations });
    } catch (error) {
        console.error("Error fetching conversations:", error);
        res.status(500).json({ success: false, message: 'Server error fetching conversations.' });
    }
});

// Get messages for a specific conversation
app.get('/api/conversations/:id/messages', authenticateJWT, async (req, res) => {
    try {
        const conversationId = req.params.id;
        // Security check: Ensure the user is part of this conversation
        const [participants] = await pool.query(
            'SELECT * FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
            [conversationId, req.user.id] // Use req.user.id from authenticateJWT
        );
        if (participants.length === 0) {
            return res.status(403).json({ success: false, message: 'Not authorized to view this conversation.' });
        }

        const [messages] = await pool.query(
            'SELECT message_id, sender_id, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
            [conversationId]
        );
        res.json({ success: true, messages });
    } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).json({ success: false, message: 'Server error fetching messages.' });
    }
});

// --- End of Messaging API Routes ---

// --- API Route: Start or Get Conversation between Student and Department Admin ---
app.post('/api/conversations/department', authenticateJWT, async (req, res) => {
    try {
        // Only students can start a conversation with a department admin
        if (req.user.role !== 'student') {
            return res.status(403).json({ success: false, message: 'Only students can start a conversation with a department admin.' });
        }
        const { departmentId } = req.body;
        if (!departmentId) {
            return res.status(400).json({ success: false, message: 'Department ID is required.' });
        }
        // Find the department admin for this department
        const [admins] = await pool.query(
            'SELECT user_id FROM users WHERE department_id = ? AND role = ? AND is_active = 1',
            [departmentId, 'department_admin']
        );
        if (admins.length === 0) {
            return res.status(404).json({ success: false, message: 'No active department admin found for this department.' });
        }
        const adminUserId = admins[0].user_id;
        const studentUserId = req.user.id;
        // Check if a conversation already exists between this student and department admin
        const [existing] = await pool.query(
            `SELECT c.conversation_id FROM conversations c
             JOIN conversation_participants cp1 ON c.conversation_id = cp1.conversation_id AND cp1.user_id = ?
             JOIN conversation_participants cp2 ON c.conversation_id = cp2.conversation_id AND cp2.user_id = ?
             WHERE c.is_group_chat = 0
             LIMIT 1`,
            [studentUserId, adminUserId]
        );
        let conversationId;
        if (existing.length > 0) {
            conversationId = existing[0].conversation_id;
        } else {
            // Create a new conversation
            const [result] = await pool.query(
                'INSERT INTO conversations (is_group_chat, last_message_at) VALUES (0, NOW())'
            );
            conversationId = result.insertId;
            // Add both participants
            await pool.query(
                'INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)',
                [conversationId, studentUserId, conversationId, adminUserId]
            );
        }
        res.json({ success: true, conversationId });
    } catch (error) {
        console.error('Error starting/getting department conversation:', error);
        res.status(500).json({ success: false, message: 'Failed to start or get conversation.' });
    }
});










// VERY SIMPLE TEST ROUTE - Add this just before /api/events/department
app.get('/api/test-events-route-unique-name', (req, res) => {
  console.log('LOG: /api/test-events-route-unique-name was hit!');
  res.status(200).json({ success: true, message: 'Unique test route is working!' });
});

// Signup
app.post('/api/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, studentDetails, clubDetails, departmentDetails, profilePicture } = req.body;
    console.log('Signup request received:', { firstName, lastName, email, role, profilePicture: profilePicture ? '[image data]' : null });

    // Basic validation
    if (!firstName || !lastName || !email || !password || !role) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields (firstName, lastName, email, password, role).' 
      });
    }
    if (password.length < 8) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 8 characters long.' 
      });
    }
    // Check if email already exists
    const [existingUsers] = await pool.query('SELECT user_id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(409).json({ 
        success: false, 
        message: 'Email already registered.' 
      });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    let userId;
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
      let profilePictureUrl = null;
      // Handle profile picture upload (Base64 to file)
      if (profilePicture && profilePicture.startsWith('data:image/')) {
        // Parse the file extension
        const matches = profilePicture.match(/^data:image\/(png|jpeg|jpg|gif);base64,(.+)$/);
        if (matches) {
          const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
          const base64Data = matches[2];
          const fileName = `student_${Date.now()}_${Math.floor(Math.random()*10000)}.${ext}`;
          const filePath = path.join(__dirname, 'images', fileName);
          const fs = require('fs');
          // Ensure images directory exists
          if (!fs.existsSync(path.join(__dirname, 'images'))) {
            fs.mkdirSync(path.join(__dirname, 'images'));
          }
          fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
          // Save only the file path in the database (not the base64 string)
          profilePictureUrl = `/images/${fileName}`;
        } else {
          // If base64 is malformed, fallback to default
          profilePictureUrl = null;
        }
      } else if (profilePicture && profilePicture.startsWith('/images/')) {
        // If already a file path, use as is
        profilePictureUrl = profilePicture;
      } else {
        // If no image provided, set to null
        profilePictureUrl = null;
      }
      let userInsertData = {
        email,
        password_hash: hashedPassword,
        first_name: firstName,
        last_name: lastName,
        role,
        email_verified: false, // Set to false initially
        is_active: false, // Set to false until email is verified
        profile_picture_url: profilePictureUrl // Save file path or null
      };
      if (role === 'student') {
        // Student specific details
        if (!studentDetails || !studentDetails.studentId || !studentDetails.major || !studentDetails.graduationYear) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ 
            success: false, 
            message: 'Missing student-specific data (studentId, major, graduationYear).' 
          });
        }
        userInsertData.student_id = studentDetails.studentId;
        userInsertData.major = studentDetails.major;
        userInsertData.graduation_year = studentDetails.graduationYear;
      }
      const [result] = await connection.query('INSERT INTO users SET ?', userInsertData);
      userId = result.insertId;

      // If club admin, create club and associate admin
      if (userInsertData.role === 'club_admin' && clubDetails && clubDetails.name) {
        // Validate category against ENUM (case-insensitive)
        const validCategories = ['academic','sports','cultural','technical','social','volunteer','other'];
        let clubCategory = (clubDetails.category || '').toLowerCase();
        clubCategory = validCategories.find(cat => cat === clubCategory) || 'other';
        try {
          // Insert with all required fields, including NULL for advisor_name and founded_date
          const [clubResult] = await connection.query(
            'INSERT INTO clubs_societies (name, description, category, president_user_id, advisor_name, contact_email, meeting_schedule, logo_url, is_active, member_count, founded_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              clubDetails.name,
              clubDetails.description || '',
              clubCategory,
              userId,
              null, // advisor_name
              clubDetails.contactEmail || email,
              clubDetails.meetingSchedule || '',
              clubDetails.logoUrl || null,
              1, // is_active
              1, // initial member count
              null // founded_date
            ]
          );
          // Add admin as a member in club_memberships (role must match ENUM: 'president')
          await connection.query(
            'INSERT INTO club_memberships (user_id, club_id, role, status, joined_date) VALUES (?, ?, ?, ?, CURDATE())',
            [userId, clubResult.insertId, 'president', 'active']
          );
        } catch (clubErr) {
          await connection.rollback();
          connection.release();
          console.error('Error inserting club for club_admin:', clubErr);
          return res.status(500).json({ success: false, message: 'Failed to create club for club admin. Please check your club details and try again.' });
        }
      }

      // Generate and store verification token
      const verificationToken = generateVerificationToken();
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      await connection.query('UPDATE users SET email_verification_token = ?, email_verification_expires = ? WHERE user_id = ?', [verificationToken, expires, userId]);
      await connection.commit();
      connection.release();
      // Send verification email
      const verificationLink = `http://localhost:${PORT}/api/verify-email?token=${verificationToken}`;
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Campus Connect - Verify Your Email Address',
        html: `<p>Hello ${firstName},</p>
               <p>Thank you for registering with Campus Connect!</p>
               <p>Please click the following link to verify your email address:</p>
               <a href="${verificationLink}">${verificationLink}</a>
               <p>This link will expire in 24 hours.</p>
               <p>If you did not sign up for Campus Connect, please ignore this email.</p>
               <p>Best regards,<br>The Campus Connect Team</p>`
      };
      await transporter.sendMail(mailOptions);
      console.log(`Verification email sent to ${email}`);
      const token = jwt.sign({
        id: userId,
        email,
        role,
        firstName,
        lastName
      }, secret, { expiresIn: '2h' });
      res.status(201).json({
        success: true,
        message: `User ${email} registered successfully as ${role}. Please check your email to verify your account.`,
        user: {
          id: userId,
          firstName,
          lastName,
          email,
          role,
          profilePicture: profilePictureUrl
        }
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      console.error('Signup transaction error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Internal server error during signup.' 
      });
    }
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// --- API Route for Email Verification ---
app.get('/api/verify-email', async (req, res) => {
    const { token } = req.query;

    if (!token) {
        // return res.status(400).send('Verification token is missing.');
        return res.status(400).sendFile(path.join(__dirname, 'verification_failed.html'));
    }

    try {
        const connection = await pool.getConnection();
        try {
            // Find user by verification token and check expiry
            const [users] = await connection.query(
                'SELECT * FROM users WHERE email_verification_token = ? AND email_verification_expires > NOW()',
                [token]
            );

            if (users.length === 0) {
                console.log(`Email verification failed: Invalid or expired token "${token}"`);
                // return res.status(400).send('Invalid or expired verification link.');
                return res.status(400).sendFile(path.join(__dirname, 'verification_failed.html'));
            }

            const user = users[0];

            // Update user to verified and clear token
            await connection.query(
                'UPDATE users SET email_verified = ?, email_verification_token = NULL, email_verification_expires = NULL, is_active = ? WHERE user_id = ?',
                [true, true, user.user_id] // Set email_verified to true and is_active to true
            );

            console.log(`Email verified successfully for user ID: ${user.user_id}, Email: ${user.email}`);
            // return res.send('Email verified successfully! You can now log in.');
            res.sendFile(path.join(__dirname, 'verification_success.html'));

        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Email verification error:', error);
        // return res.status(500).send('Internal server error during email verification.');
        res.status(500).sendFile(path.join(__dirname, 'verification_failed.html'));
    }
});

// --- API Route for Resetting Password ---
app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword || !confirmPassword) {
        return res.status(400).json({ success: false, message: 'Token and new passwords are required.' });
    }

    if (newPassword.length < 8) {
        return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    try {
        const connection = await pool.getConnection();
        try {
            // Find user by reset token and check expiry
            const [users] = await connection.query(
                'SELECT * FROM users WHERE password_reset_token = ? AND password_reset_expires > NOW()',
                [token]
            );

            if (users.length === 0) {
                console.log(`Password reset attempt with invalid or expired token: ${token}`);
                return res.status(400).json({ success: false, message: 'Invalid or expired password reset token. Please request a new one.' });
            }

            const user = users[0];

            // Hash the new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Update password and clear reset token fields
            await connection.query(
                'UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE user_id = ?',
                [hashedPassword, user.user_id]
            );

            console.log(`Password reset successfully for user ID: ${user.user_id}, Email: ${user.email}`);

            // Optionally, send an email confirming password change
            // const mailOptions = { ... };
            // await transporter.sendMail(mailOptions);

            res.json({ success: true, message: 'Your password has been reset successfully! You can now log in with your new password.' });

        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, message: 'Internal server error. Please try again later.' });
    }
});


// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password, role: roleFromRequest } = req.body;

    console.log('Login request received:', { email, role: roleFromRequest });

    if (!email || !password || !roleFromRequest) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email, password, and role selection are required.' 
      });
    }

    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password.' 
      });
    }

    const user = users[0];

    // Role validation
    let expectedDbRole;
    if (roleFromRequest === 'club') {
      expectedDbRole = 'club_admin';
    } else if (roleFromRequest === 'department') {
      expectedDbRole = 'department_admin';
    } else { // Default to student
      expectedDbRole = 'student';
    }
    if (user.role !== expectedDbRole) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid role for this account.' 
      });
    }

    if (!user.is_active) {
      return res.status(403).json({ 
        success: false, 
        message: 'Account is inactive. Contact support.' 
      });
    }

    // Check if email is verified before allowing login
    if (!user.email_verified) {
      return res.status(403).json({
        success: false,
        message: 'Account not verified. Please check your email for the verification link.'
      });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password.' 
      });
    }

    // Fetch department_id if the user is a department_admin
    let userDepartmentId = user.department_id || null; // Assuming users table has department_id

    if (user.role === 'department_admin') {
        console.log(`Department admin ${user.email} logged in, sending redirect instruction to client.`);
        const token = jwt.sign({
            id: user.user_id, email: user.email, role: user.role,
            firstName: user.first_name, lastName: user.last_name,
            department_id: userDepartmentId // Include department_id in token
        }, secret, { expiresIn: '2h' });

        res.json({
            success: true,
            message: 'Login successful. Redirecting...',
            redirectTo: '/department-dashboard', // Instruction for the client
            token, // Send the token
            user: {
                id: user.user_id,
                firstName: user.first_name,
                lastName: user.last_name,
                email: user.email,
                role: user.role,
                department_id: userDepartmentId // Also include in user object
            }
        });
    } else { // Added opening brace for the else block
        // For other roles (student, club_admin), generate and send a JWT token.
        const token = jwt.sign({
            id: user.user_id,
            email: user.email,
            role: user.role,
            firstName: user.first_name,
            lastName: user.last_name
        }, secret, { expiresIn: '2h' });

      try {
      const [rows] = await pool.query(
        `SELECT 
            u.user_id, u.first_name, u.last_name, u.email, u.major, u.graduation_year, u.bio, u.role,
            up.linkedin_url, up.github_url
         FROM users u
         LEFT JOIN user_profiles up ON u.user_id = up.user_id
         WHERE u.user_id = ?`,
        [user.user_id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'User profile not found.' });
      }

      const userProfile = rows[0];

      res.json({
        success: true,
        message: 'Login successful.',
        token,
        user: userProfile
      });
    } catch (err) {
      console.error('Login Error:', err);
      res.status(500).json({ 
        success: false, 
        message: 'Server error during login.' 
      });
    }
  }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error during login.' 
    });
  }
});

// --- API Route: Get Logged-in User's Profile ---
app.get('/api/user/profile', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;
        const [rows] = await pool.query(
            `SELECT 
                u.user_id, u.student_id, u.email, u.first_name, u.last_name, u.phone_number, u.profile_picture_url, u.bio, u.graduation_year, u.major, u.role, u.department_id,
                up.linkedin_url, up.github_url
             FROM users u
             LEFT JOIN user_profiles up ON u.user_id = up.user_id
             WHERE u.user_id = ?`,
            [userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const userProfile = rows[0];
        res.json({ success: true, userProfile });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch user profile.' });
    }
});

// --- Multer setup for profile picture upload ---
const multer = require('multer');
const profilePicStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'images'));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${req.user.id}-profile-${uniqueSuffix}${ext}`);
    }
});
const uploadProfilePic = multer({ storage: profilePicStorage });

// --- API Route for Updating Student Profile (with optional profile picture) ---
app.put('/api/user/profile', authenticateJWT, uploadProfilePic.single('profilePicture'), async (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ success: false, message: 'Forbidden: Only students can update their profile.' });
    }
    const userId = req.user.id;
    const { linkedin, github, bio } = req.body;
    let profilePictureUrl = null;
    if (req.file) {
        profilePictureUrl = `/images/${req.file.filename}`;
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Only allow editing linkedin, github, and bio
        await connection.query(
            `INSERT INTO user_profiles (user_id, linkedin_url, github_url)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE
                linkedin_url = VALUES(linkedin_url),
                github_url = VALUES(github_url)`,
            [userId, linkedin || null, github || null]
        );

        // Update bio and profile picture if provided
        let updateFields = 'bio = ?';
        let updateValues = [bio || null];
        if (profilePictureUrl) {
            updateFields += ', profile_picture_url = ?';
            updateValues.push(profilePictureUrl);
        }
        updateValues.push(userId);
        await connection.query(
            `UPDATE users SET ${updateFields} WHERE user_id = ?`,
            updateValues
        );

        await connection.commit();
        res.json({ success: true, message: 'Profile updated successfully.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error updating student profile:', error);
        res.status(500).json({ success: false, message: 'Failed to update profile.' });
    } finally {
        connection.release();
    }
});


// API Endpoint to Create a New Event
app.post('/api/events', authenticateJWT, async (req, res) => { // Protected route
    // Log the raw request body as received by the server
    console.log('Received /api/events POST request body:', req.body);

    const {
        title,
        description,
        // organizer_type, // Will be derived from req.user.role
        // organizer_id,   // Will be derived from req.user.department_id
        event_type,
        start_datetime,
        end_datetime,
        location,
        virtual_link,
        max_attendees,
        registration_required, // boolean
        tags, // JSON string from frontend
        image_url,
        // Optional fields not yet in the form, but in schema:
        // registration_deadline,
        // is_recurring,
        // recurrence_pattern,
        // is_published (defaults to TRUE in DB)
    } = req.body;

    // Derive organizer_type and organizer_id from authenticated user
    let organizer_type;
    let organizer_id;

    if (req.user.role === 'department_admin') {
        organizer_type = 'department';
        if (req.user.department_id && typeof req.user.department_id === 'number' && req.user.department_id > 0) {
            organizer_id = req.user.department_id;
        } else {
            console.error(`SERVER_LOG: Department Admin (User ID: ${req.user.id}, Email: ${req.user.email}) has an invalid or missing department_id in JWT/session. Found: '${req.user.department_id}'.`);
            organizer_id = req.user.department_id;
        }
    } else if (req.user.role === 'club_admin') {
        // Find the club managed by this admin
        const [clubs] = await pool.query('SELECT club_id FROM clubs_societies WHERE president_user_id = ?', [req.user.id]);
        if (clubs.length === 0) {
            return res.status(403).json({ success: false, message: 'No club associated with this admin account.' });
        }
        organizer_type = 'club';
        organizer_id = clubs[0].club_id;
    } else {
        return res.status(403).json({ success: false, message: 'Your role is not authorized to create events of this type.' });
    }

    // --- Enhanced Validation ---
    const errors = [];
    if (typeof title !== 'string' || title.trim() === '') {
        errors.push('Title is required and must be a non-empty string.');
    }
    if (typeof event_type !== 'string' || event_type.trim() === '') {
        errors.push('Event type is required.');
    }
    // Basic check for datetime string format (could be more robust with a regex or date library)
    if (typeof start_datetime !== 'string' || !start_datetime.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
        errors.push('Start date and time is required and must be in YYYY-MM-DDTHH:MM format.');
    }
    if (typeof end_datetime !== 'string' || !end_datetime.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
        errors.push('End date and time is required and must be in YYYY-MM-DDTHH:MM format.');
    }

    // Specific check for organizer_id based on derived organizer_type
    if (organizer_type === 'department') {
        if (typeof organizer_id !== 'number' || isNaN(organizer_id) || organizer_id <= 0) {
            errors.push('Department Admin is not associated with a valid Department ID. Please check the admin\'s user profile or contact support.');
        }
    } else if (organizer_type === 'club') {
        if (typeof organizer_id !== 'number' || isNaN(organizer_id) || organizer_id <= 0) {
            errors.push('Club Admin is not associated with a valid Club ID. Please check the admin\'s club profile or contact support.');
        }
    } else if (organizer_type === 'user') {
        if (typeof organizer_id !== 'number' || isNaN(organizer_id) || organizer_id <= 0) {
            errors.push('User Organizer ID is invalid or missing.');
        }
    }

    if (!['user', 'department', 'club'].includes(organizer_type)) { 
        errors.push('Organizer type is invalid.');
    }
     // Check for location or virtual link
    if ((typeof location !== 'string' || location.trim() === '') && (typeof virtual_link !== 'string' || virtual_link.trim() === '')) {
        errors.push('Either a physical location or a virtual link must be provided.');
    }

    if (errors.length > 0) {
        console.warn('Event creation validation errors:', errors);
        return res.status(400).json({ success: false, message: 'Validation failed. Please check the following: ' + errors.join(' ') });
    }
    // --- End of Enhanced Validation ---

    // For example, check if start_datetime is before end_datetime
    if (new Date(start_datetime) >= new Date(end_datetime)) {
        return res.status(400).json({ success: false, message: 'Start date and time must be before end date and time.' });
    }

    const parsedMaxAttendees = max_attendees ? parseInt(max_attendees, 10) : null;
    if (max_attendees && (isNaN(parsedMaxAttendees) || parsedMaxAttendees < 0)) {
        return res.status(400).json({ success: false, message: 'Max attendees, if provided, must be a non-negative number.' });
    }

    const sql = `
        INSERT INTO events (
            title, description, organizer_type, organizer_id, event_type,
            start_datetime, end_datetime, location, virtual_link, max_attendees,
            registration_required, tags, image_url
            ${req.body.hasOwnProperty('is_published') ? ', is_published' : ''}
            ${req.body.hasOwnProperty('registration_deadline') ? ', registration_deadline' : ''}
            ${req.body.hasOwnProperty('is_recurring') ? ', is_recurring' : ''}
            ${req.body.hasOwnProperty('recurrence_pattern') ? ', recurrence_pattern' : ''}
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            ${req.body.hasOwnProperty('is_published') ? ', ?' : ''}
            ${req.body.hasOwnProperty('registration_deadline') ? ', ?' : ''}
            ${req.body.hasOwnProperty('is_recurring') ? ', ?' : ''}
            ${req.body.hasOwnProperty('recurrence_pattern') ? ', ?' : ''}
        )
    `;

    const values = [
        title, description || null, organizer_type, organizer_id, event_type || null,
        start_datetime, // MySQL TIMESTAMP can handle 'YYYY-MM-DDTHH:MM'
        end_datetime,   // MySQL TIMESTAMP can handle 'YYYY-MM-DDTHH:MM'
        location || null,
        virtual_link || null,
        parsedMaxAttendees,
        registration_required, 
        (tags && Array.isArray(tags)) ? JSON.stringify(tags) : JSON.stringify([]), // Correctly stringify tags
        image_url || null
    ];

    if (req.body.hasOwnProperty('is_published')) values.push(req.body.is_published);
    if (req.body.hasOwnProperty('registration_deadline')) values.push(req.body.registration_deadline || null);
    if (req.body.hasOwnProperty('is_recurring')) values.push(req.body.is_recurring);
    if (req.body.hasOwnProperty('recurrence_pattern')) values.push(req.body.recurrence_pattern || null);

    try {
        const [result] = await pool.query(sql, values);
        console.log(`✅ Event Created Successfully!`);
        console.log(`   - Event ID: ${result.insertId}`);
        console.log(`   - Title: ${title}`);
        console.log(`   - Organizer: ${organizer_type} ID ${organizer_id} (User: ${req.user.email}, User ID: ${req.user.id})`);
        console.log(`   - Start Time: ${start_datetime}`);
        console.log(`   - Registration Deadline: ${req.body.registration_deadline || 'Not set'}`);
        // console.log('   - Full Event Data Submitted:', req.body); // Uncomment for very detailed logging
        res.status(201).json({ success: true, message: 'Event created successfully!', eventId: result.insertId });
    } catch (error) {
        console.error('Error creating event:', error);
        // Check for specific MySQL errors if needed
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
             return res.status(400).json({ success: false, message: `Invalid organizer ID (${organizer_id}) or other foreign key constraint violation.` });
        }
        res.status(500).json({ success: false, message: 'Database error: Failed to create event. Please try again.' });
    }
});

// --- Public Events Endpoint: Returns all published events (clubs & departments) for students ---
app.get('/api/events/public', async (req, res) => {
    try {
        // Join with clubs_societies and departments to get organizer name
        const [events] = await pool.query(`
            SELECT 
                e.event_id, e.title, e.description, e.organizer_type, e.organizer_id, e.event_type, 
                e.start_datetime, e.end_datetime, e.location, e.virtual_link, e.max_attendees, 
                e.registration_required, e.tags, e.image_url,
                CASE 
                    WHEN e.organizer_type = 'club' THEN c.name
                    WHEN e.organizer_type = 'department' THEN d.name
                    ELSE NULL
                END AS organizer_name
            FROM events e
            LEFT JOIN clubs_societies c ON e.organizer_type = 'club' AND e.organizer_id = c.club_id
            LEFT JOIN departments d ON e.organizer_type = 'department' AND e.organizer_id = d.department_id
            WHERE e.is_published = 1
            ORDER BY e.start_datetime DESC
        `);
        // Parse JSON fields from the DB before sending to the client
        events.forEach(event => {
            try {
                event.tags = JSON.parse(event.tags);
            } catch (e) {
                event.tags = [];
            }
        });
        res.json({ success: true, events });
    } catch (error) {
        console.error('Error fetching public events:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch public events.' });
    }
});

// API Endpoint to GET events for the logged-in department admin's department
app.get('/api/events/department', authenticateJWT, async (req, res) => {
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
        // Log how many events were found for this department ID
        console.log(`Found ${events.length} events for department ID ${departmentId} (User: ${req.user.email})`);
        res.json({ success: true, events });
    } catch (error) {
        console.error('Error fetching department events:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch department events.' });
    }
});

// API Endpoint to GET a single event by ID
app.get('/api/events/:eventId', authenticateJWT, async (req, res) => {
    try {
        const { eventId } = req.params;
        // Ensure the user is a department admin and the event belongs to their department
        // or allow any authenticated user to view event details if that's the design.
        // For editing, it's crucial to ensure ownership.

        const [eventRows] = await pool.query('SELECT * FROM events WHERE event_id = ?', [eventId]);

        if (eventRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Event not found.' });
        }

        const event = eventRows[0];

        // Authorization check: Ensure the department admin requesting is the organizer
        if (req.user.role === 'department_admin' && 
            (event.organizer_type !== 'department' || event.organizer_id !== req.user.department_id)) {
            return res.status(403).json({ success: false, message: 'You are not authorized to view or edit this event.' });
        }
        // Add similar checks if other roles can view/edit events under certain conditions

        res.json({ success: true, event });

    } catch (error) {
        console.error('Error fetching single event:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch event details.' });
    }
});

// API Endpoint to UPDATE an existing event
app.put('/api/events/:eventId', authenticateJWT, async (req, res) => {
    try {
        const { eventId } = req.params;
        console.log(`Received PUT /api/events/${eventId} request body:`, req.body); // Log request body

        const eventData = req.body; // Contains all fields from the form

        // Authorization: Ensure user is department_admin and owns this event
        const [existingEventRows] = await pool.query('SELECT organizer_id, organizer_type FROM events WHERE event_id = ?', [eventId]);
        if (existingEventRows.length === 0) return res.status(404).json({ success: false, message: 'Event not found.' });
        
        const existingEvent = existingEventRows[0];
        if (req.user.role !== 'department_admin' || existingEvent.organizer_type !== 'department' || existingEvent.organizer_id !== req.user.department_id) {
            return res.status(403).json({ success: false, message: 'You are not authorized to update this event.' });
        }

        // For simplicity, this example updates all provided fields.
        // In a real app, you'd carefully construct the SET clause based on what's in eventData
        // and perform more robust validation similar to the POST /api/events route.
        const { title, description, event_type, start_datetime, end_datetime, location, virtual_link, max_attendees, registration_required, tags, image_url } = eventData;

        // --- Comprehensive Validation (similar to POST /api/events) ---
        const errors = [];
        if (typeof title !== 'string' || title.trim() === '') {
            errors.push('Title is required and must be a non-empty string.');
        }
        if (typeof event_type !== 'string' || event_type.trim() === '') {
            errors.push('Event type is required.');
        }
        if (typeof start_datetime !== 'string' || !start_datetime.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
            errors.push('Start date and time is required and must be in YYYY-MM-DDTHH:MM format.');
        }
        if (typeof end_datetime !== 'string' || !end_datetime.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
            errors.push('End date and time is required and must be in YYYY-MM-DDTHH:MM format.');
        }
        if (typeof location !== 'string' || location.trim() === '') {
            errors.push('Location is required.');
        }
        if (typeof virtual_link !== 'string' || virtual_link.trim() === '') {
            errors.push('Virtual link is required.');
        }
        // Note: organizer_id and organizer_type are not part of eventData for update, they are for authorization.

        if (errors.length > 0) {
            console.warn(`Event update (ID: ${eventId}) validation errors:`, errors);
            return res.status(400).json({ success: false, message: 'Validation failed. Please check the following: ' + errors.join(' ') });
        }
        // --- End of Comprehensive Validation ---

        if (new Date(start_datetime) >= new Date(end_datetime)) {
            return res.status(400).json({ success: false, message: 'Start date and time must be before end date and time.' });
        }

        const parsedMaxAttendees = max_attendees ? parseInt(max_attendees, 10) : null;
        if (max_attendees && (isNaN(parsedMaxAttendees) || parsedMaxAttendees < 0)) {
            return res.status(400).json({ success: false, message: 'Max attendees must be a non-negative number.' });
        }

        // Ensure tags is an array before stringifying, default to empty array if not provided or not an array
        const tagsToStore = (Array.isArray(tags) ? JSON.stringify(tags) : JSON.stringify([]));

        const sql = `
            UPDATE events SET 
            title = ?, description = ?, event_type = ?, 
            start_datetime = ?, end_datetime = ?, location = ?, 
            virtual_link = ?, max_attendees = ?, registration_required = ?, 
            tags = ?, image_url = ? 
            ${eventData.hasOwnProperty('registration_deadline') ? ', registration_deadline = ?' : ''}
            WHERE event_id = ? AND organizer_id = ? AND organizer_type = 'department' 
        `; // Added organizer_id and organizer_type to WHERE for extra safety

        const values = [
            title, description || null, event_type || null, start_datetime, end_datetime,
            location || null, virtual_link || null, parsedMaxAttendees,
            registration_required || false, 
            tagsToStore, // Use the processed tagsToStore
            image_url || null
        ];
        if (eventData.hasOwnProperty('registration_deadline')) {
            values.push(eventData.registration_deadline || null);
        }
        values.push(
            eventId, req.user.department_id
        );

        const [result] = await pool.query(sql, values);

        if (result.affectedRows === 0) {
            // This could happen if the event_id doesn't exist OR if the organizer_id doesn't match,
            // though the initial check should catch most non-existence cases.
            return res.status(404).json({ success: false, message: 'Event not found or not authorized to update.' });
        }

        console.log(`✅ Event Updated Successfully!`);
        console.log(`   - Event ID: ${eventId}`);
        console.log(`   - Updated by: User ${req.user.email}`);
        // console.log('   - Full Event Data Submitted for Update:', eventData); // Uncomment for detailed logging
        res.json({ success: true, message: 'Event updated successfully!' });

    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ success: false, message: 'Failed to update event.' });
    }
});

// API Endpoint to Create a New Announcement
app.post('/api/announcements', authenticateJWT, async (req, res) => {
    try {
        const { title, content, priority, target_audience, tags, attachment_urls, scheduled_publish_at, expires_at, is_pinned, is_published } = req.body;
        console.log('Received /api/announcements POST request body:', req.body);

        if (!req.user) {
            console.error('SERVER_LOG: No user found in request. JWT might be missing or invalid.');
            return res.status(403).json({ success: false, message: 'Forbidden: No user found in request.' });
        }

        console.log('SERVER_LOG: Decoded JWT payload:', req.user);

        let authorType, authorEntityId;
        if (req.user.role === 'department_admin') {
            if (!req.user.department_id || typeof req.user.department_id !== 'number' || req.user.department_id <= 0) {
                console.error(`SERVER_LOG: Department Admin (User ID: ${req.user.id}, Email: ${req.user.email}) has an invalid or missing department_id in JWT/session. Found: '${req.user.department_id}'. Cannot create announcement.`);
                return res.status(400).json({ success: false, message: 'Department admin is not associated with a valid department ID.' });
            }
            authorType = 'department';
            authorEntityId = req.user.department_id;
        } else if (req.user.role === 'club_admin') {
            // Find the club managed by this admin
            const [clubs] = await pool.query('SELECT club_id FROM clubs_societies WHERE president_user_id = ?', [req.user.id]);
            if (clubs.length === 0) {
                console.error(`SERVER_LOG: Club Admin (User ID: ${req.user.id}, Email: ${req.user.email}) is not associated with any club. Cannot create announcement.`);
                return res.status(400).json({ success: false, message: 'Club admin is not associated with any club.' });
            }
            authorType = 'club';
            authorEntityId = clubs[0].club_id;
        } else {
            console.error(`SERVER_LOG: Unauthorized role attempting to create announcement. Role: ${req.user.role}, User ID: ${req.user.id}, Email: ${req.user.email}`);
            return res.status(403).json({ success: false, message: 'Access denied. User is not an authorized department or club admin.' });
        }

        const authorId = req.user.id; // The user_id of the admin creating it

        // Validate authorId (user_id for admin)
        if (!authorId || typeof authorId !== 'number' || authorId <= 0) {
            console.error(`SERVER_LOG: Admin (User ID: ${req.user.id}, Email: ${req.user.email}) has an invalid or missing user ID in JWT/session. Found: '${req.user.id}'. Cannot create announcement.`);
            return res.status(400).json({ success: false, message: 'Admin user ID is invalid.' });
        }

        // Basic Validation
        if (!title || !content) {
            return res.status(400).json({ success: false, message: 'Title and content are required.' });
        }

        // --- Fix: Ensure arrays are stringified for DB ---
        const tagsStr = Array.isArray(tags) ? JSON.stringify(tags) : (typeof tags === 'string' ? tags : JSON.stringify([]));
        const targetAudienceStr = Array.isArray(target_audience) ? JSON.stringify(target_audience) : (typeof target_audience === 'string' ? target_audience : JSON.stringify([]));
        const attachmentUrlsStr = Array.isArray(attachment_urls) ? JSON.stringify(attachment_urls) : (typeof attachment_urls === 'string' ? attachment_urls : JSON.stringify([]));

        const sql = `INSERT INTO announcements (
                        title, content, author_id, author_type, author_entity_id, 
                        priority, target_audience, tags, attachment_urls, 
                        is_pinned, scheduled_publish_at, expires_at, is_published
                     ) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        const values = [
            title,
            content,
            authorId, // Corrected from author_user_id
            authorType,
            authorEntityId, // Corrected from department_id
            priority || 'normal',
            targetAudienceStr,
            tagsStr,
            attachmentUrlsStr,
            is_pinned || false,
            scheduled_publish_at || null,
            expires_at || null,
            is_published === undefined ? true : !!is_published // Ensure this value is correctly added
        ];

        const [result] = await pool.query(sql, values);

        // If club admin, also create an event in the events table for the events directory
        if (authorType === 'club') {
            // Insert a minimal event using announcement data
            const eventSql = `INSERT INTO events (
                title, description, organizer_type, organizer_id, event_type, start_datetime, end_datetime, location, virtual_link, max_attendees, registration_required, tags, image_url, is_published
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            // Use announcement title/content, set event_type as 'announcement', and fill other fields as null/default
            const now = new Date();
            const startDate = now.toISOString().slice(0, 16); // 'YYYY-MM-DDTHH:MM'
            await pool.query(eventSql, [
                title,
                content,
                'club',
                authorEntityId,
                'announcement',
                startDate,
                startDate,
                null,
                null,
                null,
                false,
                tagsStr,
                null,
                true
            ]);
        }
        res.status(201).json({ success: true, message: 'Announcement created successfully!', announcementId: result.insertId });

    } catch (error) {
        console.error('Error creating announcement:', error);
        res.status(500).json({ success: false, message: 'Failed to create announcement.' });
    }
}); // This correctly closes the app.post('/api/announcements', ...) route handler

// --- API Route to get all clubs for the clubs directory ---
// --- Route to get all clubs for the clubs directory (plural, for frontend compatibility) ---
app.get('/api/clubs', async (req, res) => {
    try {
        const [clubs] = await pool.query(`
            SELECT 
                club_id,
                name,
                description,
                category,
                logo_url,
                member_count,
                meeting_schedule
            FROM clubs_societies
            WHERE is_active = 1
        `);
        res.json({ success: true, clubs });
    } catch (error) {
        console.error('Error fetching clubs:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch clubs.' });
    }
});

// Legacy alias for backwards compatibility (optional)
app.get('/api/club', async (req, res) => {
    try {
        const [clubs] = await pool.query(`
            SELECT 
                club_id,
                name,
                description,
                category,
                logo_url,
                member_count,
                meeting_schedule
            FROM clubs_societies
            WHERE is_active = 1
        `);
        res.json({ success: true, clubs });
    } catch (error) {
        console.error('Error fetching clubs:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch clubs.' });
    }
});

// GET all clubs and societies
app.get('/api/clubs', async (req, res) => {
    try {
        const [clubs] = await pool.query('SELECT * FROM clubs_societies');
        res.json({ success: true, clubs });
    } catch (error) {
        console.error('Error fetching clubs:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch clubs.' });
    }
});

// --- API Route to get all departments for the departments directory ---
app.get('/api/departments', async (req, res) => {
    try {
        // Parse offset and limit from query params, with defaults
        const offset = parseInt(req.query.offset, 10) || 0;
        const limit = parseInt(req.query.limit, 10) || 10;

        // Get total count for frontend
        const [countRows] = await pool.query('SELECT COUNT(*) as total FROM departments WHERE is_active = 1');
        const total = countRows[0].total;

        // Fetch paginated departments
        const [departments] = await pool.query(`
            SELECT 
                department_id,
                name,
                code,
                description,
                contact_email,
                contact_phone,
                website_url,
                is_active
            FROM departments
            WHERE is_active = 1
            ORDER BY name ASC
            LIMIT ? OFFSET ?
        `, [limit, offset]);
        res.json({ success: true, departments, total });
    } catch (error) {
        console.error('Error fetching departments:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch departments.' });
    }
});

// --- API Route to get departments from JSON file (for Load More) ---
app.get('/api/departments/json', async (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const jsonPath = path.join(__dirname, 'departments.json');
    try {
        if (!fs.existsSync(jsonPath)) {
            return res.status(404).json({ success: false, message: 'departments.json file not found.' });
        }
        const data = fs.readFileSync(jsonPath, 'utf-8');
        const departments = JSON.parse(data);
        res.json({ success: true, departments });
    } catch (error) {
        console.error('Error reading departments.json:', error);
        res.status(500).json({ success: false, message: 'Failed to load departments from JSON.' });
    }
});

 // Get pending join requests for clubs managed by the current club admin
app.get('/api/club/requests', authenticateJWT, async (req, res) => {
    if (req.user.role !== 'club_admin') {
        return res.status(403).json({ success: false, message: 'Only club admins can view join requests.' });
    }
    try {
        // Find clubs managed by this admin
        const [clubs] = await pool.query(
            'SELECT club_id FROM clubs_societies WHERE president_user_id = ?',
            [req.user.id]
        );
        const clubIds = clubs.map(c => c.club_id);
        if (clubIds.length === 0) {
            return res.json({ success: true, requests: [] });
        }
        // Get pending requests for these clubs
        const [requests] = await pool.query(
            `SELECT cm.membership_id, cm.user_id, cm.club_id, u.first_name, u.last_name, u.email
             FROM club_memberships cm
             JOIN users u ON cm.user_id = u.user_id
             WHERE cm.club_id IN (?) AND cm.status = 'pending'`,
            [clubIds]
        );
        res.json({ success: true, requests });
    } catch (err) {
        console.error('Error fetching club join requests:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch join requests.' });
    }
});
// Approve or reject a join request (club admin only)
app.post('/api/club/requests/handle', authenticateJWT, async (req, res) => {
    if (req.user.role !== 'club_admin') {
        return res.status(403).json({ success: false, message: 'Only club admins can handle join requests.' });
    }
    const { membership_id, action } = req.body;
    if (!membership_id || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ success: false, message: 'membership_id and valid action (approve/reject) are required.' });
    }
    try {
        // Find the club managed by this admin
        const [clubs] = await pool.query(
            'SELECT club_id FROM clubs_societies WHERE president_user_id = ?',
            [req.user.id]
        );
        if (clubs.length === 0) {
            return res.status(403).json({ success: false, message: 'No club associated with this admin account.' });
        }
        const clubId = clubs[0].club_id;
        // Ensure the membership request belongs to this club
        const [requests] = await pool.query(
            'SELECT * FROM club_memberships WHERE membership_id = ? AND club_id = ? AND status = "pending"',
            [membership_id, clubId]
        );
        if (requests.length === 0) {
            return res.status(404).json({ success: false, message: 'Join request not found or not pending.' });
        }
        if (action === 'approve') {
            await pool.query(
                'UPDATE club_memberships SET status = "active", joined_date = CURDATE() WHERE membership_id = ?',
                [membership_id]
            );
            // Optionally increment member_count in clubs_societies
            await pool.query(
                'UPDATE clubs_societies SET member_count = member_count + 1 WHERE club_id = ?',
                [clubId]
            );
            return res.json({ success: true, message: 'Join request approved.' });
        } else if (action === 'reject') {
            await pool.query(
                'UPDATE club_memberships SET status = "rejected" WHERE membership_id = ?',
                [membership_id]
            );
            return res.json({ success: true, message: 'Join request rejected.' });
        }
    } catch (error) {
        console.error('Error handling join request:', error);
        res.status(500).json({ success: false, message: 'Failed to handle join request.' });
    }
});

// --- API Endpoint: Student requests to join a club ---
app.post('/api/club/join-request', authenticateJWT, async (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ success: false, message: 'Only students can request to join clubs.' });
    }
    const userId = req.user.id;
    const { club_id } = req.body;
    if (!club_id || isNaN(club_id)) {
        return res.status(400).json({ success: false, message: 'club_id is required.' });
    }
    try {
        // Check if club exists and is active
        const [clubs] = await pool.query('SELECT * FROM clubs_societies WHERE club_id = ? AND is_active = 1', [club_id]);
        if (clubs.length === 0) {
            return res.status(404).json({ success: false, message: 'Club not found or inactive.' });
        }
        // Check if already a member or has a pending request
        const [existing] = await pool.query(
            'SELECT * FROM club_memberships WHERE user_id = ? AND club_id = ? AND status IN ("active", "pending")',
            [userId, club_id]
        );
        if (existing.length > 0) {
            const status = existing[0].status;
            if (status === 'active') {
                return res.status(409).json({ success: false, message: 'You are already a member of this club.' });
            } else {
                return res.status(409).json({ success: false, message: 'You already have a pending join request for this club.' });
            }
        }
        // Insert join request as pending
        await pool.query(
            'INSERT INTO club_memberships (user_id, club_id, role, status, joined_date) VALUES (?, ?, ?, ?, CURDATE())',
            [userId, club_id, 'member', 'pending']
        );
        res.status(201).json({ success: true, message: 'Join request submitted. Awaiting club admin approval.', status: 'pending' });
    } catch (error) {
        console.error('Error submitting club join request:', error);
        res.status(500).json({ success: false, message: 'Failed to submit join request.' });
    }
});

// --- API Endpoint: Get all club memberships for the logged-in student ---
app.get('/api/user/memberships', authenticateJWT, async (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ success: false, message: 'Only students can view their club memberships.' });
    }
    const userId = req.user.id;
    try {
        // Get all memberships for this user, including club info
        const [rows] = await pool.query(
            `SELECT cm.membership_id, cm.club_id, cm.status, cm.role, cm.joined_date, 
                    c.name AS club_name, c.logo_url, c.description AS club_description, c.category
             FROM club_memberships cm
             JOIN clubs_societies c ON cm.club_id = c.club_id
             WHERE cm.user_id = ?`,
            [userId]
        );
        res.json({ success: true, memberships: rows });
    } catch (error) {
        console.error('Error fetching user memberships:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch memberships.' });
    }
});
// --- Club Admin Dashboard Data Endpoint ---
// --- Club Admin Dashboard Data Endpoint ---
app.get('/api/club/dashboard', authenticateJWT, async (req, res) => {
    try {
        // Get the club managed by this admin
        const [clubs] = await pool.query(
            'SELECT * FROM clubs_societies WHERE president_user_id = ?',
            [req.user.id]
        );
        if (clubs.length === 0) {
            return res.status(404).json({ success: false, message: 'No club associated with this admin account.' });
        }
        const club = clubs[0];

        // Get pending join requests
        const [pendingRequests] = await pool.query(
            `SELECT cm.membership_id, u.first_name, u.last_name, u.major, u.graduation_year, u.email
             FROM club_memberships cm
             JOIN users u ON cm.user_id = u.user_id
             WHERE cm.club_id = ? AND cm.status = 'pending'`,
            [club.club_id]
        );

        const [currentMembers] = await pool.query(
            `SELECT cm.membership_id, u.first_name, u.last_name, u.email, cm.role
             FROM club_memberships cm
             JOIN users u ON cm.user_id = u.user_id
             WHERE cm.club_id = ? AND cm.status = 'active'`,
            [club.club_id]
        );

        const [events] = await pool.query(
            `SELECT event_id, title, description, DATE_FORMAT(start_datetime, '%b %d, %Y') as date
             FROM events WHERE organizer_type = 'club' AND organizer_id = ? ORDER BY start_datetime DESC LIMIT 5`,
            [club.club_id]
        );

        const [announcements] = await pool.query(
            `SELECT announcement_id, title, content, created_at FROM announcements WHERE author_type = 'club' AND author_entity_id = ? ORDER BY created_at DESC LIMIT 5`,
            [club.club_id]
        );

        const overview = {
            totalMembers: club.member_count || currentMembers.length,
            activeMembers: currentMembers.length,
            pendingRequests: pendingRequests.length,
            upcomingEvents: events.length
        };

        const members = {
            pending: pendingRequests.map(m => ({
                id: m.membership_id,
                name: `${m.first_name} ${m.last_name}`,
                major: m.major || '',
                graduationYear: m.graduation_year || '',
                email: m.email
            })),
            current: currentMembers.map(m => ({
                id: m.membership_id,
                name: `${m.first_name} ${m.last_name}`,
                role: m.role || 'Member',
                email: m.email
            }))
        };

        const eventsData = events.map(e => ({
            id: e.event_id,
            title: e.title,
            date: e.date,
            description: e.description
        }));
        // Announcements tab data
        const announcementsData = announcements.map(a => ({
            id: a.announcement_id,
            title: a.title,
            time: a.created_at ? new Date(a.created_at).toLocaleString() : '',
            content: a.content
        }));

        const profile = {
            name: club.name,
            description: club.description,
            contactEmail: club.contact_email,
            meetingSchedule: club.meeting_schedule,
            meetingLocation: club.meeting_location,
            category: club.category,
            logoUrl: club.logo_url
        };

        // Fetch the admin's real name from the users table
        let adminName = 'Admin';
        try {
            const [adminRows] = await pool.query(
                'SELECT first_name, last_name FROM users WHERE user_id = ?',
                [req.user.id]
            );
            if (adminRows.length > 0) {
                adminName = `${adminRows[0].first_name} ${adminRows[0].last_name}`.trim();
            }
        } catch (e) {
            // fallback to default if error
        }
        res.json({
            success: true,
            overview,
            members,
            events: eventsData,
            announcements: announcementsData,
            profile,
            adminName,
            clubName: club.name
        });
    } catch (err) {
        console.error('Error fetching club admin dashboard data:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch dashboard data.' });
    }
});
// In server.js or routes/announcements.js
app.get('/api/announcements', async (req, res) => {
    const departmentId = req.query.department_id;
    if (!departmentId) {
        return res.status(400).json({ success: false, message: 'Missing department_id' });
    }
    try {
        const [announcements] = await pool.query(
            `SELECT announcement_id, title, content, created_at 
             FROM announcements 
             WHERE author_type = 'department' AND author_entity_id = ? 
             ORDER BY created_at DESC LIMIT 10`,
            [departmentId]
        );
        res.json({ success: true, announcements });
    } catch (error) {
        console.error('Error fetching announcements:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch announcements.' });
    }
});
// --- Public API Route: Get Published Events for a Department by ID (for students and public) ---
app.get('/api/events/department/:id', async (req, res) => {
    const departmentId = parseInt(req.params.id, 10);
    if (!departmentId || isNaN(departmentId)) {
        return res.status(400).json({ success: false, message: 'Invalid department ID.' });
    }
    try {
        const [events] = await pool.query(
            `SELECT event_id, title, description,
                    DATE_FORMAT(start_datetime, '%Y-%m-%d %H:%i') as start_datetime_formatted,
                    DATE_FORMAT(registration_deadline, '%Y-%m-%d %H:%i') as registration_deadline_formatted,
                    location
             FROM events
             WHERE organizer_type = 'department' AND organizer_id = ? AND is_published = 1
             ORDER BY start_datetime DESC`,
            [departmentId]
        );
        res.json({ success: true, events });
    } catch (error) {
        console.error('Error fetching public department events:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch department events.' });
    }
});
// --- API Route: Follow/Unfollow a Department ---

app.post('/api/departments/:id/follow', authenticateJWT, async (req, res) => {
    try {
        const departmentId = parseInt(req.params.id, 10);
        const userId = req.user.id;
        if (!departmentId || isNaN(departmentId)) {
            return res.status(400).json({ success: false, message: 'Invalid department ID.' });
        }
        // Only students can follow/unfollow
        if (req.user.role !== 'student') {
            return res.status(403).json({ success: false, message: 'Only students can follow/unfollow departments.' });
        }
        // Check if already following
        const [existing] = await pool.query(
            'SELECT * FROM department_followers WHERE department_id = ? AND follower_user_id = ?',
            [departmentId, userId]
        );
        if (existing.length > 0) {
            // Unfollow
            await pool.query(
                'DELETE FROM department_followers WHERE department_id = ? AND follower_user_id = ?',
                [departmentId, userId]
            );
            return res.json({ success: true, following: false, message: 'Unfollowed department.' });
        } else {
            // Follow
            await pool.query(
                'INSERT INTO department_followers (department_id, follower_user_id, followed_at) VALUES (?, ?, NOW())',
                [departmentId, userId]
            );
            return res.json({ success: true, following: true, message: 'Followed department.' });
        }
    } catch (error) {
        console.error('Error in follow/unfollow department:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Already following this department.' });
        }
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({ success: false, message: 'Invalid department or user.' });
        }
        res.status(500).json({ success: false, message: 'Server error during follow/unfollow.' });
    }
});
// --- API Route: Get departments followed by the logged-in student ---
app.get('/api/user/followed-departments', authenticateJWT, async (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ success: false, message: 'Only students can view followed departments.' });
    }
    try {
        const [rows] = await pool.query(
            `SELECT d.department_id, d.name
             FROM department_followers f
             JOIN departments d ON f.department_id = d.department_id
             WHERE f.follower_user_id = ?`,
            [req.user.id]
        );
        res.json({ success: true, departments: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Database error.' });
    }
});
// --- API Route: Follow/Unfollow a Department ---
// --- API Route: Get a single department by ID (for department details page) ---
app.get('/api/departments/:id', async (req, res) => {
    const departmentId = parseInt(req.params.id, 10);
    console.log(`[DEPT-DETAILS] Route hit. Received id:`, req.params.id, 'Parsed:', departmentId);
    if (!departmentId || isNaN(departmentId)) {
        console.warn(`[DEPT-DETAILS] Invalid department ID:`, req.params.id);
        return res.status(400).json({ success: false, message: 'Invalid department ID.' });
    }
    try {
        const [departments] = await pool.query(
            `SELECT * FROM departments WHERE department_id = ? AND is_active = 1`,
            [departmentId]
        );
        if (departments.length === 0) {
            console.warn(`[DEPT-DETAILS] Department not found for id:`, departmentId);
            return res.status(404).json({ success: false, message: 'Department not found.' });
        }
        console.log(`[DEPT-DETAILS] Department found for id:`, departmentId);
        res.json({ success: true, department: departments[0] });
    } catch (error) {
        console.error('[DEPT-DETAILS] Error fetching department by ID:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch department.' });
    }
});
// --- API Route: Get Department Profile for Logged-in Department Admin ---
// --- API Route: Get Department Profile for Logged-in Department Admin ---
app.get('/api/department/profile', authenticateJWT, async (req, res) => {
    if (req.user.role !== 'department_admin' || !req.user.department_id) {
        return res.status(403).json({ success: false, message: 'Forbidden: Only department admins can view their department profile.' });
    }
    const departmentId = req.user.department_id;
    try {
        // Fetch from both departments and department_profiles tables and merge
        const [departments] = await pool.query(
            `SELECT * FROM departments WHERE department_id = ?`,
            [departmentId]
        );
        if (departments.length === 0) {
            return res.status(404).json({ success: false, message: 'Department not found.' });
        }
        const department = departments[0];
        const [profiles] = await pool.query(
            `SELECT * FROM department_profiles WHERE department_id = ?`,
            [departmentId]
        );
        const profile = profiles.length > 0 ? profiles[0] : {};
        // Merge department and profile fields (profile fields override if duplicate)
        const merged = { ...department, ...profile };
        res.json({ success: true, department: merged });
    } catch (error) {
        console.error('Error fetching department profile:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch department profile.' });
    }
});

// --- API Route: Update Department Profile (Department Admin Only) ---
app.put('/api/department/profile', authenticateJWT, async (req, res) => {
    if (req.user.role !== 'department_admin' || !req.user.department_id) {
        return res.status(403).json({ success: false, message: 'Forbidden: Only department admins can update their department profile.' });
    }
    const departmentId = req.user.department_id;
    const { name, description, email, phone, website, head_of_department, logo_url } = req.body;
    try {
        const [result] = await pool.query(
           `UPDATE departments SET 
            name = ?,
            description = ?,
            contact_email = ?,
            contact_phone = ?,
            website_url = ?,
            head_of_department = ?,
            logo_url = ?
         WHERE department_id = ?`,
            [
                name || null,
                description || null,
                email || null,
                phone || null,
                website || null,
                head_of_department || null,
                logo_url || null,
                departmentId
            ]
        );
        // --- Upsert department_profiles table ---
        const { about, vision, mission, achievements, cover_image_url, location } = req.body;
        await pool.query(
            `INSERT INTO department_profiles (department_id, about, vision, mission, achievements, cover_image_url, location)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                about = VALUES(about),
                vision = VALUES(vision),
                mission = VALUES(mission),
                achievements = VALUES(achievements),
                cover_image_url = VALUES(cover_image_url),
                location = VALUES(location)`,
            [
                departmentId,
                about || null,
                vision || null,
                mission || null,
                achievements || null,
                cover_image_url || null,
                location || null
            ]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Department not found or not authorized.' });
        }
        res.json({ success: true, message: 'Department profile updated successfully.' });
    } catch (error) {
        console.error('Error updating department profile:', error);
        res.status(500).json({ success: false, message: 'Failed to update department profile.' });
    }
});



// // Start server using the http server instance
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Main Pages:');
  console.log(`- Welcome: http://localhost:${PORT}/welcome`);
  console.log(`-x Admin Portals Welcome: http://localhost:${PORT}/welcome-admin-portals`);
  console.log(`- Student Signup: http://localhost:${PORT}/signup-student`);
  console.log(`- Student Login: http://localhost:${PORT}/login-student`);
  console.log(`- Admin Signup: http://localhost:${PORT}/signup-admin`);
  console.log(`- Admin Login: http://localhost:${PORT}/login-admin`);
  console.log(`- Events Management: http://localhost:${PORT}/events-management`);
  console.log(`- Department Dashboard: http://localhost:${PORT}/department-dashboard`);
  console.log(`- Student Dashboard: http://localhost:${PORT}/student-dashboard`);
  console.log(`- Club Admin Dashboard: http://localhost:${PORT}/club-admin-dashboard`);
  console.log(`- Departments Directory: http://localhost:${PORT}/departments-directory`);
  console.log(`- Clubs Directory: http://localhost:${PORT}/clubs-directory`);
  console.log(`- Projects Directory: http://localhost:${PORT}/projects`);
  console.log(`- Events Directory: http://localhost:${PORT}/events-directory`);
  console.log(`- Interactive Calendar: http://localhost:${PORT}/interactive-calendar`);
  console.log(`- Edit Student Profile: http://localhost:${PORT}/edit-student-profile`);
  console.log(`- Reset Password: http://localhost:${PORT}/reset-password`);
  console.log(`- Messaging: http://localhost:${PORT}/messaging`);
});
