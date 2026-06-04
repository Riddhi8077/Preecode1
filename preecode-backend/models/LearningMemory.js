const mongoose = require('mongoose');

const LearningMemorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    // Error identification
    memoryType: {
      type: String,
      enum: ['error', 'success', 'pattern'],
      default: 'error',
      index: true
    },

    errorId: {
      type: String,
      index: true
    },

    errorMessage: String,
    stackTrace: String,
    errorCategory: {
      type: String,
      enum: ['syntax', 'runtime', 'logic', 'type', 'async', 'performance', 'other'],
      default: 'other'
    },

    // Context
    projectInfo: {
      projectName: String,
      projectType: String, // web, mobile, cli, lib, etc.
      frameworks: [String],
      language: String
    },

    // File & Location
    fileName: String,
    fileLanguage: String,
    lineNumber: Number,
    context: String, // Surrounding code

    // Solutions
    solutions: [
      {
        approach: String,
        code: String,
        userApplied: { type: Boolean, default: false },
        outcome: {
          type: String,
          enum: ['success', 'partial', 'failed'],
          default: 'success'
        },
        timeToFix: Number, // milliseconds
        attemptNumber: Number,
        sourceType: {
          type: String,
          enum: ['ai', 'user', 'docs'],
          default: 'ai'
        },
        notes: String,
        createdAt: { type: Date, default: Date.now }
      }
    ],

    // Pattern tracking
    occurrences: { type: Number, default: 1 },
    lastOccurrence: Date,
    firstOccurrence: { type: Date, default: Date.now },

    // Metadata
    tags: [String],
    severity: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      default: 'medium'
    },

    // TTL for auto-cleanup (180 days retention)
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      index: { expireAfterSeconds: 0 }
    }
  },
  {
    timestamps: true,
    collection: 'learning_memories'
  }
);

// Compound index for efficient queries
LearningMemorySchema.index({ userId: 1, errorId: 1, createdAt: -1 });
LearningMemorySchema.index({ userId: 1, memoryType: 1, createdAt: -1 });
LearningMemorySchema.index({ userId: 1, errorCategory: 1 });

module.exports = mongoose.model('LearningMemory', LearningMemorySchema);
