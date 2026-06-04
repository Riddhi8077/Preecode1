const Submission = require('../models/Submission');
const User = require('../models/User');

// Add submission and update user stats
exports.addSubmission = async (req, res, next) => {
  try {
    const submittedUserId = req.body.userId;
    const userId = submittedUserId || (req.user && (req.user._id || req.user.id));
    const problemName = (req.body.problemName || '').trim();
    const difficultyRaw = String(req.body.difficulty || '').toLowerCase();
    const statusRaw = String(req.body.status || '').toLowerCase();
    const topic = (req.body.topic || 'General').trim();
    const timeTaken = (req.body.timeTaken || '00:00').trim();

    let difficulty = 'easy';
    if (difficultyRaw === 'medium' || difficultyRaw === 'hard' || difficultyRaw === 'easy') {
      difficulty = difficultyRaw;
    }

    let status = 'wrong';
    if (statusRaw.includes('accept') || statusRaw.includes('correct')) {
      status = 'accepted';
    }

    if (!userId || !problemName) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const submission = await Submission.create({ 
      userId, 
      problemName, 
      difficulty, 
      status,
      topic,
      timeTaken
    });
    // Update stats if accepted
    if (status === 'accepted') {
      user.totalSolved += 1;
      if (difficulty === 'easy') user.easySolved += 1;
      if (difficulty === 'medium') user.mediumSolved += 1;
      if (difficulty === 'hard') user.hardSolved += 1;
      await user.save();
    }
    res.status(201).json(submission);
  } catch (error) {
    next(error);
  }
};

// Get user submissions
exports.getUserSubmissions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const submissions = await Submission.find({ userId: id })
      .sort({ submittedAt: -1 })
      .select('-__v');
    res.json(submissions);
  } catch (error) {
    next(error);
  }
};
