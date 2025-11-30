/**
 * Better Auth hooks for fixture logging
 * Logs requests and responses using the same fixture markers as Lambda functions
 * This enables extraction of Better Auth fixtures from CloudWatch logs
 */

import {logIncomingFixture, logOutgoingFixture} from '#util/lambda-helpers'

/**
 * Better Auth hook context type
 * Represents the context passed to before/after hooks
 */
interface BetterAuthHookContext {
  path: string
  request?: {method?: string}
  headers?: Record<string, string>
  body?: unknown
  query?: Record<string, string>
  requestId?: string
  response?: {status?: number; headers?: Record<string, string>; body?: unknown}
}

/**
 * Extract endpoint name from path for fixture naming
 * Converts paths like /auth/sign-in to PascalCase names like SignIn
 */
function getFixtureName(path: string): string {
  // Remove leading slash and 'auth/' prefix if present
  const cleanPath = path.replace(/^\/?(auth\/)?/, '')

  // Convert kebab-case to PascalCase
  return cleanPath.split(/[-/]/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('')
}

/**
 * Before hook that logs incoming requests for fixture extraction
 * Always logs - fixtures are extracted from CloudWatch as needed
 */
export const logIncomingRequestHook = {
  matcher: () => true,
  handler: async (ctx: BetterAuthHookContext) => {
    const fixtureName = getFixtureName(ctx.path)

    // Create a request-like object similar to API Gateway events
    const requestData = {
      path: ctx.path,
      httpMethod: ctx.request?.method || 'POST',
      headers: ctx.headers || {},
      body: ctx.body ? JSON.stringify(ctx.body) : null,
      queryStringParameters: ctx.query || null,
      requestContext: {requestId: ctx.requestId || crypto.randomUUID(), accountId: process.env.AWS_ACCOUNT_ID, stage: process.env.STAGE || 'prod'}
    }

    // Log using the standard fixture logging function
    logIncomingFixture(requestData, `BetterAuth${fixtureName}`)
  }
}

/**
 * After hook that logs outgoing responses for fixture extraction
 * Always logs - fixtures are extracted from CloudWatch as needed
 */
export const logOutgoingResponseHook = {
  matcher: () => true,
  handler: async (ctx: BetterAuthHookContext) => {
    const fixtureName = getFixtureName(ctx.path)

    // Create a response-like object similar to API Gateway responses
    const responseData = {
      statusCode: ctx.response?.status || 200,
      headers: ctx.response?.headers || {},
      body: ctx.response?.body ? JSON.stringify(ctx.response.body) : null,
      isBase64Encoded: false
    }

    // Log using the standard fixture logging function
    logOutgoingFixture(responseData, `BetterAuth${fixtureName}`)
  }
}

/**
 * Combined fixture logging hooks for Better Auth
 * Add these to your Better Auth configuration
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/Fixture-Extraction#fixture-logging-implementation | Better Auth Fixture Integration}
 */
export const fixtureLoggingHooks = {before: [logIncomingRequestHook], after: [logOutgoingResponseHook]}
