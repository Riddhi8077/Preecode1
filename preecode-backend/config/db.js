const mongoose = require('mongoose');

const validateMongoURI = (uri) => {
  // Don't crash synchronously - return error details instead
  const errors = [];

  if (!uri) {
    errors.push('MONGO_URI is not defined in .env');
  } else {
    // Detect accidental whitespace or line breaks
    const trimmed = uri.trim();
    if (trimmed !== uri) {
      console.warn('⚠️  WARNING: MONGO_URI contains leading/trailing whitespace — auto-trimmed');
    }
    if (/[\r\n]/.test(trimmed)) {
      errors.push('MONGO_URI contains line breaks');
    }

    // Validate URI format
    if (!trimmed.startsWith('mongodb://') && !trimmed.startsWith('mongodb+srv://')) {
      errors.push('MONGO_URI must start with mongodb:// or mongodb+srv://');
    }

    // Check for database name in URI
    const dbMatch = trimmed.match(/\.mongodb\.net\/([^?]*)/);
    if (dbMatch && !dbMatch[1]) {
      console.warn('⚠️  WARNING: No database name specified in MONGO_URI — MongoDB will use "test" by default');
    }

    // Detect special characters in password that need URL-encoding
    const credMatch = trimmed.match(/:\/\/([^:]+):([^@]+)@/);
    if (credMatch) {
      const password = credMatch[2];
      if (/[%@:\/\?#\[\]]/.test(password) && !/%[0-9A-Fa-f]{2}/.test(password)) {
        errors.push('MONGO_URI password contains unencoded special characters');
      }
    }

    if (errors.length === 0) {
      return { valid: true, uri: trimmed };
    }
  }

  return { valid: false, errors };
};

const classifyError = (error) => {
  const msg = error.message || '';
  const code = error.code || error.codeName || '';

  if (msg.includes('bad auth') || msg.includes('Authentication failed') || code === 'AtlasError') {
    return {
      type: 'AUTHENTICATION',
      advice: [
        '🔐 Verify username/password in MongoDB Atlas → Database Access',
        '👤 Confirm the user has readWrite permissions on the target database',
        '✔️  Check that the password in .env matches Atlas exactly',
        '🔤 If password has special chars (@, :, /, etc.), URL-encode them',
      ],
    };
  }

  if (msg.includes('ENOTFOUND') || msg.includes('querySrv') || msg.includes('getaddrinfo')) {
    return {
      type: 'DNS',
      advice: [
        '🌐 Cluster hostname could not be resolved',
        '🔗 Check your internet connection',
        '⚙️  Verify the cluster URL in MONGO_URI is correct',
        '🛡️  If behind a corporate proxy/VPN, DNS may be blocked',
      ],
    };
  }

  if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('connect EHOSTUNREACH')) {
    return {
      type: 'NETWORK',
      advice: [
        '🚫 MongoDB server is unreachable',
        '🔐 Whitelist your current IP in Atlas → Network Access',
        '🔥 Check firewall/VPN settings',
        '🧪 Run: curl -v cluster0.mongodb.net to test connectivity',
      ],
    };
  }

  return {
    type: 'UNKNOWN',
    advice: [`❓ Unclassified error: ${msg}`, '📊 Check MongoDB Atlas dashboard for cluster status'],
  };
};

const connectDB = async () => {
  // Validate URI safely - don't crash synchronously
  const validation = validateMongoURI(process.env.MONGO_URI);

  if (!validation.valid) {
    const errorMsg = validation.errors.join('; ');
    throw new Error(`MongoDB URI validation failed: ${errorMsg}`);
  }

  try {
    const conn = await mongoose.connect(validation.uri);
    console.log(`✅ MongoDB Connected`);
    console.log(`   Host: ${conn.connection.host}`);
    console.log(`   Database: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    const diagnosis = classifyError(error);
    console.error(`\n❌ MONGODB CONNECTION FAILED [${diagnosis.type}]`);
    console.error(`   Error: ${error.message}\n`);
    console.error('   Troubleshooting:');
    diagnosis.advice.forEach((tip) => console.error(`     → ${tip}`));
    console.error('');
    throw error; // Re-throw so server.js can handle it
  }
};

module.exports = connectDB;
