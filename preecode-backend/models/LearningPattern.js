const mongoose = require('mongoose');

const LearningPatternSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    patternType: {
      type: String,
      enum: ['recurring_error', 'common_mistake', 'skill_gap', 'learning_opportunity'],
      default: 'recurring_error'
    },

    description: String,
    category: String, // e.g., "React state", "TypeScript types", "async/await"

    affectedAreas: [String], // Multiple problem areas

    // Statistics
    frequency: Number, // Occurrences in analysis period
    confidenceScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50
    },

    // Learning recommendations
    recommendations: [String], // AI suggestions for improvement
    resources: [
      {
        title: String,
        url: String,
        type: String // tutorial, docs, article, etc.
      }
    ],

    // Last analysis
    lastAnalyzedAt: Date,
    analysisWindowDays: {
      type: Number,
      default: 30
    }
  },
  {
    timestamps: true,
    collection: 'learning_patterns'
  }
);

// Index for efficient queries
LearningPatternSchema.index({ userId: 1, patternType: 1, createdAt: -1 });
LearningPatternSchema.index({ userId: 1, frequency: -1 });

module.exports = mongoose.model('LearningPattern', LearningPatternSchema);
