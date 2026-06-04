const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const {
  googleCallbackUrl,
  googleClientId,
  googleClientSecret,
} = require('./runtimeConfig');

passport.use(
  new GoogleStrategy(
    {
      // OAuth config stays env-driven so local and production use the same contract.
      clientID: googleClientId,
      clientSecret: googleClientSecret,
      callbackURL: googleCallbackUrl,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ providerId: profile.id });
        const providerAvatar = profile.photos[0]?.value || '';

        if (user) {
          if (providerAvatar && user.avatar !== providerAvatar) {
            user.avatar = providerAvatar;
            await user.save();
          }
          return done(null, user);
        }

        // Generate a unique username from Google display name
        const baseUsername = profile.displayName.replace(/\s+/g, '_').toLowerCase();
        let username = baseUsername;
        let counter = 1;
        while (await User.findOne({ username })) {
          username = `${baseUsername}_${counter}`;
          counter++;
        }

        user = await User.create({
          name: profile.displayName,
          username,
          email: profile.emails[0].value,
          provider: 'google',
          providerId: profile.id,
          avatar: providerAvatar,
        });

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

module.exports = passport;
