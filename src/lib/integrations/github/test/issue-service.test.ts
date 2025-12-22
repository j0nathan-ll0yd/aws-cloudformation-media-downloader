import {beforeEach, describe, expect, jest, test} from '@jest/globals'
import type {Device} from '#types/domain-models'

// Mock Octokit
const mockIssuesCreate = jest.fn<(params: object) => Promise<{status: number; data: {id: number; number: number; html_url: string}}>>()

class MockOctokit {
  public rest: {issues: {create: typeof mockIssuesCreate}}
  constructor() {
    this.rest = {issues: {create: mockIssuesCreate}}
  }
}

jest.unstable_mockModule('@octokit/rest', () => ({Octokit: jest.fn().mockImplementation(() => new MockOctokit())}))

// Mock template helpers
const mockRenderGithubIssueTemplate = jest.fn<(templateName: string, data: object) => string>()
mockRenderGithubIssueTemplate.mockImplementation((templateName: string) => `Rendered template: ${templateName}`)

jest.unstable_mockModule('../templates', () => ({renderGithubIssueTemplate: mockRenderGithubIssueTemplate}))

const {createFailedUserDeletionIssue, createVideoDownloadFailureIssue, createCookieExpirationIssue} = await import('../issue-service')

describe('#Util:GithubHelper', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.GithubPersonalToken = 'test-token'
  })

  describe('#createFailedUserDeletionIssue', () => {
    test('should create GitHub issue for user deletion failure', async () => {
      const userId = 'test-user-123'
      const device: Device = {
        deviceId: 'device-123',
        name: 'iPhone',
        systemName: 'iOS',
        systemVersion: '17.0',
        token: 'device-token',
        endpointArn: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/test/abc123'
      }
      const error = new Error('DynamoDB deletion failed')
      const requestId = 'req-123'

      mockIssuesCreate.mockResolvedValue({status: 201, data: {id: 1234, number: 42, html_url: 'https://github.com/owner/repo/issues/42'}})

      const response = await createFailedUserDeletionIssue(userId, [device], error, requestId)

      expect(response).not.toBeNull()
      expect(response?.status).toEqual(201)
      expect(response?.data.id).toEqual(1234)
      expect(mockIssuesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'j0nathan-ll0yd',
          repo: 'aws-cloudformation-media-downloader',
          title: `User Deletion Failed: ${userId}`,
          body: expect.stringContaining('Rendered template: user-deletion-failure'),
          labels: expect.arrayContaining(['bug', 'user-management', 'automated', 'requires-manual-fix'])
        })
      )
    })

    test('should return null when GitHub API fails', async () => {
      const userId = 'test-user-123'
      const device: Device = {
        deviceId: 'device-123',
        name: 'iPhone',
        systemName: 'iOS',
        systemVersion: '17.0',
        token: 'device-token',
        endpointArn: 'arn:aws:sns:us-west-2:123456789012:endpoint/APNS/test/abc123'
      }
      const error = new Error('DynamoDB deletion failed')
      const requestId = 'req-123'

      mockIssuesCreate.mockRejectedValue(new Error('GitHub API rate limit exceeded'))

      const response = await createFailedUserDeletionIssue(userId, [device], error, requestId)

      expect(response).toBeNull()
    })
  })

  describe('#createVideoDownloadFailureIssue', () => {
    test('should create GitHub issue for video download failure', async () => {
      const fileId = 'video-123'
      const fileUrl = 'https://www.youtube.com/watch?v=test123'
      const error = new Error('yt-dlp extraction failed')
      const errorDetails = 'Video unavailable: Removed by uploader'

      mockIssuesCreate.mockResolvedValue({status: 201, data: {id: 5678, number: 43, html_url: 'https://github.com/owner/repo/issues/43'}})

      const response = await createVideoDownloadFailureIssue(fileId, fileUrl, error, errorDetails)

      expect(response).not.toBeNull()
      expect(response?.status).toEqual(201)
      expect(response?.data.id).toEqual(5678)
      expect(mockIssuesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'j0nathan-ll0yd',
          repo: 'aws-cloudformation-media-downloader',
          title: `Video Download Failed: ${fileId}`,
          body: expect.stringContaining('Rendered template: video-download-failure'),
          labels: expect.arrayContaining(['bug', 'video-download', 'automated'])
        })
      )
    })

    test('should create GitHub issue without error details', async () => {
      const fileId = 'video-456'
      const fileUrl = 'https://www.youtube.com/watch?v=test456'
      const error = new Error('Network timeout')

      mockIssuesCreate.mockResolvedValue({status: 201, data: {id: 9012, number: 44, html_url: 'https://github.com/owner/repo/issues/44'}})

      const response = await createVideoDownloadFailureIssue(fileId, fileUrl, error)

      expect(response).not.toBeNull()
      expect(response?.status).toEqual(201)
      expect(response?.data.id).toEqual(9012)
    })

    test('should return null when GitHub API fails', async () => {
      const fileId = 'video-123'
      const fileUrl = 'https://www.youtube.com/watch?v=test123'
      const error = new Error('yt-dlp extraction failed')

      mockIssuesCreate.mockRejectedValue(new Error('Network error'))

      const response = await createVideoDownloadFailureIssue(fileId, fileUrl, error)

      expect(response).toBeNull()
    })
  })

  describe('#createCookieExpirationIssue', () => {
    test('should create GitHub issue for cookie expiration', async () => {
      const fileId = 'video-789'
      const fileUrl = 'https://www.youtube.com/watch?v=test789'
      const error = new Error('Sign in to confirm you are not a bot')

      mockIssuesCreate.mockResolvedValue({status: 201, data: {id: 3456, number: 45, html_url: 'https://github.com/owner/repo/issues/45'}})

      const response = await createCookieExpirationIssue(fileId, fileUrl, error)

      expect(response).not.toBeNull()
      expect(response?.status).toEqual(201)
      expect(response?.data.id).toEqual(3456)
      expect(mockIssuesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'j0nathan-ll0yd',
          repo: 'aws-cloudformation-media-downloader',
          title: '🍪 YouTube Cookie Expiration Detected',
          body: expect.stringContaining('Rendered template: cookie-expiration'),
          labels: expect.arrayContaining(['cookie-expiration', 'requires-manual-fix', 'automated', 'priority'])
        })
      )
    })

    test('should return null when GitHub API fails', async () => {
      const fileId = 'video-789'
      const fileUrl = 'https://www.youtube.com/watch?v=test789'
      const error = new Error('Sign in to confirm you are not a bot')

      mockIssuesCreate.mockRejectedValue(new Error('GitHub API error'))

      const response = await createCookieExpirationIssue(fileId, fileUrl, error)

      expect(response).toBeNull()
    })
  })
})
