/**
 * Push Notification Contract Tests
 *
 * Validates that fixture payloads match the Zod schemas.
 * These fixtures are shared with the iOS repo — if a schema changes
 * and the fixtures are updated, the iOS contract test will fail
 * until the iOS parser is updated to match.
 */
import {describe, expect, it} from 'vitest'
import {
  downloadProgressPayloadSchema,
  downloadReadyPayloadSchema,
  downloadStartedPayloadSchema,
  failurePayloadSchema,
  metadataPayloadSchema,
  notificationTypeSchema
} from '#types/notification-schemas'
import metadataFixture from '../../fixtures/notification-payloads/metadata.json' with {type: 'json'}
import downloadStartedFixture from '../../fixtures/notification-payloads/download-started.json' with {type: 'json'}
import downloadProgressFixture from '../../fixtures/notification-payloads/download-progress.json' with {type: 'json'}
import downloadReadyFixture from '../../fixtures/notification-payloads/download-ready.json' with {type: 'json'}
import failureFixture from '../../fixtures/notification-payloads/failure.json' with {type: 'json'}

describe('Push Notification Contract', () => {
  describe('notificationType field', () => {
    it.each([
      metadataFixture,
      downloadStartedFixture,
      downloadProgressFixture,
      downloadReadyFixture,
      failureFixture
    ])('fixture $notificationType has a valid notificationType', (fixture) => {
      const result = notificationTypeSchema.safeParse(fixture.notificationType)
      expect(result.success).toBe(true)
    })
  })

  describe('payload schemas', () => {
    it('MetadataNotification fixture matches metadataPayloadSchema', () => {
      const result = metadataPayloadSchema.safeParse(metadataFixture.file)
      expect(result.success).toBe(true)
    })

    it('DownloadStartedNotification fixture matches downloadStartedPayloadSchema', () => {
      const result = downloadStartedPayloadSchema.safeParse(downloadStartedFixture.file)
      expect(result.success).toBe(true)
    })

    it('DownloadProgressNotification fixture matches downloadProgressPayloadSchema', () => {
      const result = downloadProgressPayloadSchema.safeParse(downloadProgressFixture.file)
      expect(result.success).toBe(true)
    })

    it('DownloadReadyNotification fixture matches downloadReadyPayloadSchema', () => {
      const result = downloadReadyPayloadSchema.safeParse(downloadReadyFixture.file)
      expect(result.success).toBe(true)
    })

    it('FailureNotification fixture matches failurePayloadSchema', () => {
      const result = failurePayloadSchema.safeParse(failureFixture.file)
      expect(result.success).toBe(true)
    })
  })

  describe('schema strictness', () => {
    it('rejects payloads with missing required fields', () => {
      const result = metadataPayloadSchema.safeParse({fileId: 'test'})
      expect(result.success).toBe(false)
    })

    it('rejects invalid notificationType strings', () => {
      const result = notificationTypeSchema.safeParse('InvalidNotification')
      expect(result.success).toBe(false)
    })
  })
})
