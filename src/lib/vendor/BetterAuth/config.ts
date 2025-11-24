/**
 * Better Auth Configuration
 *
 * Configures Better Auth with ElectroDB adapter and OAuth providers.
 * This module provides a singleton Better Auth instance for use across Lambda functions.
 */

import {betterAuth} from 'better-auth'
import {createElectroDBAdapter} from './electrodb-adapter'
import {logDebug} from '../../../util/lambda-helpers'

/**
 * Better Auth instance configured for MediaDownloader service.
 *
 * Configuration:
 * - Database: ElectroDB adapter with DynamoDB single-table design
 * - Providers: Apple Sign In (OAuth)
 * - Sessions: 30-day expiration with refresh tokens
 * - Base URL: API Gateway endpoint
 */
export const auth = betterAuth({
  database: createElectroDBAdapter(),

  // Base URL for OAuth callbacks (from environment)
  baseURL: process.env.BASE_URL || 'https://api.example.com',

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    cookieCache: {
      enabled: false // Disable cookie cache for serverless
    }
  },

  // OAuth providers
  socialProviders: {
    apple: {
      clientId: process.env.APPLE_CLIENT_ID || '',
      clientSecret: process.env.APPLE_CLIENT_SECRET || '',
      enabled: true
    }
  },

  // Advanced options
  advanced: {
    // Generate session tokens instead of cookies for mobile apps
    useSecureCookies: false,
    generateSessionToken: true
  }
})

/**
 * Initialize Better Auth on cold start.
 * Call this at the top of Lambda handlers to ensure Better Auth is ready.
 */
export async function initializeBetterAuth() {
  logDebug('Better Auth initialized', {
    baseURL: process.env.BASE_URL,
    hasAppleConfig: !!(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET)
  })
}

/**
 * Type exports for Better Auth operations
 */
export type BetterAuthInstance = typeof auth
