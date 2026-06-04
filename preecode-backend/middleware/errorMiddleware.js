// Centralized error handler
module.exports = (err, req, res, next) => {
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ message: 'Invalid token.' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'Token expired.' });
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: err.message });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    return res.status(409).json({ message: 'Duplicate field value.' });
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(400).json({ message: 'Invalid ID format.' });
  }

  const statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  res.status(statusCode);
  res.json({
    message: err.message || 'Server Error',
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};
