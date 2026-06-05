const LearningMemory = require('../models/LearningMemory');
const LearningPattern = require('../models/LearningPattern');
const crypto = require('crypto');

function generateErrorHash(errorMessage, category) {
  const data = `${errorMessage}|${category}`;
  return crypto.createHash('md5').update(data).digest('hex');
}

function classifyError(errorMessage, stackTrace) {
  const msg = String(errorMessage || '').toLowerCase();
  const stack = String(stackTrace || '').toLowerCase();

  if (msg.includes('syntaxerror') || msg.includes('syntax')) return 'syntax';
  if (msg.includes('typeerror') || msg.includes('is not a function')) return 'type';
  if (msg.includes('timeout') || msg.includes('promise')) return 'async';
  if (msg.includes('performance') || msg.includes('slow')) return 'performance';
  if (stack.includes('runtime') || msg.includes('undefined')) return 'runtime';
  if (msg.includes('logic') || msg.includes('expected')) return 'logic';

  return 'other';
}

// POST /api/memory/track-error
exports.trackError = async (req, res, next) => {
  try {
    const { errorMessage, stackTrace, fileName, fileLanguage, lineNumber, context, projectInfo, tags } = req.body;
    const userId = req.user._id;

    if (!errorMessage) {
      return res.status(400).json({ message: 'errorMessage is required.' });
    }

    const errorCategory = classifyError(errorMessage, stackTrace);
    const errorId = generateErrorHash(errorMessage, errorCategory);

    // Check if this error already exists
    let memory = await LearningMemory.findOne({
      userId,
      errorId,
      memoryType: 'error'
    });

    if (memory) {
      // Update existing error
      memory.occurrences = (memory.occurrences || 0) + 1;
      memory.lastOccurrence = new Date();
      if (!memory.tags) memory.tags = [];
      if (tags && Array.isArray(tags)) {
        memory.tags = [...new Set([...memory.tags, ...tags])];
      }
    } else {
      // Create new error
      memory = new LearningMemory({
        userId,
        memoryType: 'error',
        errorId,
        errorMessage,
        stackTrace,
        errorCategory,
        fileName,
        fileLanguage,
        lineNumber,
        context,
        projectInfo,
        tags: tags || [],
        occurrences: 1,
        lastOccurrence: new Date(),
        firstOccurrence: new Date()
      });
    }

    await memory.save();
    res.json({
      success: true,
      memoryId: memory._id,
      isNew: !memory.occurrences || memory.occurrences === 1,
      errorId
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/memory/track-solution
exports.trackSolution = async (req, res, next) => {
  try {
    const { memoryId, approach, code, userApplied, outcome, timeToFix, attemptNumber, sourceType, notes } = req.body;
    const userId = req.user._id;

    if (!memoryId) {
      return res.status(400).json({ message: 'memoryId is required.' });
    }

    const memory = await LearningMemory.findOne({ _id: memoryId, userId });
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found.' });
    }

    if (!memory.solutions) {
      memory.solutions = [];
    }

    memory.solutions.push({
      approach: approach || '',
      code: code || '',
      userApplied: Boolean(userApplied),
      outcome: outcome || 'success',
      timeToFix: timeToFix || 0,
      attemptNumber: attemptNumber || 1,
      sourceType: sourceType || 'ai',
      notes: notes || ''
    });

    await memory.save();
    res.json({
      success: true,
      solutionsCount: memory.solutions.length
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/memory/similar-errors
exports.findSimilarErrors = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { errorMessage, limit = 5 } = req.query;

    if (!errorMessage) {
      return res.status(400).json({ message: 'errorMessage query param is required.' });
    }

    const category = classifyError(errorMessage, '');

    const similar = await LearningMemory.find({
      userId,
      memoryType: 'error',
      errorCategory: category,
      $or: [
        { errorMessage: { $regex: errorMessage.slice(0, 20), $options: 'i' } },
        { errorCategory: category }
      ]
    })
      .sort({ lastOccurrence: -1 })
      .limit(parseInt(limit) || 5)
      .select('errorMessage solutions occurrences lastOccurrence');

    res.json({
      count: similar.length,
      errors: similar,
      suggestions: similar
        .filter(e => e.solutions && e.solutions.length > 0)
        .map(e => ({
          errorId: e._id,
          message: e.errorMessage,
          solutionsCount: e.solutions.length,
          mostEffectiveSolution: e.solutions[0]
        }))
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/memory/history
exports.getMemoryHistory = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, category, memoryType } = req.query;

    const query = { userId };
    if (category) query.errorCategory = category;
    if (memoryType) query.memoryType = memoryType;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [memories, total] = await Promise.all([
      LearningMemory.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      LearningMemory.countDocuments(query)
    ]);

    res.json({
      memories,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/memory/patterns
exports.analyzePatterns = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Group errors by category and find patterns
    const errors = await LearningMemory.aggregate([
      { $match: { userId: new (require('mongoose').Types.ObjectId)(userId), memoryType: 'error' } },
      { $group: { _id: '$errorCategory', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const patterns = [];
    for (const error of errors) {
      const categoryErrors = await LearningMemory.find({
        userId,
        errorCategory: error._id,
        memoryType: 'error'
      }).limit(5);

      if (error.count >= 2) {
        // Pattern detected if occurs 2+ times
        patterns.push({
          patternType: 'recurring_error',
          category: error._id,
          frequency: error.count,
          examples: categoryErrors.map(e => ({
            message: e.errorMessage,
            occurrences: e.occurrences
          })),
          recommendations: [
            `You encounter ${error._id} errors frequently.`,
            'Consider reviewing the fundamentals of this area.',
            'Look for patterns in when/why these errors occur.'
          ]
        });
      }
    }

    res.json({
      patterns,
      summary: {
        totalErrors: await LearningMemory.countDocuments({ userId, memoryType: 'error' }),
        categoriesWithPatterns: patterns.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/memory/export
exports.exportMemory = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const memories = await LearningMemory.find({ userId }).lean();
    const patterns = await LearningPattern.find({ userId }).lean();

    const exportData = {
      exportedAt: new Date(),
      version: '1.0',
      summary: {
        totalMemories: memories.length,
        totalPatterns: patterns.length
      },
      memories,
      patterns
    };

    res.json(exportData);
  } catch (error) {
    next(error);
  }
};

// POST /api/memory/delete
exports.deleteMemory = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { confirmed } = req.body;

    if (!confirmed) {
      return res.status(400).json({ message: 'Deletion must be confirmed.' });
    }

    await Promise.all([
      LearningMemory.deleteMany({ userId }),
      LearningPattern.deleteMany({ userId })
    ]);

    res.json({
      success: true,
      message: 'All learning memory deleted.'
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/memory/settings
exports.updateMemorySettings = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { enabled, retentionDays, autoNotify } = req.body;

    // Settings are stored in user preferences or a separate collection
    // For now, just return success - implementation depends on architecture
    res.json({
      success: true,
      settings: {
        enabled: Boolean(enabled),
        retentionDays: retentionDays || 180,
        autoNotify: Boolean(autoNotify)
      }
    });
  } catch (error) {
    next(error);
  }
};
