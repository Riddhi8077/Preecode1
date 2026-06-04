const { chat, getHint, reviewCode, generateQuestion } = require('../services/aiService');

// POST /api/ai/generate-question
exports.generatePracticeQuestion = async (req, res, next) => {
  try {
    const { language, difficulty, topic } = req.body;
    if (!language) {
      return res.status(400).json({ message: 'language is required.' });
    }
    const result = await generateQuestion(language, difficulty, topic);
    res.json({ question: result });
  } catch (error) {
    next(error);
  }
};

// POST /api/ai/chat
exports.chatWithAI = async (req, res, next) => {
  try {
    const { message, context, history } = req.body;
    if (!message) {
      return res.status(400).json({ message: 'message is required.' });
    }
    const response = await chat(message, context, history);
    res.json({ response });
  } catch (error) {
    next(error);
  }
};

// POST /api/ai/hint
exports.getAIHint = async (req, res, next) => {
  try {
    const { problemDescription, language } = req.body;
    if (!problemDescription) {
      return res.status(400).json({ message: 'problemDescription is required.' });
    }
    const hint = await getHint(problemDescription, language);
    res.json({ hint });
  } catch (error) {
    next(error);
  }
};

// POST /api/ai/review
exports.reviewUserCode = async (req, res, next) => {
  try {
    const { code, language, problemDescription } = req.body;
    if (!code) {
      return res.status(400).json({ message: 'code is required.' });
    }
    const review = await reviewCode(code, language, problemDescription);
    res.json({ review });
  } catch (error) {
    next(error);
  }
};
