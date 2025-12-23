/**
 * Better Auth Configuration
 *
 * Configures Better Auth with ElectroDB adapter and OAuth providers.
 * This module provides a singleton Better Auth instance for use across Lambda functions.
 */

import {betterAuth} from 'better-auth'
import {electroDBAdapter} from './electrodb-adapter'
import {logDebug} from '#lib/system/logging'
import {getRequiredEnv} from '#lib/system/env'

/**
 * Better Auth instance configured for MediaDownloader service.
 *
 * Configuration:
 * - Database: ElectroDB adapter with DynamoDB single-table design
 * - Providers: Apple Sign In (OAuth) with iOS bundle ID support
 * - Sessions: 30-day expiration with refresh tokens
 * - Base URL: API Gateway endpoint
 * - Trusted Origins: Apple's authentication domain
 *
 * Note: Better Auth's Apple provider expects a pre-generated client secret, but we
 * dynamically generate it from the auth key. This is handled by providing a placeholder
 * here since we're using ID token authentication (which doesn't require the secret for
 * token verification - Better Auth verifies ID tokens using Apple's public keys).
 */
export const auth = betterAuth({
  database: electroDBAdapter,

  // Secret for signing tokens and sessions
  secret: getRequiredEnv('BETTER_AUTH_SECRET'),

  // Base URL for OAuth callbacks (from environment)
  baseURL: getRequiredEnv('APPLICATION_URL'),

  // Trusted origins for OAuth flows
  trustedOrigins: ['https://appleid.apple.com'],

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
      // Use existing Sign In With Apple configuration
      // clientId is the Service ID for web, but appBundleIdentifier is used for iOS
      clientId: getAppleClientIdFromConfig(),
      // Client secret placeholder - not needed for ID token verification flow
      // Better Auth verifies ID tokens using Apple's public JWKS, not the client secret
      clientSecret: 'placeholder-not-used-for-id-token-flow',
      enabled: true,
      // iOS app bundle identifier for ID token validation
      // When using ID tokens from iOS, the 'aud' claim will be the bundle ID, not the service ID
      appBundleIdentifier: getAppleBundleIdFromConfig()
    }
  },

  // Advanced options
  advanced: {
    // Generate session tokens instead of cookies for mobile apps
    useSecureCookies: false
  }
})

/**
 * Extract client ID (Service ID) from Sign In With Apple configuration.
 */
function getAppleClientIdFromConfig(): string {
  const config = JSON.parse(getRequiredEnv('SIGN_IN_WITH_APPLE_CONFIG'))
  return config.client_id
}

/**
 * Extract bundle ID from Sign In With Apple configuration.
 */
function getAppleBundleIdFromConfig(): string {
  const config = JSON.parse(getRequiredEnv('SIGN_IN_WITH_APPLE_CONFIG'))
  return config.bundle_id
}

/**
 * Initialize Better Auth on cold start.
 * Call this at the top of Lambda handlers to ensure Better Auth is ready.
 */
export async function initializeBetterAuth() {
  logDebug('Better Auth initialized', {applicationUrl: getRequiredEnv('APPLICATION_URL')})
}

/**
 * Type exports for Better Auth operations
 */
export type BetterAuthInstance = typeof auth
