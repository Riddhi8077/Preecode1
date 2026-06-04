const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { frontendUrl, jwtSecret } = require('../config/runtimeConfig');

const router = express.Router();

// In-memory store for OAuth redirects (cleaned up after 15 minutes)
const pendingOAuthRedirects = new Map();

function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderVsCodeSuccessPage(res, vscodeUri) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  // HTML meta refresh for reliable vscode:// redirect
  const safeUri = String(vscodeUri)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta http-equiv="refresh" content="0;url=${safeUri}" />
  <title>Preecode Login Success</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0b0f14;
      --panel: #111827;
      --text: #d1d5db;
      --muted: #9ca3af;
      --success: #4ade80;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: radial-gradient(circle at top, #172554 0%, var(--bg) 45%);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
    }
    .card {
      width: 100%;
      max-width: 520px;
      background: var(--panel);
      border: 1px solid #22c55e;
      border-radius: 14px;
      padding: 32px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.35);
      text-align: center;
    }
    .checkmark {
      width: 64px;
      height: 64px;
      margin: 0 auto 16px;
      background: rgba(74, 222, 128, 0.1);
      border: 2px solid var(--success);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
    }
    h2 {
      margin: 0 0 8px;
      font-size: 24px;
      color: var(--success);
      font-weight: 600;
    }
    p {
      margin: 8px 0;
      color: var(--muted);
      line-height: 1.6;
      font-size: 14px;
    }
    .fallback {
      margin-top: 24px;
    }
    .fallback p {
      margin: 0;
      font-size: 13px;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="checkmark">✓</div>
    <h2>Successfully signed in!</h2>
    <p>Opening VS Code extension...</p>

    <div class="fallback">
      <p>If VS Code did not open, you can: open VS Code manually</p>
    </div>
  </main>
</body>
</html>`);
}

router.get('/redirect-complete', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Preecode Login Complete</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0b0f14;
      --panel: #111827;
      --text: #d1d5db;
      --muted: #9ca3af;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: radial-gradient(circle at top, #172554 0%, var(--bg) 45%);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
    }
    .card {
      width: 100%;
      max-width: 560px;
      background: var(--panel);
      border: 1px solid #1f2937;
      border-radius: 14px;
      padding: 22px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.35);
    }
    h2 { margin: 0 0 8px; font-size: 22px; color: var(--text); }
    p { margin: 0; color: var(--muted); line-height: 1.6; }
  </style>
</head>
<body>
  <main class="card">
    <h2>Login complete</h2>
    <p>If Visual Studio Code is not opened automatically, you can open manually.</p>
  </main>
</body>
</html>`);
});

/* ================= GOOGLE OAUTH START ================= */

router.get('/google', (req, res, next) => {
  // Accept an optional `redirect` query param (e.g. vscode://...)
  if (req.query && req.query.redirect) {
    try {
      // Generate unique ID for this OAuth attempt
      const oauthStateId = Math.random().toString(36).substring(2, 15) +
                           Math.random().toString(36).substring(2, 15);

      console.log('[auth] /google received redirect:', req.query.redirect, 'stateId:', oauthStateId);

      // Store the redirect in memory (will be retrieved in callback)
      pendingOAuthRedirects.set(oauthStateId, req.query.redirect);

      // Clean up after 15 minutes
      setTimeout(() => {
        pendingOAuthRedirects.delete(oauthStateId);
      }, 15 * 60 * 1000);

      // Store state ID in cookie so we can retrieve it in callback
      res.cookie('oauth_state_id', oauthStateId, {
        maxAge: 15 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
    } catch (e) {
      console.warn('[auth] /google failed to store redirect:', e && e.message);
    }
  }

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })(req, res, next);
});

/* ================= GOOGLE OAUTH CALLBACK ================= */

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${frontendUrl}/auth/callback.html?error=oauth_failed`,
  }),
  (req, res) => {
    console.log('[auth] Google callback hit for user:', req.user && req.user._id);
    const token = jwt.sign(
      { id: req.user._id, tokenVersion: req.user.tokenVersion || 0 },
      jwtSecret,
      { expiresIn: '7d' }
    );
    console.log('[auth] Generated JWT for user:', req.user && req.user._id);

    // Get redirect from in-memory store using state ID from cookie
    let originalRedirect = null;
    const stateId = req.cookies?.oauth_state_id;
    if (stateId && pendingOAuthRedirects.has(stateId)) {
      originalRedirect = pendingOAuthRedirects.get(stateId);
      pendingOAuthRedirects.delete(stateId);
      res.clearCookie('oauth_state_id');
      console.log('[auth] Retrieved redirect from in-memory store:', originalRedirect);
    }

    // VS Code auth flow: show success page and open VS Code
    if (originalRedirect && originalRedirect.toLowerCase().startsWith('vscode://')) {
      const sep = originalRedirect.indexOf('?') === -1 ? '?' : '&';
      const vscodeUri = `${originalRedirect}${sep}token=${encodeURIComponent(token)}`;
      console.log('[auth] Opening VS Code with success page:', vscodeUri);
      return renderVsCodeSuccessPage(res, vscodeUri);
    }

    // For web logins, redirect to frontend callback page
    if (originalRedirect) {
      return res.redirect(`${frontendUrl}/auth/callback.html?token=${token}&redirect=${encodeURIComponent(originalRedirect)}`);
    }

    res.redirect(`${frontendUrl}/auth/callback.html?token=${token}`);
  }
);

/* ================= DEV LOGIN (Optional) ================= */

router.get('/dev-login', async (req, res) => {
  const User = require('../models/User');
  const user = await User.findOne();

  if (!user) {
    return res.json({ error: "No user exists in DB" });
  }

  const token = jwt.sign(
    { id: user._id, tokenVersion: user.tokenVersion || 0 },
    jwtSecret,
    { expiresIn: '7d' }
  );

  res.json({ token });
});

// Debug helper: visit /api/auth/debug?redirect=vscode://...&token=XYZ to render
// a page with a clickable link that opens the deep link. Useful to test
// whether the browser/OS will allow opening VS Code from the site.
router.get('/debug', (req, res) => {
  const redirect = req.query.redirect || '';
  const token = req.query.token || 'TEST_TOKEN';
  let decoded = redirect;
  try {
    decoded = decodeURIComponent(String(redirect));
  } catch (e) {
    decoded = String(redirect);
  }
  const sep = decoded.indexOf('?') === -1 ? '?' : '&';
  const deepLink = decoded ? `${decoded}${sep}token=${encodeURIComponent(String(token))}` : '';

  res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Auth Debug</title></head><body style="background:#0B0F14;color:#fff;font-family:Inter,Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center;max-width:720px;padding:24px"><h2>Auth Debug</h2><p>Click the button below to attempt opening VS Code via the deep link.</p>${deepLink ? `<p><a id="open" href="${deepLink}" style="display:inline-block;padding:12px 18px;background:#ffa116;color:#081018;border-radius:8px;text-decoration:none">Open VS Code</a></p><p style="color:#9ca3af">If nothing happens, your browser may be blocking custom-scheme navigation. Try another browser or copy the link and run <code>open '${deepLink}'</code> in a terminal.</p>` : '<p style="color:#f88">No redirect provided. Use ?redirect=vscode://preecode.preecode/auth</p>'}</div></body></html>`);
});

module.exports = router;
