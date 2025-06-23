require('dotenv').config();
const secret = process.env.JWT_SECRET;
const jwt = require('jsonwebtoken');
const express = require('express');
const path = require('path');
const multer = require('multer'); // For handling file uploads
const mysql = require('mysql2/promise'); 
const bcrypt = require('bcrypt');
const crypto = require('crypto'); // For generating tokens
const fetch = require('node-fetch'); // For making HTTP requests from the backend
const { google } = require('googleapis'); // For Google Calendar API

const app = express();
// Configure multer for file uploads (store in memory for now, then upload to cloud storage)
// Note: For attachment_urls, we assume the frontend handles file uploads to cloud storage
// and sends the URLs. If direct file upload via this API is needed, this part needs more logic.
const PORT = process.env.PORT || 3306;

// Middleware
app.use(express.json());
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

// --- HTML Serving Routes ---

// Root redirects to welcome
app.get('/', (req, res) => {
  res.redirect('/welcome');
});

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
app.get('/reset-password.html', (req, res) => { // The URL path remains the same as frontend expects
    res.sendFile(path.join(__dirname, 'reset_password.html')); // Corrected to match the actual filename
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
        // Check if department code already exists
        const [existingDepts] = await connection.query('SELECT department_id, name FROM departments WHERE code = ?', [departmentDetails.code]);

        if (existingDepts.length > 0) {
          // Department already exists. Associate this new admin with the existing department.
          newDepartmentId = existingDepts[0].department_id;
          console.log(`Department with code ${departmentDetails.code} (Name: ${existingDepts[0].name}, ID: ${newDepartmentId}) already exists. New admin (User ID: ${userId}) will be associated with it.`);
          // We do not update the department's details (like name or head_of_department_user_id) here.
          // The head_of_department_user_id remains the ID of the first admin who created it.
        } else {
          // Department does not exist, create it.
          const [deptInsertResult] = await connection.query(
            'INSERT INTO departments (name, code, description, head_of_department_user_id, contact_email, contact_phone, website_url, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [ 
              departmentDetails.name,
              departmentDetails.code,
              departmentDetails.description || null,
              userId, // Assign the current user (department_admin) as head_of_department_user_id
              email, 
              departmentDetails.contact_phone || null,
              departmentDetails.website_url || null,
              true 
            ]
          );
          newDepartmentId = deptInsertResult.insertId;
          console.log(`New department "${departmentDetails.name}" (Code: ${departmentDetails.code}) created with ID: ${newDepartmentId}. Head admin ID set to: ${userId}`);
        }

        // IMPORTANT: Update the users table to link this admin to this new department
        await connection.query(
          'UPDATE users SET department_id = ? WHERE user_id = ?',
          [newDepartmentId, userId]
        );
      }

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
               <p>Best regards,<br>The Campus Connect Team</p>`,
      };
      await transporter.sendMail(mailOptions);
      console.log(`Verification email sent to ${email}`);

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
          success: true, message: `Department admin ${email} registered successfully. Please check your email to verify your account.`,
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
          message: `User ${email} registered successfully as ${role}. Please check your email to verify your account.`,
          // token, // Optionally withhold token until email is verified
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

// --- API Route for Requesting Password Reset ---
app.post('/api/request-password-reset', async (req, res) => {
    const { email, role } = req.body;

    if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    // Determine the expected database role based on the request
    let expectedDbRole;
    if (role === 'club') {
        expectedDbRole = 'club_admin';
    } else if (role === 'department') {
        expectedDbRole = 'department_admin';
    } else {
        expectedDbRole = 'student';
    }

    const connection = await pool.getConnection();
    try {
        // Find user by email and role
        const [users] = await connection.query(
            'SELECT * FROM users WHERE email = ? AND role = ?',
            [email, expectedDbRole]
        );

        // IMPORTANT: For security, always return a generic success message
        // This prevents attackers from discovering which emails are registered.
        if (users.length === 0) {
            console.log(`Password reset requested for non-existent or role-mismatched email: ${email}`);
            return res.json({ success: true, message: 'If an account with that email exists, a password reset link has been sent.' });
        }

        const user = users[0];
        const userId = user.user_id;
        const firstName = user.first_name;

        // Generate a secure, unique token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000); // Token is valid for 1 hour

        // Store the token and its expiry in the database
        await connection.query(
            'UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE user_id = ?',
            [resetToken, expires, userId]
        );

        // Construct the password reset link
        const resetLink = `http://localhost:${PORT}/reset-password.html?token=${resetToken}`;

        // Send the email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Campus Connect - Password Reset Request',
            html: `<p>Hello ${firstName},</p>
                   <p>You requested a password reset for your Campus Connect account.</p>
                   <p>Please click the following link to set a new password:</p>
                   <a href="${resetLink}">${resetLink}</a>
                   <p>This link will expire in 1 hour.</p>
                   <p>If you did not request this, please ignore this email.</p>
                   <p>Best regards,<br>The Campus Connect Team</p>`,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Password reset email sent to ${email}`);

        res.json({ success: true, message: 'If an account with that email exists, a password reset link has been sent.' });

    } catch (error) {
        console.error('Request password reset error:', error);
        // Still send a generic message to the client for security
        res.json({ success: true, message: 'If an account with that email exists, a password reset link has been sent.' });
    } finally {
        connection.release();
    }
});

// --- API Route for Resetting Password ---
app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ success: false, message: 'Token and new password are required.' });
    }

    if (newPassword.length < 8) {
        return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
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
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: user.email,
                subject: 'Campus Connect - Your Password Has Been Changed',
                html: `<p>Hello ${user.first_name},</p>
                       <p>This is a confirmation that the password for your Campus Connect account has just been changed.</p>
                       <p>If you did not make this change, please contact support immediately.</p>
                       <p>Best regards,<br>The Campus Connect Team</p>`,
            };
            await transporter.sendMail(mailOptions);

            res.json({ success: true, message: 'Your password has been reset successfully! You can now log in with your new password.' });

        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, message: 'Internal server error. Please try again later.' });
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
        if ((typeof location !== 'string' || location.trim() === '') && (typeof virtual_link !== 'string' || virtual_link.trim() === '')) {
            errors.push('Either a physical location or a virtual link must be provided.');
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

// --- Messaging System API Endpoints ---

// 1. Create a Direct Message Conversation
app.post('/api/messages/conversations/direct', authenticateJWT, async (req, res) => {
    const { recipientId } = req.body;
    const senderId = req.user.id;

    if (!recipientId || typeof recipientId !== 'number') {
        return res.status(400).json({ success: false, message: 'Recipient ID is required and must be a number.' });
    }
    if (senderId === recipientId) {
        return res.status(400).json({ success: false, message: 'Cannot create a direct conversation with yourself.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Check if a direct conversation already exists between these two users
        // A direct conversation has exactly two participants.
        const [existingConversations] = await connection.query(
            `SELECT c.conversation_id
             FROM conversations c
             JOIN conversation_participants cp1 ON c.conversation_id = cp1.conversation_id
             JOIN conversation_participants cp2 ON c.conversation_id = cp2.conversation_id
             WHERE c.type = 'direct'
               AND cp1.user_id = ? AND cp2.user_id = ?
               AND cp1.user_id != cp2.user_id`, // Ensure it's not a self-chat
            [senderId, recipientId]
        );

        if (existingConversations.length > 0) {
            await connection.rollback();
            return res.status(200).json({
                success: true,
                message: 'Direct conversation already exists.',
                conversationId: existingConversations[0].conversation_id
            });
        }

        // Create new conversation
        const [convResult] = await connection.query(
            "INSERT INTO conversations (type) VALUES ('direct')"
        );
        const conversationId = convResult.insertId;

        // Add participants
        await connection.query(
            "INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)",
            [conversationId, senderId, conversationId, recipientId]
        );

        await connection.commit();
        res.status(201).json({
            success: true,
            message: 'Direct conversation created successfully.',
            conversationId: conversationId
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error creating direct conversation:', error);
        res.status(500).json({ success: false, message: 'Failed to create direct conversation.' });
    } finally {
        connection.release();
    }
});

// 2. Create a Group Message Conversation
app.post('/api/messages/conversations/group', authenticateJWT, async (req, res) => {
    const { name, participantIds, description } = req.body;
    const creatorId = req.user.id;

    if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ success: false, message: 'Group name is required.' });
    }
    if (!participantIds || !Array.isArray(participantIds) || participantIds.length < 1) {
        return res.status(400).json({ success: false, message: 'At least one participant ID is required for a group.' });
    }

    // Ensure creator is included and unique in the participant list
    const uniqueParticipantIds = [...new Set([...participantIds, creatorId])];

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Create new group conversation
        const [convResult] = await connection.query(
            "INSERT INTO conversations (type, name, description) VALUES ('group', ?, ?)",
            [name, description || null]
        );
        const conversationId = convResult.insertId;

        // Add participants, marking the creator as admin
        const participantInsertValues = uniqueParticipantIds.map(id => [conversationId, id, id === creatorId]);
        await connection.query(
            "INSERT INTO conversation_participants (conversation_id, user_id, is_admin) VALUES ?",
            [participantInsertValues]
        );

        await connection.commit();
        res.status(201).json({
            success: true,
            message: 'Group conversation created successfully.',
            conversationId: conversationId
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error creating group conversation:', error);
        res.status(500).json({ success: false, message: 'Failed to create group conversation.' });
    } finally {
        connection.release();
    }
});

// 3. Get User's Conversations
app.get('/api/messages/conversations', authenticateJWT, async (req, res) => {
    const userId = req.user.id;

    try {
        const [conversations] = await pool.query(
            `SELECT
                c.conversation_id,
                c.type,
                c.name,
                c.description,
                c.last_message_at,
                (SELECT m.content FROM messages m WHERE m.conversation_id = c.conversation_id ORDER BY m.timestamp DESC LIMIT 1) AS last_message_content,
                (SELECT COUNT(m.message_id) FROM messages m
                 JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
                 WHERE m.conversation_id = c.conversation_id AND m.message_id > IFNULL(cp.last_read_message_id, 0) AND cp.user_id = ?) AS unread_count
             FROM conversations c
             JOIN conversation_participants cp ON c.conversation_id = cp.conversation_id
             WHERE cp.user_id = ? AND cp.is_active = TRUE
             ORDER BY c.last_message_at DESC`,
            [userId, userId]
        );

        res.json({ success: true, conversations });

    } catch (error) {
        console.error('Error fetching user conversations:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch conversations.' });
    }
});

// 4. Get Messages for a Conversation (Paginated)
app.get('/api/messages/conversations/:conversationId/messages', authenticateJWT, async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const beforeId = req.query.beforeId ? parseInt(req.query.beforeId, 10) : null;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50; // Default limit

    if (isNaN(limit) || limit <= 0) {
        return res.status(400).json({ success: false, message: 'Limit must be a positive number.' });
    }

    try {
        // Verify user is a participant in the conversation
        const [participants] = await pool.query(
            "SELECT * FROM conversation_participants WHERE conversation_id = ? AND user_id = ? AND is_active = TRUE",
            [conversationId, userId]
        );

        if (participants.length === 0) {
            return res.status(403).json({ success: false, message: 'You are not a participant in this conversation.' });
        }

        let query = `
            SELECT message_id, sender_id, subject, content, attachment_urls, timestamp, type, is_deleted, reply_to_message_id
            FROM messages
            WHERE conversation_id = ?
        `;
        const queryParams = [conversationId];

        if (beforeId) {
            query += ` AND message_id < ?`;
            queryParams.push(beforeId);
        }

        query += ` ORDER BY timestamp DESC LIMIT ?`;
        queryParams.push(limit);

        const [messages] = await pool.query(query, queryParams);

        // Optionally, mark messages as read up to the latest fetched message
        if (messages.length > 0) {
            const latestMessageId = messages[0].message_id; // Messages are ordered DESC, so first is latest
            await pool.query(
                "UPDATE conversation_participants SET last_read_message_id = ? WHERE conversation_id = ? AND user_id = ? AND (last_read_message_id IS NULL OR last_read_message_id < ?)",
                [latestMessageId, conversationId, userId, latestMessageId]
            );
        }

        res.json({ success: true, messages: messages.reverse() }); // Reverse to show oldest first for chat display

    } catch (error) {
        console.error('Error fetching messages for conversation:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch messages.' });
    }
});

// 5. Send a Message (Text or with Attachment URLs)
// Note: This endpoint assumes attachment_urls are already generated (e.g., from a cloud storage upload on the frontend).
// If you need direct file upload via this API, a multer middleware would be required here.
app.post('/api/messages/conversations/:conversationId/send', authenticateJWT, async (req, res) => {
    const { conversationId } = req.params;
    const { subject, content, attachment_urls, reply_to_message_id, type } = req.body;
    const senderId = req.user.id;

    // Basic validation
    if (!content && (!attachment_urls || attachment_urls.length === 0)) {
        return res.status(400).json({ success: false, message: 'Message content or attachment URLs are required.' });
    }

    const connection = await pool.getConnection();
    try {
        // Verify user is a participant in the conversation
        const [participants] = await connection.query(
            "SELECT * FROM conversation_participants WHERE conversation_id = ? AND user_id = ? AND is_active = TRUE",
            [conversationId, senderId]
        );

        if (participants.length === 0) {
            return res.status(403).json({ success: false, message: 'You are not a participant in this conversation.' });
        }

        // Insert the message
        const [messageResult] = await connection.query(
            `INSERT INTO messages (conversation_id, sender_id, subject, content, attachment_urls, reply_to_message_id, type)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                conversationId,
                senderId,
                subject || null,
                content || '',
                (attachment_urls && Array.isArray(attachment_urls)) ? JSON.stringify(attachment_urls) : null,
                reply_to_message_id || null,
                type || 'text' // Default to 'text' if not specified
            ]
        );
        const messageId = messageResult.insertId;

        // Update last_message_at in conversations table
        await connection.query(
            "UPDATE conversations SET last_message_at = NOW() WHERE conversation_id = ?",
            [conversationId]
        );

        // In a real-time system, you would emit a WebSocket event here (e.g., using Socket.IO)
        // io.to(conversationId).emit('newMessage', { messageId, conversationId, senderId, content, ... });
        console.log(`Message sent in conversation ${conversationId} by user ${senderId}. Message ID: ${messageId}`);

        res.status(201).json({
            success: true,
            message: 'Message sent successfully.',
            messageData: {
                messageId,
                conversationId,
                senderId,
                subject,
                content,
                attachment_urls,
                reply_to_message_id,
                type,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, message: 'Failed to send message.' });
    } finally {
        connection.release();
    }
});

// 6. Mark Message as Read
app.put('/api/messages/:messageId/read', authenticateJWT, async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user.id;

    try {
        // Get conversation_id from message_id
        const [messageRows] = await pool.query("SELECT conversation_id FROM messages WHERE message_id = ?", [messageId]);
        if (messageRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Message not found.' });
        }
        const conversationId = messageRows[0].conversation_id;

        // Update last_read_message_id for the user in that conversation
        // Only update if the new messageId is greater than the current last_read_message_id
        const [updateResult] = await pool.query(
            "UPDATE conversation_participants SET last_read_message_id = ? WHERE conversation_id = ? AND user_id = ? AND (last_read_message_id IS NULL OR last_read_message_id < ?)",
            [messageId, conversationId, userId, messageId]
        );

        if (updateResult.affectedRows === 0) {
            // This could mean the message was already read, or the user is not a participant
            return res.status(400).json({ success: false, message: 'Message already marked as read or user not participant.' });
        }

        // In a real-time system, you might emit a WebSocket event to update sender's UI
        // io.to(conversationId).emit('messageRead', { messageId, readerId: userId });

        res.json({ success: true, message: 'Message marked as read.' });

    } catch (error) {
        console.error('Error marking message as read:', error);
        res.status(500).json({ success: false, message: 'Failed to mark message as read.' });
    }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Welcome page: http://localhost:${PORT}/welcome`);
  console.log(`Admin Portals Welcome: http://localhost:${PORT}/welcome-admin-portals`);
  console.log(`Student Signup: http://localhost:${PORT}/signup-student`);
  console.log(`Student Login: http://localhost:${PORT}/login-student`);
  console.log(`Admin Signup: http://localhost:${PORT}/signup-admin`);
  console.log(`Admin Login: http://localhost:${PORT}/login-admin`);
  console.log(`Departments Directory: http://localhost:${PORT}/departments-directory`);
  console.log(`Events Directory: http://localhost:${PORT}/events-directory`);
  console.log(`Interactive Calendar: http://localhost:${PORT}/interactive-calendar`);
  console.log(`API for External Events (test): http://localhost:${PORT}/api/external-events?page=1&location=Nairobi&q=tech`);
});
