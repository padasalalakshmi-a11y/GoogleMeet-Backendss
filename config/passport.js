const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const User = require('../models/UserModel')

passport.serializeUser((user, done) => {
  done(null, user.id)
})

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id)
    done(null, user)
  } catch (error) {
    done(error, null)
  }
})

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/auth/google/callback`
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists
        let user = await User.findOne({
          where: { googleId: profile.id }
        })

        if (user) {
          // User exists, return user
          return done(null, user)
        }

        // Check if email already exists
        user = await User.findOne({
          where: { email: profile.emails[0].value }
        })

        if (user) {
          // Update existing user with Google ID
          user.googleId = profile.id
          user.name = profile.displayName
          await user.save()
          return done(null, user)
        }

        // Create new user
        user = await User.create({
          googleId: profile.id,
          email: profile.emails[0].value,
          name: profile.displayName,
          credits: 30,
          plan: 'free'
        })

        done(null, user)
      } catch (error) {
        console.error('Google OAuth Error:', error)
        done(error, null)
      }
    }
  )
)

module.exports = passport
