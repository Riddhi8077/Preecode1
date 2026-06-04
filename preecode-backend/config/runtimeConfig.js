function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

function readRequiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`[config] Missing required environment variable: ${name}`);
  }
  return value;
}

function readOptionalUrlEnv(name) {
  const value = String(process.env[name] || '').trim();
  return value ? normalizeBaseUrl(value) : '';
}

// Keep auth/runtime URLs env-driven so extension and backend do not silently drift.
const backendUrl = readOptionalUrlEnv('BACKEND_URL');
const frontendUrl = normalizeBaseUrl(readRequiredEnv('FRONTEND_URL'));
const frontendDevUrl = readOptionalUrlEnv('FRONTEND_DEV_URL');
const googleCallbackUrl = readOptionalUrlEnv('GOOGLE_CALLBACK_URL') || (
  backendUrl ? `${backendUrl}/api/auth/google/callback` : ''
);

if (!googleCallbackUrl) {
  throw new Error('[config] GOOGLE_CALLBACK_URL or BACKEND_URL must be configured for Google OAuth');
}

module.exports = {
  backendUrl,
  frontendUrl,
  frontendDevUrl,
  googleCallbackUrl,
  jwtSecret: readRequiredEnv('JWT_SECRET'),
  googleClientId: readRequiredEnv('GOOGLE_CLIENT_ID'),
  googleClientSecret: readRequiredEnv('GOOGLE_CLIENT_SECRET'),
};
