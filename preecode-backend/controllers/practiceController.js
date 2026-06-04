const Practice = require('../models/Practice');

// Save a practice session
exports.addPractice = async (req, res, next) => {
  try {
    const { question, timeTaken, hintsUsed, solutionViewed, language, date, topic, difficulty, hintUsagePercent, aiRating } = req.body;
    if (!question || !timeTaken || !language || !date) {
      return res.status(400).json({ message: 'question, timeTaken, language, and date are required.' });
    }
    const practice = await Practice.create({
      userId: req.user._id,
      question,
      timeTaken,
      topic: topic || 'General',
      difficulty: ['easy', 'medium', 'hard'].includes(String(difficulty || '').toLowerCase()) ? String(difficulty).toLowerCase() : 'medium',
      hintsUsed: hintsUsed || 0,
      hintUsagePercent: Number.isFinite(Number(hintUsagePercent)) ? Math.max(0, Math.min(100, Number(hintUsagePercent))) : 0,
      aiRating: Number.isFinite(Number(aiRating)) ? Math.max(0, Math.min(10, Number(aiRating))) : 0,
      solutionViewed: solutionViewed || false,
      language,
      date,
    });
    res.status(201).json(practice);
  } catch (error) {
    next(error);
  }
};

// Get all practice sessions for the logged-in user
exports.getPractice = async (req, res, next) => {
  try {
    const practices = await Practice.find({ userId: req.user._id })
      .sort({ date: -1 })
      .limit(50)
      .lean();
    res.json(practices);
  } catch (error) {
    next(error);
  }
};
