const express = require('express');
const router = express.Router();
const { addPractice, getPractice } = require('../controllers/practiceController');
const auth = require('../middleware/authMiddleware');

router.post('/', auth, addPractice);
router.get('/', auth, getPractice);

module.exports = router;
