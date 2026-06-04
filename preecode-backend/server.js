// Load environment variables first
require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const passport = require('./config/passport');
const connectDB = require('./config/db');
const { frontendUrl, frontendDevUrl } = require('./config/runtimeConfig');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const practiceRoutes = require('./routes/practiceRoutes');
const aiRoutes = require('./routes/aiRoutes');
const earlyAccessRoutes = require('./routes/earlyAccessRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const githubAuthRoutes = require('./routes/githubAuthRoutes');
const memoryRoutes = require('./routes/memoryRoutes');

const errorHandler = require('./middleware/errorMiddleware');

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION — shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

const app = express();

// Request logger for debugging in production
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} from ${req.ip} origin=${req.headers.origin || 'none'}`);
  next();
});

/* ================= SECURITY ================= */

app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
  skip: (req) => req.path.startsWith('/api/auth'),
});

app.use(limiter);

/* ================= CORS ================= */

// CORS: allow only configured frontend origins (echo back origin when matched)
const allowedOrigins = [
  frontendUrl,
  frontendDevUrl,
  process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // allow requests with no origin (like server-to-server, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    console.warn('Blocked CORS request from origin:', origin);
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Length', 'X-JSON-Response'],
};

// Enable CORS for all routes with the options and handle preflight
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Root route to avoid confusing "Not Found" when someone lands on the service root
app.get('/', (req, res) => {
  res.send('Preecode backend running');
});

/* ================= MIDDLEWARE ================= */

app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());
app.use(passport.initialize());

/* ================= ROUTES ================= */

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'OK',
    environment: process.env.NODE_ENV,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/early-access', earlyAccessRoutes);
app.use('/api/upload', uploadRoutes);

/* ================= ERROR HANDLER ================= */

app.use(errorHandler);

/* ================= SERVER START ================= */

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
  await connectDB();

  const preferredPort = Number(process.env.PORT) || 5001;
  const allowFallback = process.env.NODE_ENV !== 'production';

  const { server, port } = await listenOnAvailablePort(preferredPort, {
    allowFallback,
  });

  console.log(`Server running on port ${port}`);

  process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION — shutting down...');
    console.error(err.name, err.message);
    server.close(() => process.exit(1));
  });
};

startServer();
