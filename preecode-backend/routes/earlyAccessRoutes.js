const express = require('express');
const router = express.Router();
const { confirmShare, getEarlyAccessStatus } = require('../controllers/earlyAccessController');
const auth = require('../middleware/authMiddleware');
const checkEarlyAccess = require('../middleware/checkEarlyAccess');

router.post('/confirm-share', auth, checkEarlyAccess, confirmShare);
router.get('/status', auth, checkEarlyAccess, getEarlyAccessStatus);

module.exports = router;
