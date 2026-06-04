const mongoose = require('mongoose');

const practiceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  question: { type: String, required: true },
  timeTaken: { type: String, required: true },
  topic: { type: String, default: 'General' },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  hintsUsed: { type: Number, default: 0 },
  hintUsagePercent: { type: Number, min: 0, max: 100, default: 0 },
  aiRating: { type: Number, min: 0, max: 10, default: 0 },
  solutionViewed: { type: Boolean, default: false },
  language: { type: String, required: true },
  date: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Practice', practiceSchema);
