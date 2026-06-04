// Checks if a user's early access pro plan has expired
// Runs after auth middleware on protected routes
module.exports = async (req, res, next) => {
  try {
    if (!req.user) return next();

    if (
      req.user.plan === 'pro' &&
      req.user.earlyAccessEndDate &&
      new Date() > new Date(req.user.earlyAccessEndDate)
    ) {
      req.user.plan = 'free';
      req.user.subscriptionStatus = 'inactive';
      await req.user.save();
    }

    next();
  } catch (error) {
    next(error);
  }
};
