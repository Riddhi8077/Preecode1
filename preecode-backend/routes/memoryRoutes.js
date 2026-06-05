const express = require('express');
const router = express.Router();
const {
  trackError,
  trackSolution,
  findSimilarErrors,
  getMemoryHistory,
  analyzePatterns,
  exportMemory,
  deleteMemory,
  updateMemorySettings
} = require('../controllers/memoryController');
const auth = require('../middleware/authMiddleware');

// All routes require authentication
router.use(auth);

router.post('/track-error', trackError);
router.post('/track-solution', trackSolution);
router.get('/similar-errors', findSimilarErrors);
router.get('/history', getMemoryHistory);
router.get('/patterns', analyzePatterns);
router.post('/export', exportMemory);
router.post('/delete', deleteMemory);
router.post('/settings', updateMemorySettings);

module.exports = router;
