const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  problemName: { type: String, required: true },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
  status: { type: String, enum: ['accepted', 'wrong'], required: true },
  topic: { type: String, default: 'General' },
  timeTaken: { type: String, default: '00:00' },
  submittedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Submission', submissionSchema);
