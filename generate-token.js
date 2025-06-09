
const jwt = require('jsonwebtoken');


const secret = 'your_jwt_secret_here';

// Payload (data to embed in token)
const payload = {
  email: 'test@example.com',
  role: 'student'
};

// Token options
const options = {
  expiresIn: '2h'
};

// Generate token
const token = jwt.sign(payload, secret, options);
console.log('Generated Token:', token);
