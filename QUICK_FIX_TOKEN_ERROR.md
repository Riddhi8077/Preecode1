# 🚨 Quick Fix: "Not authorized, token invalid" Error

## Problem
Chatbox shows: **"Not authorized, token invalid"**

---

## ✅ Solution (2 minutes)

### Step 1: Open Browser Console
- Press **F12** (or right-click → Inspect)
- Click **Console** tab

### Step 2: Clear Token
Copy and paste this command:
```javascript
localStorage.removeItem('token');
localStorage.removeItem('preecode_avatar');
location.reload();
```

### Step 3: Login Again
- Page will refresh
- Login with your credentials
- Try chatbox again

**Done!** ✅

---

## Why This Happens

1. **JWT Secret Changed** - Backend security key was updated
2. **Session Expired** - You logged out from another device
3. **Corrupted Token** - Browser storage got corrupted

---

## Still Not Working?

### Option 1: Clear All Site Data
1. Press **F12**
2. Go to **Application** tab
3. Click **Clear site data**
4. Refresh and login

### Option 2: Try Different Browser
- Open Preecode in incognito/private mode
- Login and test

### Option 3: Check Backend
```bash
cd preecode-backend
node check-auth-setup.js
```

This will check if JWT_SECRET is configured correctly.

---

## For Developers

### Check Backend Logs
```bash
cd preecode-backend
npm start

# Watch for:
[auth] Token verification failed: ...
[auth] User not found: ...
[auth] JWT_SECRET is not set!
```

### Verify JWT_SECRET
```bash
cd preecode-backend
cat .env | grep JWT_SECRET
```

**Important:** Never change JWT_SECRET in production!

### Test Token
1. Get token from browser console:
   ```javascript
   console.log(localStorage.getItem('token'));
   ```
2. Go to https://jwt.io/
3. Paste token and verify it's valid

---

## Prevention

✅ **Code fixes implemented:**
- Automatic token cleanup on 401 errors
- Better error logging
- Token validation checks

✅ **Best practices:**
- Never change JWT_SECRET
- Use strong secrets (64+ characters)
- Implement token refresh (future)

---

## Summary

**Quick Fix:**
1. Clear localStorage token
2. Refresh page
3. Login again

**Root Cause:**
- JWT_SECRET changed or token expired

**Prevention:**
- Keep JWT_SECRET stable
- Implement token refresh

---

**See also:** `FIX_TOKEN_INVALID_ERROR.md` for detailed guide
