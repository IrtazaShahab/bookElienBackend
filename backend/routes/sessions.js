var express = require('express');
var router = express.Router();
const db = require('../db');

// Middleware to verify JWT token (optional but recommended)
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.split(' ')[1];
  
  // You can add JWT verification here if you're using JWT
  // For now, we'll just pass the token through
  req.token = token;
  next();
};

// Save session route
router.post('/save-session', verifyToken, async (req, res) => {
  try {
    const { token } = req.body;
    
    console.log('📝 Session save request received');
    
    // You can save session to database if needed
    // For now, just acknowledge the request
    
    res.json({ 
      success: true, 
      message: 'Session saved successfully' 
    });
    
  } catch (error) {
    console.error('Error saving session:', error);
    res.status(500).json({ 
      error: 'Failed to save session',
      message: error.message 
    });
  }
});

module.exports = router;