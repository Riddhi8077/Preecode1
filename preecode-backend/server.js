// Preecode Backend Server - Enhanced with OpenRouter AI Integration
// Load environment variables first
require('dotenv').config();

// =============== GLOBAL ERROR HANDLERS (BEFORE ANYTHING ELSE) ===============

process.on('uncaughtException', (err) => {
  console.error('\n❌ UNCAUGHT EXCEPTION:');
  console.error(`   ${err.name}: ${err.message}`);
  console.error(err.stack);
  console.error('Shutting down gracefully...\n');
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('\n❌ UNHANDLED REJECTION:');
  console.error(`   ${err?.name || 'Error'}: ${err?.message || String(err)}`);
  console.error(err?.stack || '');
  console.error('Shutting down gracefully...\n');
  process.exit(1);
});

// =============== IMPORTS ===============

console.log('[startup] Loading dependencies...');

const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

// Safe require with fallback
const loadModule = (path, name) => {
  try {
    return require(path);
  } catch (err) {
    console.error(`❌ Failed to load ${name}:`, err.message);
    throw err;
  }
};

const passport = loadModule('./config/passport', 'Passport');
const connectDB = loadModule('./config/db', 'Database');
const errorHandler = loadModule('./middleware/errorMiddleware', 'Error Handler');

console.log('[startup] Loading routes...');
const authRoutes = loadModule('./routes/authRoutes', 'Auth Routes');
const userRoutes = loadModule('./routes/userRoutes', 'User Routes');
const submissionRoutes = loadModule('./routes/submissionRoutes', 'Submission Routes');
const practiceRoutes = loadModule('./routes/practiceRoutes', 'Practice Routes');
const aiRoutes = loadModule('./routes/aiRoutes', 'AI Routes');
const earlyAccessRoutes = loadModule('./routes/earlyAccessRoutes', 'Early Access Routes');
const uploadRoutes = loadModule('./routes/uploadRoutes', 'Upload Routes');
const githubAuthRoutes = loadModule('./routes/githubAuthRoutes', 'GitHub Auth Routes');

console.log('[startup] All modules loaded successfully\n');

// =============== ENVIRONMENT VARIABLE VALIDATION ===============

const checkEnvVars = () => {
  console.log('📋 Environment Variables Check:');

  const envVars = {
    'NODE_ENV': process.env.NODE_ENV || 'development',
    'PORT': process.env.PORT || '5001',
    'MONGO_URI': !!process.env.MONGO_URI ? '✓ SET' : '✗ MISSING',
    'JWT_SECRET': !!process.env.JWT_SECRET ? '✓ SET' : '✗ MISSING',
    'FRONTEND_URL': process.env.FRONTEND_URL || 'http://localhost:3000',
    'BACKEND_URL': process.env.BACKEND_URL || 'http://localhost:5001',
    'GITHUB_CLIENT_ID': !!process.env.GITHUB_CLIENT_ID ? '✓ SET' : '⚠ MISSING',
    'GITHUB_CLIENT_SECRET': !!process.env.GITHUB_CLIENT_SECRET ? '✓ SET' : '⚠ MISSING',
    'GOOGLE_CLIENT_ID': !!process.env.GOOGLE_CLIENT_ID ? '✓ SET' : '⚠ MISSING',
    'GOOGLE_CLIENT_SECRET': !!process.env.GOOGLE_CLIENT_SECRET ? '✓ SET' : '⚠ MISSING',
    'GOOGLE_CALLBACK_URL': process.env.GOOGLE_CALLBACK_URL || 'auto',
    'OPENROUTER_API_KEY': !!process.env.OPENROUTER_API_KEY ? '✓ SET' : '⚠ MISSING',
    'SENDGRID_API_KEY': !!process.env.SENDGRID_API_KEY ? '✓ SET' : '⚠ MISSING',
    'CLOUDINARY_CLOUD_NAME': !!process.env.CLOUDINARY_CLOUD_NAME ? '✓ SET' : '⚠ MISSING',
  };

  Object.entries(envVars).forEach(([key, value]) => {
    const prefix = typeof value === 'string' && value.includes('✗') ? '❌' :
                   typeof value === 'string' && value.includes('✓') ? '✅' :
                   typeof value === 'string' && value.includes('⚠') ? '⚠️ ' : ' ➜';
    console.log(`   ${prefix} ${key}: ${value}`);
  });

  // Check critical variables
  const critical = ['MONGO_URI', 'JWT_SECRET'];
  const missing = critical.filter(v => !process.env[v]);

  if (missing.length > 0) {
    console.error(`\n❌ CRITICAL: Missing required variables: ${missing.join(', ')}`);
    return false;
  }

  console.log('');
  return true;
};

// =============== EXPRESS APP SETUP ===============

const app = express();

console.log('[startup] Setting up Express middleware...');

// Security
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
  skip: (req) => req.path.startsWith('/api/auth'),
});
app.use(limiter);

// CORS
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_DEV_URL || 'http://localhost:5173',
  process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    console.warn('[cors] Blocked request from origin:', origin);
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Length', 'X-JSON-Response'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Body parsing & cookies
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());
app.use(passport.initialize());

// =============== ROUTES ===============

console.log('[startup] Registering routes...');

// Health check
app.get('/', (req, res) => {
  res.send('Preecode backend running');
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/auth/github', githubAuthRoutes);
app.use('/api/users', userRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/early-access', earlyAccessRoutes);
app.use('/api/upload', uploadRoutes);

// Global error handler (must be last)
app.use(errorHandler);

console.log('[startup] Routes registered\n');

// =============== SERVER START ===============

function listenOnAvailablePort(preferredPort, options = {}) {
  const {
    maxAttempts = 10,
    allowFallback = false,
  } = options;

  return new Promise((resolve, reject) => {
    let attempts = 0;
    let activeServer;

    const tryListen = (port) => {
      attempts += 1;
      activeServer = http.createServer(app);

      activeServer.once('error', (error) => {
        if (error.code === 'EADDRINUSE' && allowFallback && attempts < maxAttempts) {
          console.warn(`[startup] Port ${port} is already in use, trying ${port + 1}...`);
          return tryListen(port + 1);
        }
        reject(error);
      });

      activeServer.once('listening', () => resolve({ server: activeServer, port }));
      activeServer.listen(port);
    };

    tryListen(preferredPort);
  });
}

const startServer = async () => {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log('🚀 PREECODE BACKEND STARTUP');
    console.log(`${'='.repeat(60)}\n`);

    // Check environment variables
    if (!checkEnvVars()) {
      console.error('❌ Cannot start server with critical env vars missing');
      process.exit(1);
    }

    const NODE_ENV = process.env.NODE_ENV || 'development';

    console.log('[startup] Connecting to MongoDB...');
    await connectDB();
    console.log('[startup] ✅ MongoDB connected\n');

    const preferredPort = Number(process.env.PORT) || 5001;
    const allowFallback = process.env.NODE_ENV !== 'production';

    const { server, port } = await listenOnAvailablePort(preferredPort, {
      allowFallback,
    });

    console.log('\n✅ SERVER STARTED SUCCESSFULLY');
    console.log(`${'='.repeat(60)}`);
    console.log(`📍 Environment: ${NODE_ENV}`);
    console.log(`🔌 Port: ${port}`);
    console.log(`🌐 Frontend: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
    console.log(`⚙️  Backend: ${process.env.BACKEND_URL || `http://localhost:${port}`}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📡 API: http://localhost:${port}/api`);
    console.log(`🏥 Health: GET http://localhost:${port}/api/health`);
    console.log(`🔐 Auth: GET http://localhost:${port}/api/auth/google`);
    console.log(`${'='.repeat(60)}\n`);

    server.on('error', (err) => {
      console.error('\n❌ Server error:', err.message);
      process.exit(1);
    });

  } catch (err) {
    console.error('\n❌ FAILED TO START SERVER');
    console.error(`\n   Error: ${err.name}`);
    console.error(`   Message: ${err.message}\n`);
    if (process.env.NODE_ENV !== 'production') {
      console.error('   Stack:');
      console.error(err.stack);
    }
    console.error('\n   Troubleshooting:');
    console.error('   1. Check all environment variables are set');
    console.error('   2. Verify MongoDB connection string is correct');
    console.error('   3. Check network connectivity');
    console.error('   4. Review logs above for specific errors\n');
    process.exit(1);
  }
};

// Start the server
startServer();
