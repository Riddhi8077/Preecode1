const express = require('express');
const router = express.Router();
const { createUser, getUser, getStats, loginUser, updateProfile, logoutUser, forgotPassword, verifyOtp, resetPassword, changePassword, deleteAccount, logoutAllDevices, updateNotificationPrefs } = require('../controllers/userController');
const validateObjectId = require('../middleware/validateObjectId');
const auth = require('../middleware/authMiddleware');
const checkEarlyAccess = require('../middleware/checkEarlyAccess');

// Debug logs for route hits
router.post('/login', (req, res, next) => {
	console.log('[users] POST /api/users/login from', req.ip, 'bodyKeys=', Object.keys(req.body));
	return loginUser(req, res, next);
});

router.post('/', (req, res, next) => {
	console.log('[users] POST /api/users (create) from', req.ip, 'bodyKeys=', Object.keys(req.body));
	return createUser(req, res, next);
});

// Password reset routes (no auth required)
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);

// Authenticated routes
router.get('/me', auth, async (req, res, next) => {
	try {
		if (!req.user) {
			return res.status(401).json({ message: 'Not authenticated.' });
		}
		res.json(req.user);
	} catch (error) {
		next(error);
	}
});

router.get('/stats/:id', auth, checkEarlyAccess, validateObjectId, getStats);
router.get('/:id', auth, checkEarlyAccess, validateObjectId, getUser);

router.put('/:id', auth, validateObjectId, updateProfile);
router.post('/logout', auth, logoutUser);
router.post('/change-password', auth, changePassword);
router.delete('/:id', auth, validateObjectId, deleteAccount);
router.post('/logout-all-devices', auth, logoutAllDevices);
router.put('/notification-prefs', auth, updateNotificationPrefs);

module.exports = router;
