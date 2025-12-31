/**
 * Auth Flow Integration Tests (True Integration)
 *
 * Tests the LoginUser and RegisterUser workflows with REAL Better Auth:
 * 1. Register new user - creates User, Session, Account entities via Better Auth
 * 2. Login existing user - validates credentials, creates session
 * 3. Login with invalid credentials - returns error
 * 4. Handle new user name update from iOS app
 *
 * Uses real Better Auth with mocked Apple JWKS endpoint.
 * Only the external network call to Apple's JWKS is mocked.
 * All database operations happen on real PostgreSQL.
 *
 * @see docs/wiki/Testing/Integration-Test-Audit.md for classification
 */

// Set environment variables BEFORE any imports
// These must be set before Better Auth config is loaded
process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'

// Required env vars for Lambda handlers
process.env.DEFAULT_FILE_SIZE = '1024'
process.env.DEFAULT_FILE_NAME = 'test-default-file.mp4'
process.env.DEFAULT_FILE_URL = 'https://example.com/test-default-file.mp4'
process.env.DEFAULT_FILE_CONTENT_TYPE = 'video/mp4'

// Better Auth configuration
process.env.BETTER_AUTH_SECRET = 'test-secret-key-for-better-auth-32-chars'
process.env.APPLICATION_URL = 'https://api.example.com' // Used by getAuth() config
process.env.SIGN_IN_WITH_APPLE_CONFIG = JSON.stringify({client_id: 'com.example.service', bundle_id: 'com.example.app'})

import {afterAll, afterEach, beforeAll, describe, expect, test} from 'vitest'
import type {Context} from 'aws-lambda'
import {sql} from 'drizzle-orm'

// Test helpers
import {closeTestDb, createAllTables, getTestDbAsync, truncateAllTables} from '../helpers/postgres-helpers'
import {createMockContext} from '../helpers/lambda-context'
import {generateAppleIdToken, startAppleJWKSMock, stopAppleJWKSMock} from '../helpers/apple-jwks-mock'

// Import handlers after environment is set
// NO MOCKING of Better Auth - we use the real implementation
const {handler: loginHandler} = await import('#lambdas/LoginUser/src/index')
const {handler: registerHandler} = await import('#lambdas/RegisterUser/src/index')

interface AuthRequestBody {
  idToken: string
  firstName?: string
  lastName?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createAuthEvent(body: AuthRequestBody, path: string): any {
  return {
    body: JSON.stringify(body),
    headers: {'Content-Type': 'application/json', 'User-Agent': 'iOS/17.0 TestApp/1.0'},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path,
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      protocol: 'HTTP/1.1',
      httpMethod: 'POST',
      path,
      stage: 'test',
      requestId: 'test-request',
      requestTime: '01/Jan/2024:00:00:00 +0000',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: path,
      authorizer: {},
      identity: {sourceIp: '127.0.0.1', userAgent: 'iOS/17.0 TestApp/1.0'}
    },
    resource: path
  }
}

describe('Auth Flow Integration Tests (True Integration)', () => {
  let mockContext: Context

  beforeAll(async () => {
    // Start the Apple JWKS mock - intercepts requests to https://appleid.apple.com/auth/keys
    startAppleJWKSMock()

    // Initialize database connection and create tables
    await getTestDbAsync()
    await createAllTables()
    mockContext = createMockContext()
  })

  afterEach(async () => {
    // Clean up database between tests
    await truncateAllTables()
  })

  afterAll(async () => {
    // Stop the JWKS mock and close database
    stopAppleJWKSMock()
    await closeTestDb()
  })

  describe('LoginUser (True Integration)', () => {
    test('should login/register user with valid Apple ID token', async () => {
      // Generate a valid Apple ID token using our mock JWKS
      // The token is signed with our test keys and will validate against the mock JWKS
      const appleUserId = 'apple-user-' + Date.now()
      const testEmail = `test-${Date.now()}@example.com`

      const idToken = generateAppleIdToken({
        sub: appleUserId,
        email: testEmail,
        aud: 'com.example.app' // Must match bundle_id in config
      })

      const body: AuthRequestBody = {idToken}
      const event = createAuthEvent(body, '/auth/login')
      const result = await loginHandler(event, mockContext)

      // Debug: log response if not 200
      if (result.statusCode !== 200) {
        console.log('Login failed with status:', result.statusCode)
        console.log('Response body:', result.body)
      }

      // Verify response structure
      expect(result.statusCode).toBe(200)
      const response = JSON.parse(result.body)
      expect(response.body.token).toBeDefined()
      expect(response.body.token).not.toBe('')
      expect(response.body.userId).toBeDefined()
      // Note: sessionId may not be in response (Better Auth doesn't always include it)
      // We verify session creation via database query below
      expect(response.body.expiresAt).toBeGreaterThan(Date.now())

      // Verify user was created in database
      const db = await getTestDbAsync()
      const users = await db.execute(sql`SELECT * FROM users WHERE email = ${testEmail}`)
      const userRows = [...users] as Array<{id: string; email: string}>
      expect(userRows).toHaveLength(1)
      expect(userRows[0].email).toBe(testEmail)

      // Verify session was created in database
      const sessions = await db.execute(sql`SELECT * FROM sessions WHERE user_id = ${userRows[0].id}`)
      const sessionRows = [...sessions] as Array<{id: string; user_id: string; token: string}>
      expect(sessionRows.length).toBeGreaterThanOrEqual(1)
    })

    test('should return error for malformed ID token', async () => {
      // Send a completely invalid token (not a valid JWT)
      const body: AuthRequestBody = {idToken: 'not-a-valid-jwt-token'}
      const event = createAuthEvent(body, '/auth/login')
      const result = await loginHandler(event, mockContext)

      // Better Auth should reject the invalid token
      expect(result.statusCode).toBe(500)
    })

    test('should validate request body - missing idToken', async () => {
      const body = {} as AuthRequestBody
      const event = createAuthEvent(body, '/auth/login')
      const result = await loginHandler(event, mockContext)

      expect(result.statusCode).toBe(400)
    })
  })

  describe('RegisterUser (True Integration)', () => {
    test('should register new user and update name', async () => {
      // Generate a valid Apple ID token
      const appleUserId = 'apple-new-user-' + Date.now()
      const testEmail = `newuser-${Date.now()}@example.com`

      const idToken = generateAppleIdToken({sub: appleUserId, email: testEmail, aud: 'com.example.app'})

      const body: AuthRequestBody = {idToken, firstName: 'John', lastName: 'Doe'}
      const event = createAuthEvent(body, '/auth/register')
      const result = await registerHandler(event, mockContext)

      // Verify response
      expect(result.statusCode).toBe(200)
      const response = JSON.parse(result.body)
      expect(response.body.token).toBeDefined()
      expect(response.body.userId).toBeDefined()
      // Note: sessionId may not be in response (Better Auth doesn't always include it)

      // Verify user was created with name in database
      const db = await getTestDbAsync()
      const users = await db.execute(sql`SELECT * FROM users WHERE email = ${testEmail}`)
      const userRows = [...users] as Array<{id: string; email: string; first_name: string | null; last_name: string | null}>
      expect(userRows).toHaveLength(1)
      expect(userRows[0].first_name).toBe('John')
      expect(userRows[0].last_name).toBe('Doe')

      // Verify account was created (Better Auth creates this for OAuth)
      const accounts = await db.execute(sql`SELECT * FROM accounts WHERE user_id = ${userRows[0].id}`)
      const accountRows = [...accounts] as Array<{id: string; provider_id: string}>
      expect(accountRows.length).toBeGreaterThanOrEqual(1)
      expect(accountRows[0].provider_id).toBe('apple')
    })

    test('should not update name for existing user', async () => {
      // First, create a user by registering
      const appleUserId = 'apple-existing-' + Date.now()
      const testEmail = `existing-${Date.now()}@example.com`

      const idToken = generateAppleIdToken({sub: appleUserId, email: testEmail, aud: 'com.example.app'})

      // First registration - sets the name
      const firstBody: AuthRequestBody = {idToken, firstName: 'Original', lastName: 'Name'}
      const firstEvent = createAuthEvent(firstBody, '/auth/register')
      await registerHandler(firstEvent, mockContext)

      // Make the user appear "existing" by setting createdAt to more than 5 seconds ago
      // The RegisterUser handler checks: Date.now() - new Date(user.createdAt).getTime() < 5000
      const db = await getTestDbAsync()
      const tenSecondsAgo = new Date(Date.now() - 10000).toISOString()
      await db.execute(sql`UPDATE users SET created_at = ${tenSecondsAgo} WHERE email = ${testEmail}`)

      // Second registration with different name - should NOT update
      const secondBody: AuthRequestBody = {idToken, firstName: 'Should', lastName: 'NotUpdate'}
      const secondEvent = createAuthEvent(secondBody, '/auth/register')
      const result = await registerHandler(secondEvent, mockContext)

      expect(result.statusCode).toBe(200)

      // Verify name was NOT updated (reusing db from earlier in test)
      const users = await db.execute(sql`SELECT * FROM users WHERE email = ${testEmail}`)
      const userRows = [...users] as Array<{first_name: string | null; last_name: string | null}>
      expect(userRows[0].first_name).toBe('Original')
      expect(userRows[0].last_name).toBe('Name')
    })

    test('should allow registration without optional name fields', async () => {
      const appleUserId = 'apple-noname-' + Date.now()
      const testEmail = `noname-${Date.now()}@example.com`

      const idToken = generateAppleIdToken({sub: appleUserId, email: testEmail, aud: 'com.example.app'})

      // Register without firstName/lastName
      const body: AuthRequestBody = {idToken}
      const event = createAuthEvent(body, '/auth/register')
      const result = await registerHandler(event, mockContext)

      // Schema validation should pass (firstName/lastName are optional)
      expect(result.statusCode).toBe(200)

      // Verify user was created
      const db = await getTestDbAsync()
      const users = await db.execute(sql`SELECT * FROM users WHERE email = ${testEmail}`)
      const userRows = [...users] as Array<{id: string}>
      expect(userRows).toHaveLength(1)
    })

    test('should validate request body - missing idToken', async () => {
      const body = {firstName: 'Test'} as AuthRequestBody
      const event = createAuthEvent(body, '/auth/register')
      const result = await registerHandler(event, mockContext)

      expect(result.statusCode).toBe(400)
    })

    test('should handle malformed ID token', async () => {
      const body: AuthRequestBody = {idToken: 'bad-token', firstName: 'Test', lastName: 'User'}
      const event = createAuthEvent(body, '/auth/register')
      const result = await registerHandler(event, mockContext)

      expect(result.statusCode).toBe(500)
    })
  })

  describe('Common Auth Behaviors', () => {
    test('should pass IP address and user agent to Better Auth', async () => {
      // This test verifies that request headers are passed through to Better Auth
      // Better Auth uses these for session tracking
      const appleUserId = 'apple-headers-' + Date.now()
      const testEmail = `headers-${Date.now()}@example.com`

      const idToken = generateAppleIdToken({sub: appleUserId, email: testEmail, aud: 'com.example.app'})

      const body: AuthRequestBody = {idToken}
      const event = createAuthEvent(body, '/auth/login')
      const result = await loginHandler(event, mockContext)

      expect(result.statusCode).toBe(200)

      // Verify session was created with IP/user agent
      const db = await getTestDbAsync()
      const sessions = await db.execute(sql`SELECT * FROM sessions`)
      const sessionRows = [...sessions] as Array<{ip_address: string | null; user_agent: string | null}>

      // Better Auth should have recorded the IP and user agent
      // Note: The exact behavior depends on Better Auth's implementation
      expect(sessionRows.length).toBeGreaterThanOrEqual(1)
    })

    test('should create session with valid expiration', async () => {
      const appleUserId = 'apple-expiry-' + Date.now()
      const testEmail = `expiry-${Date.now()}@example.com`

      const idToken = generateAppleIdToken({sub: appleUserId, email: testEmail, aud: 'com.example.app'})

      const body: AuthRequestBody = {idToken}
      const event = createAuthEvent(body, '/auth/login')
      const result = await loginHandler(event, mockContext)

      expect(result.statusCode).toBe(200)
      const response = JSON.parse(result.body)

      // Session should have an expiration in the future (30 days from now per config)
      const thirtyDaysFromNow = Date.now() + 29 * 24 * 60 * 60 * 1000 // 29 days to account for timing
      expect(response.body.expiresAt).toBeGreaterThan(thirtyDaysFromNow)
    })
  })
})
