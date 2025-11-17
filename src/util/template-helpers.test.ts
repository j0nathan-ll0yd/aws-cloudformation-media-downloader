import {describe, expect, test} from '@jest/globals'
import {renderGithubIssueTemplate} from './template-helpers'

describe('#template-helpers', () => {
  describe('renderGithubIssueTemplate', () => {
    test('should render user-deletion-failure template with all variables', () => {
      const mockError = new Error('DynamoDB conditional check failed')
      mockError.stack = 'Error: DynamoDB conditional check failed\n    at Object.deleteUser (/var/task/index.js:123:45)'

      const result = renderGithubIssueTemplate('user-deletion-failure', {
        userId: 'test-user-123',
        devices: [
          {deviceToken: 'device-token-1', platform: 'iOS', updatedAt: '2024-01-01T00:00:00.000Z'},
          {deviceToken: 'device-token-2', platform: 'iOS', updatedAt: '2024-01-02T00:00:00.000Z'}
        ],
        error: mockError,
        requestId: 'req-abc-123'
      })

      // Verify core content is present
      expect(result).toContain('## User Deletion Failed')
      expect(result).toContain('test-user-123')
      expect(result).toContain('req-abc-123')
      expect(result).toContain('DynamoDB conditional check failed')
      expect(result).toContain('device-token-1')
      expect(result).toContain('device-token-2')
      expect(result).toContain('This user had **2** registered device(s)')
      expect(result).toContain(mockError.stack)

      // Verify template variables were replaced (bash variables like ${BUCKET_NAME} are OK)
      expect(result).not.toContain('${userId}')
      expect(result).not.toContain('${devices}')
      expect(result).not.toContain('${error}')
      expect(result).not.toContain('${requestId}')
    })

    test('should render user-deletion-failure template with no devices', () => {
      const mockError = new Error('Test error')

      const result = renderGithubIssueTemplate('user-deletion-failure', {
        userId: 'test-user-456',
        devices: [],
        error: mockError,
        requestId: 'req-def-456'
      })

      expect(result).toContain('No devices were registered for this user')
      expect(result).not.toContain('This user had')
    })

    test('should render video-download-failure template with error details', () => {
      const mockError = new Error('yt-dlp process exited with code 1')
      mockError.stack = 'Error: yt-dlp process exited with code 1\n    at streamVideoToS3'

      const result = renderGithubIssueTemplate('video-download-failure', {
        fileId: 'file-123',
        fileUrl: 'https://youtube.com/watch?v=test',
        error: mockError,
        errorDetails: "ERROR: [youtube] test: Sign in to confirm you're not a bot"
      })

      expect(result).toContain('## Video Download Failure')
      expect(result).toContain('file-123')
      expect(result).toContain('https://youtube.com/watch?v=test')
      expect(result).toContain('yt-dlp process exited with code 1')
      expect(result).toContain('## Additional Details')
      expect(result).toContain("Sign in to confirm you're not a bot")
      expect(result).toContain(mockError.stack)

      // Verify template variables were replaced
      expect(result).not.toContain('${fileId}')
      expect(result).not.toContain('${fileUrl}')
      expect(result).not.toContain('${error.message}')
      expect(result).not.toContain('${errorDetails}')
    })

    test('should render video-download-failure template without error details', () => {
      const mockError = new Error('Network timeout')

      const result = renderGithubIssueTemplate('video-download-failure', {
        fileId: 'file-456',
        fileUrl: 'https://youtube.com/watch?v=test2',
        error: mockError,
        errorDetails: undefined
      })

      expect(result).toContain('Network timeout')
      expect(result).not.toContain('## Additional Details')

      // Verify template variables were replaced
      expect(result).not.toContain('${fileId}')
      expect(result).not.toContain('${fileUrl}')
      expect(result).not.toContain('${error.message}')
    })

    test('should render cookie-expiration template with all variables', () => {
      const mockError = new Error("Sign in to confirm you're not a bot")
      mockError.stack = 'CookieExpirationError: Sign in to confirm\n    at fetchVideoInfo'

      const result = renderGithubIssueTemplate('cookie-expiration', {
        fileId: 'file-789',
        fileUrl: 'https://youtube.com/watch?v=test3',
        error: mockError
      })

      expect(result).toContain('## YouTube Cookie Expiration')
      expect(result).toContain('file-789')
      expect(result).toContain('https://youtube.com/watch?v=test3')
      expect(result).toContain("Sign in to confirm you're not a bot")
      expect(result).toContain('npm run update-cookies')
      expect(result).toContain('npm run build')
      expect(result).toContain('npm run deploy')
      expect(result).toContain(mockError.stack)

      // Verify template variables were replaced
      expect(result).not.toContain('${fileId}')
      expect(result).not.toContain('${fileUrl}')
      expect(result).not.toContain('${error.message}')
    })

    test('should handle errors with missing stack traces', () => {
      const mockError = new Error('Test error without stack')
      delete mockError.stack

      const result = renderGithubIssueTemplate('video-download-failure', {
        fileId: 'file-999',
        fileUrl: 'https://youtube.com/watch?v=test4',
        error: mockError,
        errorDetails: undefined
      })

      expect(result).toContain('No stack trace available')
      expect(result).not.toContain('undefined')
    })

    test('should support JavaScript expressions in templates', () => {
      const mockError = new Error('Test')

      const result = renderGithubIssueTemplate('video-download-failure', {
        fileId: 'file-expr',
        fileUrl: 'https://youtube.com/watch?v=expr',
        error: mockError,
        errorDetails: undefined
      })

      // Template uses new Date().toISOString() - verify format
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/)
    })
  })
})
