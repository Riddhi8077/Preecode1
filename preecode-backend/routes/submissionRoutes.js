const express = require('express');
const router = express.Router();
const { addSubmission, getUserSubmissions } = require('../controllers/submissionController');
const validateObjectId = require('../middleware/validateObjectId');
const auth = require('../middleware/authMiddleware');

router.post('/', auth, addSubmission);
router.get('/:id', auth, validateObjectId, getUserSubmissions);

module.exports = router;
