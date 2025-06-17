require('dotenv').config();
const secret = process.env.JWT_SECRET;
const jwt = require('jsonwebtoken');
const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise'); 
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3306;

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

app.get('/events-management', (req, res) => {
  res.sendFile(path.join(__dirname, 'events_management.html'));
});

app.get('/department-dashboard', (req, res) => {  // New route
    res.sendFile(path.join(__dirname, 'department_admin.html')); // Corrected filename
});
// -- Route for Student Profile Directory --
app.get('/student-profile', (req, res) => { // This route was outside the conflict block but is related
  res.sendFile(path.join(__dirname, 'student-profile.html'));
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
app.get('/departments-directory', (req, res) => {
    res.sendFile(path.join(__dirname, 'departments_directory.html'));
});

// --- Route for Events Directory ---
app.get('/events-directory', (req, res) => {
    res.sendFile(path.join(__dirname, 'events_directory.html'));
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
        email_verified: true, // Set to true for now, implement email verification later
        is_active: true
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

        let newDepartmentId; // To store the ID of the department
        // Check if department code already exists (assuming department code should be unique)
        const [existingDepts] = await connection.query('SELECT department_id FROM departments WHERE code = ?', [departmentDetails.code]);
        // Also check if department name already exists (optional, but good for data integrity)
        // const [existingDeptNames] = await connection.query('SELECT department_id FROM departments WHERE name = ?', [departmentDetails.name]);
        if (existingDepts.length > 0) {
          await connection.rollback();
          connection.release();
          return res.status(409).json({ success: false, message: 'Department code already exists.' });
        }

        const [deptInsertResult] = await connection.query(
          'INSERT INTO departments (name, code, description, head_of_department_user_id, contact_email, contact_phone, website_url, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [ // Assuming head_of_department_user_id links to the users table
            departmentDetails.name,
            departmentDetails.code,
            departmentDetails.description || null,
            userId, // Assign the current user (department_admin) as head_of_department_user_id
            email, // User's email as department contact email
            departmentDetails.contact_phone || null,
            departmentDetails.website_url || null,
            true 
          ]
        );
        // Note: The above INSERT for departments uses departmentDetails.head_of_department.
        // It's now set to `userId`.
        newDepartmentId = deptInsertResult.insertId;

        // IMPORTANT: Update the users table to link this admin to this new department
        await connection.query(
          'UPDATE users SET department_id = ? WHERE user_id = ?',
          [newDepartmentId, userId]
        );
      }

      await connection.commit();
      connection.release();

      // Fetch department_id for the department_admin to include in token and response
      let associatedDepartmentId = null;
      if (role === 'department_admin') {
        // If a new department was created, its ID isn't directly available here without another query
        // However, we've now updated the user record with newDepartmentId.
        // So, we can query it back or directly use newDepartmentId if it was scoped correctly.
        // For clarity and robustness, let's re-fetch from the (now updated) user record.
        const [deptUserRows] = await pool.query('SELECT department_id FROM users WHERE user_id = ?', [userId]);
        if (deptUserRows.length > 0) associatedDepartmentId = deptUserRows[0].department_id;
      }

      if (role === 'department_admin') {
        console.log(`Department admin ${email} registered, sending redirect instruction to client.`);
        const token = jwt.sign({
            id: userId, email, role, firstName, lastName,
            department_id: associatedDepartmentId // Include department_id
        }, secret, { expiresIn: '2h' });
        res.status(201).json({
          success: true, message: `Department admin ${email} registered successfully. Redirecting...`,
          redirectTo: '/department-dashboard', token,
          user: { id: userId, firstName, lastName, email, role, department_id: associatedDepartmentId }
        });
      } else {
        // For other roles (student, club_admin), generate and send a JWT token.
        const token = jwt.sign({
          id: userId,
          email,
          role,
          firstName,
          lastName
        }, secret, { expiresIn: '2h' });

        console.log(`User ${email} (role: ${role}) registered, sending token.`);
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
          }
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

// --- Authentication Middleware ---
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1]; // Bearer TOKEN
        jwt.verify(token, secret, (err, userPayload) => {
            if (err) {
                console.error('JWT verification failed:', err.message);
                // Send JSON response for 403 Forbidden
                return res.status(403).json({ success: false, message: 'Forbidden: Invalid or expired token.' });
            }
            req.user = userPayload; // Attach user payload (including role, id, email, department_id etc.)
            next();
        });
    } else {
        // Send JSON response for 401 Unauthorized
        console.warn('JWT Authentication: No token provided.');
        res.status(401).json({ success: false, message: 'Unauthorized: No token provided.' });
    }
};

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
    } else {
        // For other roles (student, club_admin), generate and send a JWT token.
        const token = jwt.sign({
            id: user.user_id,
            email: user.email,
            role: user.role,
            firstName: user.first_name,
            lastName: user.last_name
        }, secret, { expiresIn: '2h' });

        console.log(`User ${user.email} (role: ${user.role}) logged in, sending token.`);
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
        // Explicitly check department_id from token before assigning
        if (req.user.department_id && typeof req.user.department_id === 'number' && req.user.department_id > 0) {
            organizer_id = req.user.department_id;
        } else {
            console.error(`SERVER_LOG: Department Admin (User ID: ${req.user.id}, Email: ${req.user.email}) has an invalid or missing department_id in JWT/session. Found: '${req.user.department_id}'. This will likely cause event creation to fail validation for organizer_id.`);
            organizer_id = req.user.department_id; // Assign it (e.g., null, undefined, 0) - the validation block below will catch it and form the client error message.
        }
    } else {
        // Handle other roles if they can create events (e.g., club_admin)
        // For now, only department_admin is configured.
        console.warn(`User ${req.user.email} (role: ${req.user.role}) attempted to create event, but role not configured for event creation.`);
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
    } else if (organizer_type === 'user') { // Example if you add user-created events
        if (typeof organizer_id !== 'number' || isNaN(organizer_id) || organizer_id <= 0) {
            errors.push('User Organizer ID is invalid or missing.');
        }
    } // Add similar for 'club' if that becomes a possibility

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
        // The SQL query below needs to be made robust to include all editable fields, including registration_deadline.
        // It's better to explicitly list columns to update.
        const { title, description, event_type, start_datetime, end_datetime, location, virtual_link, max_attendees, registration_required, tags, image_url } = eventData;

        // Basic validation (should be more comprehensive like in POST)
        if (!title || !event_type || !start_datetime || !end_datetime) {
            return res.status(400).json({ success: false, message: 'Missing required fields for update.' });
        }
        if (new Date(start_datetime) >= new Date(end_datetime)) {
            return res.status(400).json({ success: false, message: 'Start date and time must be before end date and time.' });
        }
        const parsedMaxAttendees = max_attendees ? parseInt(max_attendees, 10) : null;
        if (max_attendees && (isNaN(parsedMaxAttendees) || parsedMaxAttendees < 0)) {
            return res.status(400).json({ success: false, message: 'Max attendees must be a non-negative number.' });
        }

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
            registration_required || false, tags || JSON.stringify([]), image_url || null
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




// API Endpoint to Create a New Announcement
app.post('/api/announcements', authenticateJWT, async (req, res) => {
    try {
        const { title, content, priority, target_audience, tags, attachment_urls, scheduled_publish_at, expires_at, is_pinned, is_published } = req.body;
        console.log('Received /api/announcements POST request body:', req.body);

        // Authorization: Ensure user is department_admin
        if (req.user.role !== 'department_admin' || !req.user.department_id) {
            return res.status(403).json({ success: false, message: 'Access denied. User is not an authorized department admin or department ID is missing.' });
        }

        const authorType = 'department'; // Since this route is for department admins
        const authorEntityId = req.user.department_id; // The department_id of the admin
        const authorId = req.user.id; // The user_id of the admin creating it

        // Validate that authorEntityId (department_id for admin) is valid
        if (!authorEntityId || typeof authorEntityId !== 'number' || authorEntityId <= 0) {
            console.error(`SERVER_LOG: Department Admin (User ID: ${req.user.id}, Email: ${req.user.email}) has an invalid or missing department_id in JWT/session. Found: '${req.user.department_id}'. Cannot create announcement.`);
            return res.status(400).json({ success: false, message: 'Department admin is not associated with a valid department ID.' });
        }
        // Validate authorId (user_id for admin)
        if (!authorId || typeof authorId !== 'number' || authorId <= 0) {
            console.error(`SERVER_LOG: Department Admin (User ID: ${req.user.id}, Email: ${req.user.email}) has an invalid or missing user ID in JWT/session. Found: '${req.user.id}'. Cannot create announcement.`);
            return res.status(400).json({ success: false, message: 'Admin user ID is invalid.' });
        }

        // Basic Validation
        if (!title || !content) {
            return res.status(400).json({ success: false, message: 'Title and content are required.' });
        }

        const sql = `INSERT INTO announcements (
                        title, content, author_id, author_type, author_entity_id, 
                        priority, target_audience, tags, attachment_urls, 
                        is_pinned, scheduled_publish_at, expires_at, is_published
                     ) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        const values = [
            title,
            content,
            authorId, // Corrected from author_user_id
            authorType,
            authorEntityId, // Corrected from department_id
            priority || 'normal',
            target_audience || JSON.stringify([]),
            tags || JSON.stringify([]),
            attachment_urls || JSON.stringify([]),
            is_pinned || false,
            scheduled_publish_at || null,
            expires_at || null,
            is_published === undefined ? true : !!is_published // Ensure this value is correctly added
        ];

        const [result] = await pool.query(sql, values);
        res.status(201).json({ success: true, message: 'Announcement created successfully!', announcementId: result.insertId });

    } catch (error) {
        console.error('Error creating announcement:', error);
        res.status(500).json({ success: false, message: 'Failed to create announcement.' });
    } // This closes the try-catch block
}); // This correctly closes the app.post('/api/announcements', ...) route handler

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Welcome page: http://localhost:${PORT}/welcome`);
  console.log(`Student Signup: http://localhost:${PORT}/signup-student`);
  console.log(`Student Login: http://localhost:${PORT}/login-student`);
  console.log(`Admin Signup: http://localhost:${PORT}/signup-admin`);
  console.log(`Admin Login: http://localhost:${PORT}/login-admin`);
  console.log(`Departments Directory: http://localhost:${PORT}/departments-directory`);
  console.log(`Events Directory: http://localhost:${PORT}/events-directory`);
});
