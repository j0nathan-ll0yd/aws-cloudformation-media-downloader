/**
 * Auth Flow Integration Tests
 *
 * Tests the LoginUser and RegisterUser workflows with Better Auth:
 * 1. Register new user - creates User, Session, Account entities via Better Auth
 * 2. Login existing user - validates credentials, creates session
 * 3. Login with invalid credentials - returns error
 * 4. Handle new user name update from iOS app
 *
 * Note: Better Auth handles OAuth verification and entity creation internally.
 * We mock the Better Auth module to test our Lambda orchestration logic.
 */

// Test configuration
const TEST_TABLE = 'test-auth-flow'

// Set environment variables for Lambda
process.env.DYNAMODB_TABLE_NAME = TEST_TABLE
process.env.USE_LOCALSTACK = 'true'

// Required env vars
process.env.DEFAULT_FILE_SIZE = '1024'
process.env.DEFAULT_FILE_NAME = 'test-default-file.mp4'
process.env.DEFAULT_FILE_URL = 'https://example.com/test-default-file.mp4'
process.env.DEFAULT_FILE_CONTENT_TYPE = 'video/mp4'
process.env.BETTER_AUTH_SECRET = 'test-secret-key-for-better-auth-32-chars'
process.env.BetterAuthUrl = 'https://api.example.com'

import {afterAll, beforeAll, beforeEach, describe, expect, test, vi} from 'vitest'
import type {Context} from 'aws-lambda'

// Test helpers
import {createFilesTable, deleteFilesTable} from '../helpers/postgres-helpers'
import {createMockContext} from '../helpers/lambda-context'
import {createEntityMock} from '../../helpers/entity-mock'

import {fileURLToPath} from 'url'
import {dirname, resolve} from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Mock Better Auth config module
const betterAuthConfigPath = resolve(__dirname, '../../../src/lib/vendor/BetterAuth/config')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const signInSocialMock = vi.fn<any>()

// getAuth is now async - return a Promise resolving to the auth object
vi.mock(betterAuthConfigPath, () => ({getAuth: async () => ({api: {signInSocial: signInSocialMock}})}))

// Mock Users entity for RegisterUser name update
const usersModulePath = resolve(__dirname, '../../../src/entities/Users')
const usersMock = createEntityMock()
vi.mock(usersModulePath, () => ({Users: usersMock.entity}))

// Import handlers after mocking
const {handler: loginHandler} = await import('../../../src/lambdas/LoginUser/src/index')
const {handler: registerHandler} = await import('../../../src/lambdas/RegisterUser/src/index')

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

describe('Auth Flow Integration Tests', () => {
  let mockContext: Context

  beforeAll(async () => {
    await createFilesTable()
    await new Promise((resolve) => setTimeout(resolve, 1000))
    mockContext = createMockContext()
  })

  afterAll(async () => {
    await deleteFilesTable()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock for Users.update
    usersMock.mocks.update.go.mockResolvedValue({data: {}})
  })

  describe('LoginUser', () => {
    test('should login existing user with valid ID token', async () => {
      const userId = 'user-existing-123'
      const sessionId = 'session-abc'
      const token = 'session-token-xyz'
      const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000

      signInSocialMock.mockResolvedValue({
        redirect: false,
        token,
        url: undefined,
        user: {
          id: userId,
          createdAt: new Date(Date.now() - 1000000), // Created in the past
          email: 'test@example.com',
          name: 'Test User'
        },
        session: {id: sessionId, expiresAt}
      })

      const body: AuthRequestBody = {idToken: 'valid-apple-id-token'}
      const event = createAuthEvent(body, '/auth/login')
      const result = await loginHandler(event, mockContext)

      expect(result.statusCode).toBe(200)
      const response = JSON.parse(result.body)
      expect(response.body.token).toBe(token)
      expect(response.body.userId).toBe(userId)
      expect(response.body.sessionId).toBe(sessionId)

      // Verify Better Auth was called with correct params
      expect(signInSocialMock).toHaveBeenCalledWith(expect.objectContaining({body: {provider: 'apple', idToken: {token: 'valid-apple-id-token'}}}))
    })

    test('should return error for invalid ID token', async () => {
      signInSocialMock.mockRejectedValue(new Error('Invalid ID token'))

      const body: AuthRequestBody = {idToken: 'invalid-token'}
      const event = createAuthEvent(body, '/auth/login')
      const result = await loginHandler(event, mockContext)

      expect(result.statusCode).toBe(500)
    })

    test('should validate request body - missing idToken', async () => {
      const body = {} as AuthRequestBody
      const event = createAuthEvent(body, '/auth/login')
      const result = await loginHandler(event, mockContext)

      expect(result.statusCode).toBe(400)
    })

    test('should handle Better Auth redirect response as error', async () => {
      // Simulate unexpected redirect (which shouldn't happen for ID token flow)
      signInSocialMock.mockResolvedValue({
        redirect: true,
        token: '',
        url: 'https://redirect.example.com' as unknown as undefined,
        user: {id: '', createdAt: new Date(), email: '', name: ''}
      })

      const body: AuthRequestBody = {idToken: 'redirect-token'}
      const event = createAuthEvent(body, '/auth/login')
      const result = await loginHandler(event, mockContext)

      expect(result.statusCode).toBe(500)
    })
  })

  describe('RegisterUser', () => {
    test('should register new user and return session token', async () => {
      const userId = 'user-new-456'
      const sessionId = 'session-new-abc'
      const token = 'new-session-token'
      const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000

      signInSocialMock.mockResolvedValue({
        redirect: false,
        token,
        url: undefined,
        user: {
          id: userId,
          createdAt: new Date(), // Just created
          email: 'newuser@example.com',
          name: ''
        },
        session: {id: sessionId, expiresAt}
      })

      const body: AuthRequestBody = {idToken: 'valid-apple-id-token', firstName: 'John', lastName: 'Doe'}
      const event = createAuthEvent(body, '/auth/register')
      const result = await registerHandler(event, mockContext)

      expect(result.statusCode).toBe(200)
      const response = JSON.parse(result.body)
      expect(response.body.token).toBe(token)
      expect(response.body.userId).toBe(userId)

      // Verify name update was called for new user (uses 'id' per Better Auth schema)
      expect(usersMock.entity.update).toHaveBeenCalledWith({id: userId})
    })

    test('should not update name for existing user', async () => {
      const userId = 'user-existing-789'
      const sessionId = 'session-existing'
      const token = 'existing-session-token'
      const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000

      signInSocialMock.mockResolvedValue({
        redirect: false,
        token,
        url: undefined,
        user: {
          id: userId,
          createdAt: new Date(Date.now() - 1000000), // Created long ago
          email: 'existing@example.com',
          name: 'Existing User'
        },
        session: {id: sessionId, expiresAt}
      })

      const body: AuthRequestBody = {idToken: 'valid-apple-id-token', firstName: 'Should', lastName: 'NotUpdate'}
      const event = createAuthEvent(body, '/auth/register')
      const result = await registerHandler(event, mockContext)

      expect(result.statusCode).toBe(200)

      // Should NOT update name for existing user
      expect(usersMock.entity.update).not.toHaveBeenCalled()
    })

    test('should allow registration without optional name fields', async () => {
      // registerUserSchema has firstName and lastName as optional
      const userId = 'user-no-name-123'
      const sessionId = 'session-no-name'
      const token = 'no-name-session-token'
      const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000

      signInSocialMock.mockResolvedValue({
        redirect: false,
        token,
        url: undefined,
        user: {id: userId, createdAt: new Date(), email: 'noname@example.com', name: ''},
        session: {id: sessionId, expiresAt}
      })

      const body: AuthRequestBody = {idToken: 'valid-apple-id-token'}
      const event = createAuthEvent(body, '/auth/register')
      const result = await registerHandler(event, mockContext)

      // Schema validation should pass (firstName/lastName are optional)
      expect(result.statusCode).toBe(200)

      // Better Auth should be called
      expect(signInSocialMock).toHaveBeenCalled()
    })

    test('should validate request body - missing idToken', async () => {
      const body = {firstName: 'Test'} as AuthRequestBody
      const event = createAuthEvent(body, '/auth/register')
      const result = await registerHandler(event, mockContext)

      expect(result.statusCode).toBe(400)
    })

    test('should handle Better Auth failure', async () => {
      signInSocialMock.mockRejectedValue(new Error('Apple verification failed'))

      // Must include firstName/lastName to pass schema validation
      const body: AuthRequestBody = {idToken: 'bad-token', firstName: 'Test', lastName: 'User'}
      const event = createAuthEvent(body, '/auth/register')
      const result = await registerHandler(event, mockContext)

      expect(result.statusCode).toBe(500)
    })
  })

  describe('Common Auth Behaviors', () => {
    test('should pass IP address and user agent to Better Auth', async () => {
      const userId = 'user-headers'
      signInSocialMock.mockResolvedValue({
        redirect: false,
        token: 'test-token',
        url: undefined,
        user: {id: userId, createdAt: new Date(Date.now() - 100000), email: 'test@example.com', name: 'Test'},
        session: {id: 'session-123', expiresAt: Date.now() + 86400000}
      })

      const body: AuthRequestBody = {idToken: 'valid-token'}
      const event = createAuthEvent(body, '/auth/login')
      await loginHandler(event, mockContext)

      expect(signInSocialMock).toHaveBeenCalledWith(
        expect.objectContaining({headers: expect.objectContaining({'user-agent': 'iOS/17.0 TestApp/1.0', 'x-forwarded-for': '127.0.0.1'})})
      )
    })

    test('should return default expiration if session missing expiresAt', async () => {
      const userId = 'user-no-expiry'
      signInSocialMock.mockResolvedValue({
        redirect: false,
        token: 'test-token',
        url: undefined,
        user: {id: userId, createdAt: new Date(Date.now() - 100000), email: 'test@example.com', name: 'Test'},
        session: undefined
      })

      const body: AuthRequestBody = {idToken: 'valid-token'}
      const event = createAuthEvent(body, '/auth/login')
      const result = await loginHandler(event, mockContext)

      expect(result.statusCode).toBe(200)
      const response = JSON.parse(result.body)
      // Should have a default expiration (30 days from now)
      expect(response.body.expiresAt).toBeGreaterThan(Date.now())
    })
  })
})
