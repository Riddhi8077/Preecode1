const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    console.log('[auth] No token provided in request');
    return res.status(401).json({ message: 'Not authorized, no token.' });
  }

  try {
    const token = header.split(' ')[1];
    
    // Check if JWT_SECRET is set
    if (!process.env.JWT_SECRET) {
      console.error('[auth] JWT_SECRET is not set in environment variables!');
      return res.status(500).json({ message: 'Server configuration error.' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.user = await User.findById(decoded.id).select('-password -__v');
    if (!req.user) {
      console.log('[auth] User not found in database:', decoded.id);
      return res.status(401).json({ message: 'Not authorized, user not found.' });
    }
    
    const decodedVersion = Number(decoded.tokenVersion || 0);
    const currentVersion = Number(req.user.tokenVersion || 0);
    if (decodedVersion !== currentVersion) {
      console.log('[auth] Token version mismatch for user:', req.user._id, { decoded: decodedVersion, current: currentVersion });
      return res.status(401).json({ message: 'Not authorized, token expired.' });
    }
    
    next();
  } catch (error) {
    console.log('[auth] Token verification failed:', error.message);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Not authorized, token invalid.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Not authorized, token expired.' });
    }
    return res.status(401).json({ message: 'Not authorized, token invalid.' });
  }
};
