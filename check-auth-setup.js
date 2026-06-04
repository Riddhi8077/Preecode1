#!/usr/bin/env node
/**
 * Auth Setup Checker
 * Verifies JWT configuration and helps debug "token invalid" errors
 * 
 * Usage: node check-auth-setup.js
 */

require('dotenv').config({ path: './preecode-backend/.env' });

console.log('🔍 Checking Preecode Authentication Setup...\n');

// Check 1: JWT_SECRET
console.log('1. JWT_SECRET Configuration:');
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  console.log('   ❌ JWT_SECRET is NOT set in .env file');
  console.log('   ⚠️  This will cause all authentication to fail!');
  console.log('   💡 Fix: Add JWT_SECRET to preecode-backend/.env');
  console.log('   Example: JWT_SECRET=your_very_long_random_secret_here\n');
} else {
  console.log('   ✅ JWT_SECRET is set');
  console.log('   Length:', jwtSecret.length, 'characters');
  
  if (jwtSecret.length < 32) {
    console.log('   ⚠️  JWT_SECRET is too short (should be at least 32 characters)');
  } else if (jwtSecret.length < 64) {
    console.log('   ⚠️  JWT_SECRET is short (recommended: 64+ characters)');
  } else {
    console.log('   ✅ JWT_SECRET length is good');
  }
  
  // Check if it's the default weak secret
  if (jwtSecret === 'some_long_random_string' || jwtSecret.includes('your_secret')) {
    console.log('   ⚠️  JWT_SECRET appears to be a default/example value');
    console.log('   💡 Generate a strong secret: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  }
  console.log();
}

// Check 2: MongoDB Connection
console.log('2. MongoDB Configuration:');
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.log('   ❌ MONGO_URI is NOT set');
  console.log('   ⚠️  Database connection will fail!');
} else {
  console.log('   ✅ MONGO_URI is set');
  // Hide password in output
  const sanitized = mongoUri.replace(/:[^:@]+@/, ':****@');
  console.log('   URI:', sanitized);
}
console.log();

// Check 3: OpenRouter API
console.log('3. OpenRouter API Configuration:');
const openrouterKey = process.env.OPENROUTER_API_KEY;
if (!openrouterKey) {
  console.log('   ❌ OPENROUTER_API_KEY is NOT set');
  console.log('   ⚠️  AI features will not work!');
} else {
  const keys = openrouterKey.split(',').map(k => k.trim()).filter(k => k.length > 0);
  console.log('   ✅ OPENROUTER_API_KEY is set');
  console.log('   Number of keys:', keys.length);
  if (keys.length > 1) {
    console.log('   ✅ Multiple keys configured for rotation');
  }
}
console.log();

// Check 4: Backend URL
console.log('4. Backend URL Configuration:');
const backendUrl = process.env.BACKEND_URL;
if (!backendUrl) {
  console.log('   ⚠️  BACKEND_URL is not set (will use default)');
} else {
  console.log('   ✅ BACKEND_URL is set:', backendUrl);
}
console.log();

// Summary
console.log('═'.repeat(60));
console.log('📋 SUMMARY\n');

const issues = [];
if (!jwtSecret) issues.push('JWT_SECRET missing');
if (jwtSecret && jwtSecret.length < 32) issues.push('JWT_SECRET too short');
if (!mongoUri) issues.push('MONGO_URI missing');
if (!openrouterKey) issues.push('OPENROUTER_API_KEY missing');

if (issues.length === 0) {
  console.log('✅ All critical configuration looks good!');
  console.log('\nIf you\'re still getting "token invalid" errors:');
  console.log('1. Check if JWT_SECRET was recently changed');
  console.log('2. Ask users to clear localStorage and re-login');
  console.log('3. Check backend logs for detailed error messages');
  console.log('4. Verify MongoDB is accessible');
} else {
  console.log('❌ Found', issues.length, 'issue(s):');
  issues.forEach((issue, i) => {
    console.log(`   ${i + 1}. ${issue}`);
  });
  console.log('\n💡 Fix these issues in preecode-backend/.env');
}

console.log('\n═'.repeat(60));
console.log('\n📚 For more help, see: FIX_TOKEN_INVALID_ERROR.md\n');
