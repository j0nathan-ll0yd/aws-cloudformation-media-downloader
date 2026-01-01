import {describe, expect, it} from 'vitest'
import {
  createInsertSchema,
  deviceInsertSchema,
  deviceSelectSchema,
  fileDownloadInsertSchema,
  fileDownloadUpdateSchema,
  fileInsertSchema,
  fileSelectSchema,
  fileUpdateSchema,
  sessionInsertSchema,
  userDeviceInsertSchema,
  userFileInsertSchema,
  userInsertSchema,
  userSelectSchema
} from '../zod-schemas'
import {DownloadStatus, FileStatus} from '#types/shared-primitives'

describe('Drizzle Zod Schemas', () => {
  describe('userInsertSchema', () => {
    it('validates a valid user insert with required fields', () => {
      const result = userInsertSchema.safeParse({email: 'test@example.com', emailVerified: false})
      expect(result.success).toBe(true)
    })

    it('validates a user insert with all optional fields', () => {
      const result = userInsertSchema.safeParse({
        email: 'test@example.com',
        emailVerified: true,
        name: 'Test User',
        image: 'https://example.com/avatar.png',
        firstName: 'Test',
        lastName: 'User',
        appleDeviceId: 'apple-device-123'
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid email type', () => {
      const result = userInsertSchema.safeParse({email: 123, emailVerified: false})
      expect(result.success).toBe(false)
    })

    it('rejects missing required email field', () => {
      const result = userInsertSchema.safeParse({emailVerified: false})
      expect(result.success).toBe(false)
    })
  })

  describe('userSelectSchema', () => {
    it('validates a complete user select result', () => {
      const result = userSelectSchema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'test@example.com',
        emailVerified: true,
        name: 'Test User',
        image: null,
        firstName: 'Test',
        lastName: 'User',
        appleDeviceId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      expect(result.success).toBe(true)
    })
  })

  describe('fileInsertSchema', () => {
    it('validates required fields for file insert', () => {
      const result = fileInsertSchema.safeParse({
        fileId: 'dQw4w9WgXcQ',
        authorName: 'Rick Astley',
        authorUser: 'RickAstleyVEVO',
        publishDate: '2009-10-25',
        description: 'Never Gonna Give You Up',
        key: 'dQw4w9WgXcQ',
        contentType: 'video/mp4',
        title: 'Rick Astley - Never Gonna Give You Up'
      })
      expect(result.success).toBe(true)
    })

    it('validates file insert with optional url field', () => {
      const result = fileInsertSchema.safeParse({
        fileId: 'test-file-id',
        authorName: 'Test Author',
        authorUser: 'testuser',
        publishDate: '2024-01-01',
        description: 'Test description',
        key: 'test-key',
        contentType: 'video/mp4',
        title: 'Test Title',
        url: 'https://example.com/video.mp4'
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing required fields', () => {
      const result = fileInsertSchema.safeParse({fileId: 'test-file-id'})
      expect(result.success).toBe(false)
    })
  })

  describe('fileSelectSchema', () => {
    it('validates a complete file select result', () => {
      const result = fileSelectSchema.safeParse({
        fileId: 'test-file-id',
        size: 1024000,
        authorName: 'Test Author',
        authorUser: 'testuser',
        publishDate: '2024-01-01',
        description: 'Test description',
        key: 'test-key',
        url: 'https://example.com/video.mp4',
        contentType: 'video/mp4',
        title: 'Test Title',
        status: 'Downloaded'
      })
      expect(result.success).toBe(true)
    })
  })

  describe('deviceInsertSchema', () => {
    it('validates device registration data', () => {
      const result = deviceInsertSchema.safeParse({
        deviceId: 'device-123',
        name: 'iPhone 15',
        token: 'apns-token-abc123',
        systemVersion: '17.0',
        systemName: 'iOS',
        endpointArn: 'arn:aws:sns:us-east-1:123456789:endpoint/APNS/app/device'
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing required fields', () => {
      const result = deviceInsertSchema.safeParse({deviceId: 'device-123'})
      expect(result.success).toBe(false)
    })
  })

  describe('deviceSelectSchema', () => {
    it('validates a complete device select result', () => {
      const result = deviceSelectSchema.safeParse({
        deviceId: 'device-123',
        name: 'iPhone 15',
        token: 'apns-token',
        systemVersion: '17.0',
        systemName: 'iOS',
        endpointArn: 'arn:aws:sns:...'
      })
      expect(result.success).toBe(true)
    })
  })

  describe('sessionInsertSchema', () => {
    it('validates session creation data', () => {
      const result = sessionInsertSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        token: 'session-token-abc123',
        expiresAt: new Date('2025-01-01')
      })
      expect(result.success).toBe(true)
    })

    it('validates session with optional IP and userAgent', () => {
      const result = sessionInsertSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        token: 'session-token-abc123',
        expiresAt: new Date('2025-01-01'),
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      })
      expect(result.success).toBe(true)
    })
  })

  describe('Relationship schemas', () => {
    describe('userFileInsertSchema', () => {
      it('validates user-file relationship', () => {
        const result = userFileInsertSchema.safeParse({userId: '550e8400-e29b-41d4-a716-446655440000', fileId: 'dQw4w9WgXcQ'})
        expect(result.success).toBe(true)
      })
    })

    describe('userDeviceInsertSchema', () => {
      it('validates user-device relationship', () => {
        const result = userDeviceInsertSchema.safeParse({userId: '550e8400-e29b-41d4-a716-446655440000', deviceId: 'device-123'})
        expect(result.success).toBe(true)
      })
    })
  })

  describe('Factory function re-export', () => {
    it('exports createInsertSchema for custom schemas', () => {
      expect(typeof createInsertSchema).toBe('function')
    })
  })

  describe('Status Enum Validation', () => {
    describe('FileStatus validation', () => {
      it('accepts all valid FileStatus enum values', () => {
        const validStatuses = [FileStatus.Queued, FileStatus.Downloading, FileStatus.Downloaded, FileStatus.Failed]
        for (const status of validStatuses) {
          const result = fileInsertSchema.safeParse({
            fileId: 'test-file',
            authorName: 'Test',
            authorUser: 'test',
            publishDate: '2024-01-01',
            description: 'Test',
            key: 'test-key',
            contentType: 'video/mp4',
            title: 'Test',
            status
          })
          expect(result.success).toBe(true)
        }
      })

      it('rejects invalid status string', () => {
        const result = fileInsertSchema.safeParse({
          fileId: 'test-file',
          authorName: 'Test',
          authorUser: 'test',
          publishDate: '2024-01-01',
          description: 'Test',
          key: 'test-key',
          contentType: 'video/mp4',
          title: 'Test',
          status: 'InvalidStatus'
        })
        expect(result.success).toBe(false)
      })

      it('rejects empty string status', () => {
        const result = fileInsertSchema.safeParse({
          fileId: 'test-file',
          authorName: 'Test',
          authorUser: 'test',
          publishDate: '2024-01-01',
          description: 'Test',
          key: 'test-key',
          contentType: 'video/mp4',
          title: 'Test',
          status: ''
        })
        expect(result.success).toBe(false)
      })

      it('validates FileStatus in update schema', () => {
        const result = fileUpdateSchema.safeParse({status: FileStatus.Downloaded})
        expect(result.success).toBe(true)
      })

      it('rejects invalid status in update schema', () => {
        const result = fileUpdateSchema.safeParse({status: 'BadStatus'})
        expect(result.success).toBe(false)
      })
    })

    describe('DownloadStatus validation', () => {
      it('accepts all valid DownloadStatus enum values', () => {
        const validStatuses = [
          DownloadStatus.Pending,
          DownloadStatus.InProgress,
          DownloadStatus.Scheduled,
          DownloadStatus.Completed,
          DownloadStatus.Failed
        ]
        for (const status of validStatuses) {
          const result = fileDownloadInsertSchema.safeParse({fileId: 'test-file', status})
          expect(result.success).toBe(true)
        }
      })

      it('rejects invalid download status string', () => {
        const result = fileDownloadInsertSchema.safeParse({fileId: 'test-file', status: 'InvalidDownloadStatus'})
        expect(result.success).toBe(false)
      })

      it('rejects null status', () => {
        const result = fileDownloadInsertSchema.safeParse({fileId: 'test-file', status: null})
        expect(result.success).toBe(false)
      })

      it('validates DownloadStatus in update schema', () => {
        const result = fileDownloadUpdateSchema.safeParse({status: DownloadStatus.Completed})
        expect(result.success).toBe(true)
      })

      it('rejects invalid status in download update schema', () => {
        const result = fileDownloadUpdateSchema.safeParse({status: 'NotAStatus'})
        expect(result.success).toBe(false)
      })
    })
  })
})
