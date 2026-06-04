# 🚀 Quick Fix: OpenRouter Rate Limit

## Problem
```
Error: Rate limit exceeded: free-models-per-day
```

## ✅ Solution (Choose One)

### Option 1: Add Credits (2 minutes) - RECOMMENDED
1. Go to https://openrouter.ai/credits
2. Add $10
3. Done! ✅

**Benefits:** 1000 requests/day, reliable, production-ready

---

### Option 2: Multiple API Keys (10 minutes) - FREE
1. Create 2-3 OpenRouter accounts (different emails)
2. Get API key from each account
3. Update `.env`:
   ```bash
   OPENROUTER_API_KEY=key1,key2,key3
   ```
4. Restart backend:
   ```bash
   cd preecode-backend
   npm start
   ```

**Benefits:** Free, automatic rotation, 3x daily limit

---

## What I Changed

✅ Added automatic API key rotation  
✅ Detects rate limits automatically  
✅ Switches to next key when limit hit  
✅ Works with single or multiple keys  

---

## Test It

### Single Key (Option 1):
```bash
# .env
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx
```

### Multiple Keys (Option 2):
```bash
# .env
OPENROUTER_API_KEY=sk-or-v1-key1,sk-or-v1-key2,sk-or-v1-key3
```

Restart backend and test AI features!

---

## Logs to Watch

```
[ai] Loaded 3 OpenRouter API key(s) for rotation
[ai] Rate limit hit, rotating to next API key...
[ai] Rotated to API key 2 of 3
[ai] ✅ Success with model nvidia/nemotron-3-super-120b-a12b:free
```

---

## Recommendation

**For Production:** Use Option 1 ($10 credits)  
**For Development:** Use Option 2 (multiple keys)

---

**Full details:** See `OPENROUTER_RATE_LIMIT_SOLUTION.md`
