const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies (for API requests)
app.use(express.json());
// Middleware to parse URL-encoded bodies (if you were using traditional form posts)
// app.use(express.urlencoded({ extended: true }));

// Middleware to serve static files (CSS, JS, images)
// If you create a 'public' folder for these, uncomment the line below:
// app.use(express.static(path.join(__dirname, 'public')));

// Route to serve the Signup page
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'Signup.html'));
});

// Route to serve the Login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Optional: A root route, e.g., redirect to signup or login
app.get('/', (req, res) => {
    res.redirect('/signup'); // Or '/login' or serve an index.html
});

// --- API Routes for Form Submissions ---

// API endpoint for Signup
app.post('/api/signup', (req, res) => {
    console.log('Signup attempt received on server:');
    console.log('Body:', req.body);
    const { fullName, email, password, confirmPassword, role, ...roleSpecificData } = req.body;

    // Basic validation (you'll need more robust validation)
    if (!fullName || !email || !password || !role) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }
    if (password !== confirmPassword) {
        return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    // TODO:
    // 1. More comprehensive validation (email format, password strength).
    // 2. Check if user (email) already exists in your database.
    // 3. Hash the password securely (e.g., using bcrypt).
    // 4. Save the new user to your database.
    // 5. Potentially send a verification email.

    console.log(`Registering user: ${fullName}, Email: ${email}, Role: ${role}`);
    console.log('Role specific data:', roleSpecificData);

    // For now, send a mock success response
    res.json({
        success: true,
        message: `Server: ${role} account for ${fullName} creation initiated. Implement full DB logic.`
    });
});

// API endpoint for Login
app.post('/api/login', (req, res) => {
    console.log('Login attempt received on server:');
    console.log('Body:', req.body);
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
        return res.status(400).json({ success: false, message: 'Email, password, and role are required.' });
    }

    // TODO:
    // 1. Find user by email and role in your database.
    // 2. Compare the provided password with the stored hashed password.
    // 3. If match, create a session or JWT token.

    console.log(`Authenticating user: Email: ${email}, Role: ${role}`);

    // Mock successful login response
    // In a real app, you'd fetch user details from DB
    if (email && password) { // Replace with actual DB check
        res.json({
            success: true,
            message: 'Server: Login successful (mock response). Implement full DB logic.',
            user: { // Send some mock user data back
                fullName: 'Mock User ' + role,
                email: email,
                role: role
            }
        });
    } else {
        res.status(401).json({ success: false, message: 'Server: Invalid credentials (mock response).' });
    }
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Access Signup page: http://localhost:${PORT}/signup`);
    console.log(`Access Login page: http://localhost:${PORT}/login`);
});
