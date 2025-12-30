import {describe, expect, test} from 'vitest'
import {renderGithubIssueTemplate} from '../templates'

describe('#template-helpers', () => {
  describe('renderGithubIssueTemplate', () => {
    test('should render user-deletion-failure template with all variables', () => {
      const devices = [
        {deviceToken: 'device-token-1', platform: 'iOS', updatedAt: '2024-01-01T00:00:00.000Z'},
        {deviceToken: 'device-token-2', platform: 'iOS', updatedAt: '2024-01-02T00:00:00.000Z'}
      ]
      const mockError = new Error('DynamoDB conditional check failed')
      mockError.stack = 'Error: DynamoDB conditional check failed\n    at Object.deleteUser (/var/task/index.js:123:45)'

      const result = renderGithubIssueTemplate('user-deletion-failure', {
        userId: 'test-user-123',
        requestId: 'req-abc-123',
        deviceCount: devices.length,
        hasDevices: devices.length > 0,
        devicesJson: JSON.stringify(devices, null, 2),
        errorMessage: mockError.message,
        errorName: mockError.constructor.name,
        errorStack: mockError.stack ?? 'No stack trace available',
        timestamp: '2024-01-15T12:00:00.000Z'
      })

      // Verify core content is present
      expect(result).toContain('## User Deletion Failed')
      expect(result).toContain('test-user-123')
      expect(result).toContain('req-abc-123')
      expect(result).toContain('DynamoDB conditional check failed')
      expect(result).toContain('device-token-1')
      expect(result).toContain('device-token-2')
      expect(result).toContain('**Device Count**: 2')
      expect(result).toContain(mockError.stack)

      // Verify template variables were replaced
      expect(result).not.toContain('${userId}')
      expect(result).not.toContain('${deviceCount}')
      expect(result).not.toContain('${errorMessage}')
      expect(result).not.toContain('${requestId}')
    })

    test('should render user-deletion-failure template with no devices', () => {
      const mockError = new Error('Test error')

      const result = renderGithubIssueTemplate('user-deletion-failure', {
        userId: 'test-user-456',
        requestId: 'req-def-456',
        deviceCount: 0,
        hasDevices: false,
        devicesJson: '',
        errorMessage: mockError.message,
        errorName: mockError.constructor.name,
        errorStack: mockError.stack ?? 'No stack trace available',
        timestamp: '2024-01-15T12:00:00.000Z'
      })

      expect(result).toContain('**Device Count**: 0')
    })

    test('should render video-download-failure template with error details', () => {
      const mockError = new Error('yt-dlp process exited with code 1')
      mockError.stack = 'Error: yt-dlp process exited with code 1\n    at streamVideoToS3'

      const result = renderGithubIssueTemplate('video-download-failure', {
        fileId: 'file-123',
        fileUrl: 'https://youtube.com/watch?v=test',
        errorMessage: mockError.message,
        errorName: mockError.constructor.name,
        errorStack: mockError.stack ?? 'No stack trace available',
        errorDetails: "ERROR: [youtube] test: Sign in to confirm you're not a bot",
        hasErrorDetails: true,
        timestamp: '2024-01-15T12:00:00.000Z'
      })

      expect(result).toContain('## Video Download Failure')
      expect(result).toContain('file-123')
      expect(result).toContain('https://youtube.com/watch?v=test')
      expect(result).toContain('yt-dlp process exited with code 1')
      expect(result).toContain(mockError.stack)

      // Verify template variables were replaced
      expect(result).not.toContain('${fileId}')
      expect(result).not.toContain('${fileUrl}')
      expect(result).not.toContain('${errorMessage}')
    })

    test('should render video-download-failure template without error details', () => {
      const mockError = new Error('Network timeout')

      const result = renderGithubIssueTemplate('video-download-failure', {
        fileId: 'file-456',
        fileUrl: 'https://youtube.com/watch?v=test2',
        errorMessage: mockError.message,
        errorName: mockError.constructor.name,
        errorStack: mockError.stack ?? 'No stack trace available',
        errorDetails: '',
        hasErrorDetails: false,
        timestamp: '2024-01-15T12:00:00.000Z'
      })

      expect(result).toContain('Network timeout')

      // Verify template variables were replaced
      expect(result).not.toContain('${fileId}')
      expect(result).not.toContain('${fileUrl}')
      expect(result).not.toContain('${errorMessage}')
    })

    test('should render cookie-expiration template with all variables', () => {
      const mockError = new Error("Sign in to confirm you're not a bot")
      mockError.stack = 'CookieExpirationError: Sign in to confirm\n    at fetchVideoInfo'

      const result = renderGithubIssueTemplate('cookie-expiration', {
        fileId: 'file-789',
        fileUrl: 'https://youtube.com/watch?v=test3',
        errorMessage: mockError.message,
        errorName: mockError.constructor.name,
        errorStack: mockError.stack ?? 'No stack trace available',
        timestamp: '2024-01-15T12:00:00.000Z'
      })

      expect(result).toContain('## YouTube Cookie Expiration')
      expect(result).toContain('file-789')
      expect(result).toContain('https://youtube.com/watch?v=test3')
      expect(result).toContain("Sign in to confirm you're not a bot")
      expect(result).toContain('pnpm run update-cookies')
      expect(result).toContain('pnpm run build')
      expect(result).toContain('pnpm run deploy')
      expect(result).toContain(mockError.stack)

      // Verify template variables were replaced
      expect(result).not.toContain('${fileId}')
      expect(result).not.toContain('${fileUrl}')
      expect(result).not.toContain('${errorMessage}')
    })

    test('should handle errors with missing stack traces', () => {
      const result = renderGithubIssueTemplate('video-download-failure', {
        fileId: 'file-999',
        fileUrl: 'https://youtube.com/watch?v=test4',
        errorMessage: 'Test error without stack',
        errorName: 'Error',
        errorStack: 'No stack trace available',
        errorDetails: '',
        hasErrorDetails: false,
        timestamp: '2024-01-15T12:00:00.000Z'
      })

      expect(result).toContain('No stack trace available')
      expect(result).not.toContain('undefined')
    })

    test('should use simple variable replacement (no expressions)', () => {
      const result = renderGithubIssueTemplate('video-download-failure', {
        fileId: 'file-expr',
        fileUrl: 'https://youtube.com/watch?v=expr',
        errorMessage: 'Test',
        errorName: 'Error',
        errorStack: 'Stack trace here',
        errorDetails: '',
        hasErrorDetails: false,
        timestamp: '2024-01-15T10:30:00.000Z'
      })

      // Verify the pre-computed timestamp is used (not dynamic)
      expect(result).toContain('2024-01-15T10:30:00.000Z')
    })
  })
})
