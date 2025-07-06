const jwt = require('jsonwebtoken');
const secret = process.env.JWT_SECRET;

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

module.exports = { authenticateJWT };