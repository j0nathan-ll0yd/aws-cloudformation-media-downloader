import {beforeEach, describe, expect, it, jest} from '@jest/globals'
import type {Context, ScheduledEvent} from 'aws-lambda'

// Mock Drizzle client with proper chaining
const mockReturning = jest.fn<() => Promise<Array<{fileId?: string; sessionId?: string; token?: string}>>>()
const mockWhere = jest.fn(() => ({returning: mockReturning}))
const mockDelete = jest.fn(() => ({where: mockWhere}))

jest.unstable_mockModule('#lib/vendor/Drizzle/client', () => ({getDrizzleClient: jest.fn(async () => ({delete: mockDelete}))}))

// Mock Drizzle schema - provide table references for delete()
jest.unstable_mockModule('#lib/vendor/Drizzle/schema',
  () => ({
    fileDownloads: {fileId: 'fileId', status: 'status', updatedAt: 'updatedAt'},
    sessions: {sessionId: 'sessionId', expiresAt: 'expiresAt'},
    verificationTokens: {token: 'token', expiresAt: 'expiresAt'}
  }))

// Mock logging
jest.unstable_mockModule('#lib/system/logging', () => ({logDebug: jest.fn(), logError: jest.fn(), logInfo: jest.fn()}))

// Mock middleware
jest.unstable_mockModule('#lib/lambda/middleware/powertools',
  () => ({withPowertools: jest.fn(<T extends (...args: never[]) => unknown>(handler: T) => handler)}))

jest.unstable_mockModule('#lib/lambda/middleware/internal',
  () => ({wrapScheduledHandler: jest.fn(<T extends (...args: never[]) => unknown>(handler: T) => handler)}))

// Mock drizzle-orm operators
jest.unstable_mockModule('drizzle-orm',
  () => ({
    and: jest.fn((...args: unknown[]) => args),
    or: jest.fn((...args: unknown[]) => args),
    eq: jest.fn((col: unknown, val: unknown) => ({col, val})),
    lt: jest.fn((col: unknown, val: unknown) => ({col, val}))
  }))

// Import handler after all mocks are set up
const {handler} = await import('./../src')

const createScheduledEvent = (): ScheduledEvent => ({
  version: '0',
  id: 'test-id',
  'detail-type': 'Scheduled Event',
  source: 'aws.events',
  account: '123456789012',
  time: new Date().toISOString(),
  region: 'us-west-2',
  resources: ['arn:aws:events:us-west-2:123456789012:rule/test-rule'],
  detail: {}
})

const createContext = (): Context => ({
  callbackWaitsForEmptyEventLoop: true,
  functionName: 'CleanupExpiredRecords',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:us-west-2:123456789012:function:CleanupExpiredRecords',
  memoryLimitInMB: '256',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/CleanupExpiredRecords',
  logStreamName: '2024/01/01/[$LATEST]test',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {}
})

describe('CleanupExpiredRecords Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockReturning.mockResolvedValue([])
  })

  it('should successfully cleanup all record types', async () => {
    mockReturning.mockResolvedValueOnce([{fileId: 'file1'}]) // fileDownloads
      .mockResolvedValueOnce([{sessionId: 'session1'}, {sessionId: 'session2'}]) // sessions
      .mockResolvedValueOnce([]) // verificationTokens

    const result = await handler(createScheduledEvent(), createContext())

    expect(result).toEqual({fileDownloadsDeleted: 1, sessionsDeleted: 2, verificationTokensDeleted: 0, errors: []})
  })

  it('should continue cleanup when one type fails', async () => {
    mockReturning.mockRejectedValueOnce(new Error('Database connection failed')) // fileDownloads fails
      .mockResolvedValueOnce([{sessionId: 'session1'}]) // sessions succeeds
      .mockResolvedValueOnce([{token: 'token1'}]) // verificationTokens succeeds

    const result = await handler(createScheduledEvent(), createContext())

    expect(result.fileDownloadsDeleted).toBe(0)
    expect(result.sessionsDeleted).toBe(1)
    expect(result.verificationTokensDeleted).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('FileDownloads cleanup failed')
  })

  it('should collect all errors when multiple cleanups fail', async () => {
    mockReturning.mockRejectedValueOnce(new Error('Error 1')).mockRejectedValueOnce(new Error('Error 2')).mockRejectedValueOnce(new Error('Error 3'))

    const result = await handler(createScheduledEvent(), createContext())

    expect(result.errors).toHaveLength(3)
    expect(result.fileDownloadsDeleted).toBe(0)
    expect(result.sessionsDeleted).toBe(0)
    expect(result.verificationTokensDeleted).toBe(0)
  })
})
