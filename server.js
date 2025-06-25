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

const app = express();
const PORT = process.env.PORT || 3001; // Changed default port to 3001 to avoid conflict with MySQL default

// Middleware
app.use(express.json({ limit: '50mb' })); // Increased Limit to 50mb to accomodate image uploads
app.use(express.urlencoded({ extended: true }));

// Google OAuth2 Client Setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);


// Serve static files
app.use(express.static(__dirname));

// Nodemailer transporter setup
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    service: 'gmail', // Or your email provider
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
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
// --- Route for Departments Directory ---
app.get('/projects', (req, res) => {
  res.sendFile(path.join(__dirname, 'projects_directory.html'));
});

app.get('/departments-directory', (req, res) => {
    res.sendFile(path.join(__dirname, 'departments_directory.html'));
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

// VERY SIMPLE TEST ROUTE - Add this just before /api/events/department
app.get('/api/test-events-route-unique-name', (req, res) => {
  console.log('LOG: /api/test-events-route-unique-name was hit!');
  res.status(200).json({ success: true, message: 'Unique test route is working!' });
});

// Signup
app.post('/api/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, studentDetails, clubDetails, departmentDetails } = req.body;

    console.log('Signup request received:', { firstName, lastName, email, role });

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
      let userInsertData = {
        email,
        password_hash: hashedPassword,
        first_name: firstName,
        last_name: lastName,
        role,
        email_verified: false, // Set to false initially
        is_active: false // Set to false until email is verified
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
      // The user ID of the newly inserted user
      userId = result.insertId;

      // Generate and store verification token
      const verificationToken = generateVerificationToken();
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      await connection.query('UPDATE users SET email_verification_token = ?, email_verification_expires = ? WHERE user_id = ?', [verificationToken, expires, userId]);

      if (role === 'club_admin') {
        if (!clubDetails || !clubDetails.name || !clubDetails.category || !clubDetails.advisorName) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ 
            success: false, 
            message: 'Missing club-specific data (name, category, advisorName).' 
          });
        }
        const [existingClubs] = await connection.query('SELECT club_id FROM clubs_societies WHERE name = ?', [clubDetails.name]);
        if (existingClubs.length > 0) {
          await connection.rollback();
          connection.release();
          return res.status(409).json({ success: false, message: 'Club name already exists.' });
        }
        await connection.query(
          'INSERT INTO clubs_societies (name, description, category, president_user_id, advisor_name, contact_email, is_active, logo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
