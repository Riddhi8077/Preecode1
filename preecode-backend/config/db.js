const mongoose = require('mongoose');

const validateMongoURI = (uri) => {
  if (!uri) {
    console.error('MONGO_URI is not defined in .env');
    console.error('  → Create a .env file in the project root with:');
    console.error('    MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname');
    process.exit(1);
  }

  // Detect accidental whitespace or line breaks
  const trimmed = uri.trim();
  if (trimmed !== uri) {
    console.warn('WARNING: MONGO_URI contains leading/trailing whitespace — auto-trimmed');
  }
  if (/[\r\n]/.test(trimmed)) {
    console.error('MONGO_URI contains line breaks — fix your .env file');
    process.exit(1);
  }

  // Validate URI format
  if (!trimmed.startsWith('mongodb://') && !trimmed.startsWith('mongodb+srv://')) {
    console.error('MONGO_URI must start with mongodb:// or mongodb+srv://');
    process.exit(1);
  }

  // Check for database name in URI
  const dbMatch = trimmed.match(/\.mongodb\.net\/([^?]*)/);
  if (dbMatch && !dbMatch[1]) {
    console.warn('WARNING: No database name specified in MONGO_URI — MongoDB will use "test" by default');
  }

  // Detect special characters in password that need URL-encoding
  const credMatch = trimmed.match(/:\/\/([^:]+):([^@]+)@/);
  if (credMatch) {
    const password = credMatch[2];
    if (/[%@:\/\?#\[\]]/.test(password) && !/%[0-9A-Fa-f]{2}/.test(password)) {
      console.error('MONGO_URI password contains special characters that require URL-encoding');
      console.error('  → Use encodeURIComponent() on your password, or encode manually:');
      console.error('    @ → %40   : → %3A   / → %2F   ? → %3F   # → %23');
      process.exit(1);
    }
  }

  return trimmed;
};

const classifyError = (error) => {
  const msg = error.message || '';
  const code = error.code || error.codeName || '';

  if (msg.includes('bad auth') || msg.includes('Authentication failed') || code === 'AtlasError') {
    return {
      type: 'AUTHENTICATION',
      advice: [
        'Verify username/password in MongoDB Atlas → Database Access',
        'Confirm the user has readWrite permissions on the target database',
        'Check that the password in .env matches Atlas exactly',
        'If password has special chars (@, :, /, etc.), URL-encode them',
      ],
    };
  }

  if (msg.includes('ENOTFOUND') || msg.includes('querySrv') || msg.includes('getaddrinfo')) {
    return {
      type: 'DNS',
      advice: [
        'Cluster hostname could not be resolved',
        'Check your internet connection',
        'Verify the cluster URL in MONGO_URI is correct',
        'If behind a corporate proxy/VPN, DNS may be blocked',
      ],
    };
  }

  if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('connect EHOSTUNREACH')) {
    return {
      type: 'NETWORK',
      advice: [
        'MongoDB server is unreachable',
        'Whitelist your current IP in Atlas → Network Access',
        'Check firewall/VPN settings',
        'Run: curl -v cluster0.1tqpnn4.mongodb.net to test connectivity',
      ],
    };
  }

  return {
    type: 'UNKNOWN',
    advice: [`Unclassified error: ${msg}`, 'Check MongoDB Atlas dashboard for cluster status'],
  };
};

const connectDB = async () => {
  const uri = validateMongoURI(process.env.MONGO_URI);

  try {
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);
  } catch (error) {
    const diagnosis = classifyError(error);
    console.error(`\nMONGODB CONNECTION FAILED [${diagnosis.type}]`);
    console.error(`Error: ${error.message}\n`);
    console.error('Possible fixes:');
    diagnosis.advice.forEach((tip) => console.error(`  → ${tip}`));
    console.error('');
    process.exit(1);
  }
};

module.exports = connectDB;
