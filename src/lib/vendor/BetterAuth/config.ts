/**
 * Better Auth Configuration
 *
 * Configures Better Auth with the official Drizzle adapter for Aurora DSQL.
 * Uses lazy initialization to handle async Drizzle client creation (IAM token auth).
 *
 * @see https://www.better-auth.com/docs/adapters/drizzle
 */

import {betterAuth} from 'better-auth'
import {drizzleAdapter} from 'better-auth/adapters/drizzle'
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import * as schema from '#lib/vendor/Drizzle/schema'
import {logDebug} from '#lib/system/logging'
import {getRequiredEnv} from '#lib/system/env'

// Cached instances for Lambda connection reuse
let cachedAuth: ReturnType<typeof betterAuth> | null = null

/**
 * Get Better Auth instance with lazy initialization.
 *
 * Uses the official Better Auth Drizzle adapter with async client creation.
 * The Drizzle client requires async initialization for IAM token authentication.
 *
 * Configuration:
 * - Database: Official Drizzle adapter with Aurora DSQL (PostgreSQL)
 * - Providers: Apple Sign In (OAuth) with iOS bundle ID support
 * - Sessions: 30-day expiration with refresh tokens
 * - Base URL: API Gateway endpoint
 * - Trusted Origins: Apple's authentication domain
 *
 * @returns Better Auth instance
 */
export async function getAuth(): Promise<ReturnType<typeof betterAuth>> {
  if (cachedAuth) {
    return cachedAuth
  }

  const db = await getDrizzleClient()

  cachedAuth = betterAuth({
    database: drizzleAdapter(db, {
      provider: 'pg',
      // Map our plural table names to Better Auth's expected singular names
      schema: {user: schema.users, session: schema.sessions, account: schema.accounts, verification: schema.verification}
    }),

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
      useSecureCookies: false,
      // Let the database generate UUIDs instead of Better Auth generating nanoid strings
      database: {generateId: false}
    }
  })

  logDebug('Better Auth initialized with official Drizzle adapter')
  return cachedAuth
}

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
 * Type exports for Better Auth operations
 */
export type BetterAuthInstance = Awaited<ReturnType<typeof getAuth>>
