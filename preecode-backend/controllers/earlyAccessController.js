const User = require('../models/User');

// POST /api/early-access/confirm-share
exports.confirmShare = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.hasShared) {
      return res.status(400).json({ message: 'Reward already claimed.' });
    }

    // Grant share reward
    user.hasShared = true;
    user.foundingBadgeLevel = 'elite';
    user.earlyAccessMonthsGranted += 1;

    // Extend early access by 1 month
    const currentEnd = user.earlyAccessEndDate || new Date();
    const newEnd = new Date(currentEnd);
    newEnd.setMonth(newEnd.getMonth() + 1);
    user.earlyAccessEndDate = newEnd;

    await user.save();

    res.json({
      message: 'Elite Founding Member unlocked!',
      plan: user.plan,
      foundingBadgeLevel: user.foundingBadgeLevel,
      hasShared: user.hasShared,
      earlyAccessEndDate: user.earlyAccessEndDate,
      earlyAccessMonthsGranted: user.earlyAccessMonthsGranted,
      certificateId: user.certificateId,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/early-access/status
exports.getEarlyAccessStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select(
      'plan subscriptionStatus earlyAccessEndDate earlyAccessMonthsGranted hasShared foundingBadgeLevel certificateId username createdAt'
    );
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const now = new Date();
    const daysRemaining = user.earlyAccessEndDate
      ? Math.max(0, Math.ceil((user.earlyAccessEndDate - now) / 86400000))
      : 0;

    res.json({
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
      earlyAccessEndDate: user.earlyAccessEndDate,
      earlyAccessMonthsGranted: user.earlyAccessMonthsGranted,
      daysRemaining,
      hasShared: user.hasShared,
      foundingBadgeLevel: user.foundingBadgeLevel,
      certificateId: user.certificateId,
      username: user.username,
      joinedAt: user.createdAt,
    });
  } catch (error) {
    next(error);
  }
};
