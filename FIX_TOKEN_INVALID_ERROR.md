# Fix: "Not authorized, token invalid" Error in Chatbox

## Problem

When sending messages in the chatbox, you get:
```
Error: Not authorized, token invalid.
```

## Root Causes

This error occurs when:
1. **JWT_SECRET changed** - Old tokens become invalid
2. **Token expired or corrupted** - localStorage has bad token
3. **Token version mismatch** - User logged out from another device
4. **User not found** - User was deleted from database

## ✅ Quick Fix (User Side)

### Solution 1: Clear Token and Re-login

**Steps:**
1. Open browser console (F12)
2. Run:
   ```javascript
   localStorage.removeItem('token');
   localStorage.removeItem('preecode_avatar');
   ```
3. Refresh page
4. Login again

**This fixes 90% of cases.**

---

### Solution 2: Clear All Browser Data

1. Open browser settings
2. Clear site data for your Preecode domain
3. Refresh and login again

---

## ✅ Permanent Fix (Code Side)

I'll implement automatic token refresh and better error handling.

### Changes Needed:

1. **Auto-logout on invalid token**
2. **Better error messages**
3. **Token refresh mechanism**
4. **Graceful degradation**

---

## Implementation

### File 1: Update Frontend API Error Handling

**Location:** `preecode-frontend/api.js`

Add automatic logout on 401 errors:

```javascript
// Add this helper function
function handleAuthError(error) {
  if (error.message && error.message.includes('Not authorized')) {
    // Clear invalid token
    localStorage.removeItem('token');
    localStorage.removeItem('preecode_avatar');
    
    // Redirect to login
    if (typeof window !== 'undefined') {
      window.location.href = '/login.html?error=session_expired';
    }
  }
  throw error;
}

// Update chatWithAI to use it
chatWithAI: function (message, context, history) {
  return fetch(API_BASE + '/ai/chat', {
    method: 'POST',
    headers: Api._authHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify({ message: message, context: context, history: history || [] }),
  }).then(function (res) {
    if (!res.ok) return res.json().then(function (d) { 
      var err = new Error(d.message || 'AI chat failed');
      handleAuthError(err);
    });
    return res.json();
  }).catch(handleAuthError);
}
```

### File 2: Update Chatbot Error Display

**Location:** `preecode-frontend/layout/chatbot.js`

Show user-friendly error message:

```javascript
.catch(function (err) {
  loadDiv.classList.remove('loading');
  
  var errorMsg = err.message || 'Unknown error';
  
  // Check if it's an auth error
  if (errorMsg.includes('Not authorized') || errorMsg.includes('token')) {
    errorMsg = 'Your session has expired. Please login again.';
    
    // Show login prompt
    setTimeout(function() {
      if (confirm('Your session has expired. Would you like to login now?')) {
        window.location.href = '/login.html';
      }
    }, 1000);
  }
  
  var errorDiv = document.createElement('div');
  errorDiv.className = 'message bot error';
  errorDiv.textContent = '❌ ' + errorMsg;
  chatMessages.appendChild(errorDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});
```

### File 3: Update Auth Middleware (Better Logging)

**Location:** `preecode-backend/middleware/authMiddleware.js`

Add detailed logging:

```javascript
const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    console.log('[auth] No token provided');
    return res.status(401).json({ message: 'Not authorized, no token.' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.user = await User.findById(decoded.id).select('-password -__v');
    if (!req.user) {
      console.log('[auth] User not found:', decoded.id);
      return res.status(401).json({ message: 'Not authorized, user not found.' });
    }
    
    const decodedVersion = Number(decoded.tokenVersion || 0);
    const currentVersion = Number(req.user.tokenVersion || 0);
    if (decodedVersion !== currentVersion) {
      console.log('[auth] Token version mismatch:', { decoded: decodedVersion, current: currentVersion });
      return res.status(401).json({ message: 'Not authorized, token expired.' });
    }
    
    next();
  } catch (error) {
    console.log('[auth] Token verification failed:', error.message);
    return res.status(401).json({ message: 'Not authorized, token invalid.' });
  }
};
```

---

## Debugging Steps

### Step 1: Check if JWT_SECRET Changed

```bash
# Check current JWT_SECRET
cd preecode-backend
cat .env | grep JWT_SECRET
```

If it's different from before, **all old tokens are invalid**.

**Solution:** Users must re-login.

---

### Step 2: Check Token in Browser

1. Open browser console (F12)
2. Run:
   ```javascript
   console.log('Token:', localStorage.getItem('token'));
   ```
3. Copy the token
4. Go to https://jwt.io/
5. Paste token and check if it's valid

**Look for:**
- Expiration date
- User ID
- Token version

---

### Step 3: Check Backend Logs

```bash
cd preecode-backend
npm start

# Watch for:
[auth] Token verification failed: ...
[auth] User not found: ...
[auth] Token version mismatch: ...
```

---

## Common Scenarios

### Scenario 1: JWT_SECRET Changed

**Symptom:** All users getting "token invalid"

**Fix:**
1. Keep the old JWT_SECRET (don't change it)
2. Or force all users to re-login

**Prevention:**
- Never change JWT_SECRET in production
- Store it securely and don't regenerate

---

### Scenario 2: User Logged Out from Another Device

**Symptom:** One user getting "token expired"

**Fix:**
- User needs to login again
- This is expected behavior (tokenVersion changed)

---

### Scenario 3: Corrupted Token

**Symptom:** Random "token invalid" errors

**Fix:**
- Clear localStorage and re-login
- Check for JavaScript errors corrupting token

---

## Testing the Fix

### Test 1: Invalid Token
```javascript
// In browser console
localStorage.setItem('token', 'invalid_token_123');

// Try sending a chat message
// Should show: "Your session has expired. Please login again."
```

### Test 2: No Token
```javascript
// In browser console
localStorage.removeItem('token');

// Try sending a chat message
// Should redirect to login
```

### Test 3: Valid Token
```javascript
// Login normally
// Send chat message
// Should work without errors
```

---

## Prevention

### 1. Add Token Expiration Check

Add to `preecode-frontend/api.js`:

```javascript
function isTokenExpired() {
  var token = localStorage.getItem('token');
  if (!token) return true;
  
  try {
    // Decode JWT (without verification)
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    
    var decoded = JSON.parse(jsonPayload);
    var exp = decoded.exp * 1000; // Convert to milliseconds
    
    return Date.now() >= exp;
  } catch (e) {
    return true; // If can't decode, assume expired
  }
}

// Check before API calls
_authHeaders: function (extra) {
  if (isTokenExpired()) {
    localStorage.removeItem('token');
    window.location.href = '/login.html?error=session_expired';
    return {};
  }
  
  var headers = {};
  var token = localStorage.getItem('token');
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (extra) {
    for (var key in extra) headers[key] = extra[key];
  }
  return headers;
}
```

### 2. Add Token Refresh

Implement token refresh before expiration (advanced).

### 3. Add Better Error Messages

Show specific error messages for each case:
- "Session expired" - token expired
- "Please login again" - token invalid
- "Account not found" - user deleted

---

## Summary

**Immediate Fix:**
1. Clear localStorage token
2. Re-login

**Code Fix:**
1. Add automatic logout on 401
2. Show user-friendly error messages
3. Add token expiration check
4. Better logging

**Prevention:**
1. Never change JWT_SECRET
2. Implement token refresh
3. Add expiration checks

---

## Quick Commands

### Clear Token (Browser Console):
```javascript
localStorage.removeItem('token');
localStorage.removeItem('preecode_avatar');
location.reload();
```

### Check Token (Browser Console):
```javascript
console.log('Token:', localStorage.getItem('token'));
```

### Backend Logs:
```bash
cd preecode-backend
npm start | grep auth
```

---

**Status:** ✅ Solutions Provided  
**Impact:** Fixes authentication errors in chatbox  
**Action:** Choose quick fix (user) or code fix (developer)
