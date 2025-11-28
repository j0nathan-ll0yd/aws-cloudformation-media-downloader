/**
 * Example Better Auth configuration with fixture logging
 * This demonstrates how to integrate fixture logging hooks for production debugging
 */

import { betterAuth } from 'better-auth'
import { fixtureLoggingHooks } from './fixture-hooks'

export const auth = betterAuth({
  // Database configuration
  database: {
    // Your database configuration
  },

  // Authentication configuration
  emailAndPassword: {
    enabled: true
  },

  // Social providers (if needed)
  socialProviders: {
    // Your social provider config
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24      // Update session if older than 1 day
  },

  // Add fixture logging hooks
  // These will log requests/responses when ENABLE_FIXTURE_LOGGING=true
  hooks: {
    ...fixtureLoggingHooks,
    // Add any additional custom hooks here
    before: [
      ...fixtureLoggingHooks.before,
      // Your custom before hooks
    ],
    after: [
      ...fixtureLoggingHooks.after,
      // Your custom after hooks
    ]
  },

  // Advanced options
  advanced: {
    // Set to true in production for better security
    useSecureCookies: process.env.NODE_ENV === 'production',

    // Custom logger (optional - can also use fixture logging)
    customLogger: (level, message, ...args) => {
      // Your custom logging logic
      console.log(`[${level}] ${message}`, ...args)
    }
  }
})

/**
 * Environment variables needed for fixture logging:
 *
 * ENABLE_FIXTURE_LOGGING=true    # Enable fixture logging
 * AWS_ACCOUNT_ID=123456789012    # AWS account ID (optional)
 * STAGE=prod                     # Deployment stage (optional)
 */