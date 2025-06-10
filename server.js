require('dotenv').config();
const secret = process.env.JWT_SECRET;
const jwt = require('jsonwebtoken');
const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise'); 
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(__dirname)); 

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

// --- HTML Serving Routes ---

// Root redirects to welcome
app.get('/', (req, res) => {
  res.redirect('/welcome');
});

app.get('/welcome', (req, res) => {
  res.sendFile(path.join(__dirname, 'welcome.html'));
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

app.get('/department-dashboard', (req, res) => {  // New route
    res.sendFile(path.join(__dirname, 'department_admin.html')); // Corrected filename
});

// --- API Routes ---

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
        email_verified: true, // Set to true for now, implement email verification later
        is_active: true
      };

      if (role === 'student') {
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
          'INSERT INTO clubs_societies (name, description, category, president_user_id, advisor_name, contact_email, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [clubDetails.name, clubDetails.description || null, clubDetails.category, userId, clubDetails.advisorName, email, true]
        );
      } else if (role === 'department_admin') {
        if (!departmentDetails || !departmentDetails.name || !departmentDetails.code) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ 
            success: false, 
            message: 'Missing department-specific data (Department Name and Department Code are required).' 
          });
        }

        // Check if department code already exists
        const [existingDepts] = await connection.query('SELECT department_id FROM departments WHERE code = ?', [departmentDetails.code]);
        if (existingDepts.length > 0) {
          await connection.rollback();
          connection.release();
          return res.status(409).json({ success: false, message: 'Department code already exists.' });
        }

        await connection.query(
          'INSERT INTO departments (name, code, description, head_of_department, contact_email, contact_phone, website_url, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            departmentDetails.name,
            departmentDetails.code,
            departmentDetails.description || null,
            departmentDetails.head_of_department || null,
            email, // User's email as department contact email
            departmentDetails.contact_phone || null,
            departmentDetails.website_url || null,
            true 
          ]
        );
      }

      await connection.commit();
      connection.release();

      if (role === 'department_admin') {
        // For department admin, redirect to their dashboard.
        // Note: The token is not sent in the response body with a redirect.
        // If the dashboard page needs the token immediately, consider setting an HTTP-only cookie
        // or have the frontend handle the redirect after receiving the token in a JSON response.
        res.redirect('/department-dashboard');
      } else {
        const token = jwt.sign({
          id: userId,
          email,
          role,
          firstName,
          lastName
        }, secret, { expiresIn: '2h' });

        res.status(201).json({
          success: true,
          message: `User ${email} registered successfully as ${role}.`,
          token,
          user: {
            id: userId,
            firstName,
            lastName,
            email,
            role
          } // Removed extra closing brace here
      });
    }

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
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ 
        success: false, 
        message: 'Email already registered.' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
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

    if (!user.email_verified) {
      return res.status(403).json({ 
        success: false, 
        message: 'Account not verified. Please check your email.' 
      });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password.' 
      });
    }

    if (user.role === 'department_admin') {
        // For department admin, redirect to their dashboard.
        // Note: The token is not sent in the response body with a redirect.
        // If the dashboard page needs the token immediately, consider setting an HTTP-only cookie
        // or have the frontend handle the redirect after receiving the token in a JSON response.
        res.redirect('/department-dashboard');
    } else {
        const token = jwt.sign({
            id: user.user_id,
            email: user.email,
            role: user.role,
            firstName: user.first_name,
            lastName: user.last_name
        }, secret, { expiresIn: '2h' });

        res.json({
            success: true,
            message: 'Login successful.',
            token,
            user: {
                id: user.user_id,
                firstName: user.first_name,
                lastName: user.last_name,
                email: user.email,
                role: user.role,
            }
        });
    }

  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login.' 
    });
  }
});

// API Endpoint to Create a New Event
app.post('/api/events', async (req, res) => {
    // In a real application, you'd get the user ID and role from an authenticated session/token
    // For now, we'll assume the frontend correctly sets organizer_type and a placeholder organizer_id
    // It's CRITICAL to validate that the user making the request is authorized to create events for the given organizer_id.
    // For example, if organizer_type is 'department', ensure the logged-in user is an admin of that department.

    const {
        title,
        description,
        organizer_type, // Should be 'department' from the frontend for this form
        organizer_id,   // This should ideally be derived from the authenticated user's session
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

    // Basic Validation
    if (!title || !organizer_type || !organizer_id || !event_type || !start_datetime || !end_datetime) {
        return res.status(400).json({ success: false, message: 'Missing required fields: title, organizer_type, organizer_id, event_type, start_datetime, end_datetime.' });
    }

    // Further validation (e.g., date formats, enum values) can be added here
    // For example, check if start_datetime is before end_datetime
    if (new Date(start_datetime) >= new Date(end_datetime)) {
        return res.status(400).json({ success: false, message: 'Start date and time must be before end date and time.' });
    }

    const parsedMaxAttendees = max_attendees ? parseInt(max_attendees, 10) : null;
    if (max_attendees && (isNaN(parsedMaxAttendees) || parsedMaxAttendees < 0)) {
        return res.status(400).json({ success: false, message: 'Max attendees must be a non-negative number.' });
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
        start_datetime, end_datetime, location || null, virtual_link || null, parsedMaxAttendees,
        registration_required, tags || JSON.stringify([]), image_url || null
    ];

    if (req.body.hasOwnProperty('is_published')) values.push(req.body.is_published);
    if (req.body.hasOwnProperty('registration_deadline')) values.push(req.body.registration_deadline || null);
    if (req.body.hasOwnProperty('is_recurring')) values.push(req.body.is_recurring);
    if (req.body.hasOwnProperty('recurrence_pattern')) values.push(req.body.recurrence_pattern || null);

    try {
        const [result] = await pool.query(sql, values);
        res.status(201).json({ success: true, message: 'Event created successfully!', eventId: result.insertId });
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ success: false, message: 'Failed to create event. Please try again.' });
    }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Welcome page: http://localhost:${PORT}/welcome`);
  console.log(`Student Signup: http://localhost:${PORT}/signup-student`);
  console.log(`Student Login: http://localhost:${PORT}/login-student`);
  console.log(`Admin Signup: http://localhost:${PORT}/signup-admin`);
  console.log(`Admin Login: http://localhost:${PORT}/login-admin`);
});