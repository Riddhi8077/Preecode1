const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Submission = require('../models/Submission');
const crypto = require('crypto');

const generateToken = (userId, tokenVersion = 0) => {
  return jwt.sign({ id: userId, tokenVersion }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const avatarFromEmail = (email) => {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) {
    return '';
  }
  return `https://unavatar.io/google/${encodeURIComponent(normalized)}`;
};

const isGeneratedFallbackAvatar = (url) => {
  const value = String(url || '').toLowerCase();
  if (!value) return true;
  return (
    value.includes('gravatar.com/avatar/') ||
    value.includes('ui-avatars.com') ||
    value.includes('unavatar.io/google/')
  );
};

const ensureAvatar = async (userDoc) => {
  if (!userDoc) {
    return userDoc;
  }
  const fallbackAvatar = avatarFromEmail(userDoc.email);
  if (!fallbackAvatar) {
    return userDoc;
  }
  if (userDoc.avatar && !isGeneratedFallbackAvatar(userDoc.avatar)) {
    return userDoc;
  }
  if (userDoc.avatar === fallbackAvatar) {
    return userDoc;
  }
  userDoc.avatar = fallbackAvatar;
  await userDoc.save();
  return userDoc;
};

// Login user by email + password
exports.loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    const user = await User.findOne({ email }).select('-__v');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    if (!user.avatar || isGeneratedFallbackAvatar(user.avatar)) {
      user.avatar = avatarFromEmail(user.email);
      await user.save();
    }

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar || '',
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
      foundingBadgeLevel: user.foundingBadgeLevel,
      hasShared: user.hasShared,
      earlyAccessEndDate: user.earlyAccessEndDate,
      earlyAccessMonthsGranted: user.earlyAccessMonthsGranted,
      certificateId: user.certificateId,
      token: generateToken(user._id, user.tokenVersion || 0),
    });
  } catch (error) {
    next(error);
  }
};

// Create user
exports.createUser = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email, and password are required.' });
    }
    const userExists = await User.findOne({ $or: [{ username }, { email }] });
    if (userExists) {
      return res.status(409).json({ message: 'User already exists.' });
    }
    const user = await User.create({
      username,
      email,
      password,
      avatar: avatarFromEmail(email)
    });
    res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar || '',
    });
  } catch (error) {
    next(error);
  }
};

// Get user profile
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password -__v');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    await ensureAvatar(user);
    res.json(user);
  } catch (error) {
    next(error);
  }
};

// Get dashboard stats
exports.getStats = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-__v');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    // Get recent submissions (last 10)
    const recentSubmissions = await Submission.find({ userId: user._id })
      .sort({ submittedAt: -1 })
      .limit(10)
      .select('-__v -userId');
    res.json({
      totalSolved: user.totalSolved,
      easySolved: user.easySolved,
      mediumSolved: user.mediumSolved,
      hardSolved: user.hardSolved,
      recentSubmissions,
    });
  } catch (error) {
    next(error);
  }
};

// Update user profile
exports.updateProfile = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }
    const { username, avatar, firstName, lastName } = req.body;
    const userId = req.user._id;

    // Build update fields - only include fields that are provided
    const updateFields = {};

    // Handle username update
    if (username !== undefined && username !== null) {
      const trimmedUsername = String(username).trim();
      if (trimmedUsername === '') {
        return res.status(400).json({ message: 'Username cannot be empty.' });
      }
      // Only check uniqueness if username is different from current
      if (trimmedUsername.toLowerCase() !== req.user.username.toLowerCase()) {
        const existingUser = await User.findOne({
          username: { $regex: new RegExp(`^${trimmedUsername}$`, 'i') }
        });
        if (existingUser && existingUser._id.toString() !== userId.toString()) {
          return res.status(409).json({ message: 'Username already taken.' });
        }
      }
      updateFields.username = trimmedUsername;
    }

    // Handle optional fields
    if (avatar !== undefined) updateFields.avatar = avatar;
    if (firstName !== undefined) updateFields.firstName = firstName;
    if (lastName !== undefined) updateFields.lastName = lastName;

    // If no fields to update, return success
    if (Object.keys(updateFields).length === 0) {
      return res.json({
        message: 'No changes made.',
        user: req.user,
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateFields,
      { new: true }
    ).select('-password -__v -resetOtp -resetOtpExpires');

    res.json({
      message: 'Profile updated successfully.',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// Logout current user (invalidate existing JWTs by bumping tokenVersion)
exports.logoutUser = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }

    await User.findByIdAndUpdate(req.user._id, { $inc: { tokenVersion: 1 } });
    res.json({ message: 'Logged out successfully.' });
  } catch (error) {
    next(error);
  }
};

// Request password reset OTP
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    console.log('[forgotPassword] Request for email:', email);

    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      console.log('[forgotPassword] User not found for email:', email);
      // Don't reveal if user exists or not for security
      return res.json({ message: 'If this email exists, you will receive an OTP.' });
    }

    // Check if user signed up with Google (no password)
    if (user.provider === 'google' && !user.password) {
      console.log('[forgotPassword] User uses Google sign-in:', email);
      return res.status(400).json({
        message: 'This account uses Google sign-in. Please sign in with Google.'
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    console.log('[forgotPassword] Generated OTP for:', email, 'expires:', otpExpires);

    // Save OTP to user
    user.resetOtp = otp;
    user.resetOtpExpires = otpExpires;
    await user.save();

    // Send OTP email
    const { sendOtpEmail } = require('../config/email');
    const emailResult = await sendOtpEmail(user.email, otp);

    if (!emailResult.success) {
      console.error('[forgotPassword] Failed to send OTP email:', emailResult.error);
      return res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
    }

    console.log('[forgotPassword] OTP sent successfully to:', email);
    res.json({ message: 'OTP sent to your email.' });
  } catch (error) {
    console.error('[forgotPassword] Error:', error);
    next(error);
  }
};

// Verify OTP
exports.verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    console.log('[verifyOtp] Request for email:', email);

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required.' });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      resetOtp: otp,
      resetOtpExpires: { $gt: new Date() }
    });

    if (!user) {
      console.log('[verifyOtp] Invalid or expired OTP for:', email);
      return res.status(400).json({ message: 'Invalid or expired OTP.' });
    }

    // OTP is valid - generate a temporary reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetOtp = resetToken; // Reuse resetOtp field for reset token
    user.resetOtpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await user.save();

    console.log('[verifyOtp] OTP verified successfully for:', email);
    res.json({
      message: 'OTP verified successfully.',
      resetToken
    });
  } catch (error) {
    console.error('[verifyOtp] Error:', error);
    next(error);
  }
};

// Reset password with token
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, resetToken, newPassword } = req.body;
    console.log('[resetPassword] Request for email:', email);

    if (!email || !resetToken || !newPassword) {
      return res.status(400).json({ message: 'Email, reset token, and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      resetOtp: resetToken,
      resetOtpExpires: { $gt: new Date() }
    });

    if (!user) {
      console.log('[resetPassword] Invalid or expired reset token for:', email);
      return res.status(400).json({ message: 'Invalid or expired reset token.' });
    }

    // Update password and clear reset fields
    user.password = newPassword;
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;
    user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate all existing sessions
    await user.save();

    console.log('[resetPassword] Password reset successfully for:', email);
    res.json({ message: 'Password reset successfully. Please sign in with your new password.' });
  } catch (error) {
    console.error('[resetPassword] Error:', error);
    next(error);
  }
};

// Change password (authenticated user)
exports.changePassword = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    user.password = newPassword;
    user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate all sessions
    await user.save();

    res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    next(error);
  }
};

// Delete account (authenticated user)
exports.deleteAccount = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }

    await User.findByIdAndDelete(req.user._id);
    res.json({ message: 'Account deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

// Logout all devices (bump token version)
exports.logoutAllDevices = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }

    await User.findByIdAndUpdate(req.user._id, { $inc: { tokenVersion: 1 } });
    res.json({ message: 'All sessions logged out successfully.' });
  } catch (error) {
    next(error);
  }
};

// Update notification preferences
exports.updateNotificationPrefs = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }

    const prefs = req.body;
    await User.findByIdAndUpdate(req.user._id, { notificationPrefs: prefs }, { new: true });
    res.json({ message: 'Notification preferences updated.' });
  } catch (error) {
    next(error);
  }
};
