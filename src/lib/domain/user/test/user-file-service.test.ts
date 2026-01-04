/**
 * Unit tests for User-File Service Functions
 *
 * Tests file association management including idempotent behavior.
 */

import {beforeEach, describe, expect, it, vi} from 'vitest'

// Mock dependencies BEFORE importing the module under test
vi.mock('#entities/queries', () => ({createUserFile: vi.fn()}))
vi.mock('#lib/system/logging', () => ({logDebug: vi.fn()}))

// Import after mocking
const {associateFileToUser} = await import('../userFileService')
import {createUserFile} from '#entities/queries'
import {logDebug} from '#lib/system/logging'

describe('User-File Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('associateFileToUser', () => {
    it('should create a user-file association successfully', async () => {
      const mockResponse = {userId: 'user-123', fileId: 'file-456', createdAt: new Date()}
      vi.mocked(createUserFile).mockResolvedValue(mockResponse)

      const result = await associateFileToUser('file-456', 'user-123')

      expect(result).toEqual(mockResponse)
      expect(createUserFile).toHaveBeenCalledWith({userId: 'user-123', fileId: 'file-456'})
      expect(logDebug).toHaveBeenCalledWith('associateFileToUser <=', {fileId: 'file-456', userId: 'user-123'})
      expect(logDebug).toHaveBeenCalledWith('associateFileToUser =>', mockResponse)
    })

    it('should handle duplicate key error gracefully (idempotent)', async () => {
      const duplicateError = new Error('duplicate key value violates unique constraint')
      vi.mocked(createUserFile).mockRejectedValue(duplicateError)

      const result = await associateFileToUser('file-456', 'user-123')

      expect(result).toBeUndefined()
      expect(logDebug).toHaveBeenCalledWith('associateFileToUser => already exists (idempotent)')
    })

    it('should re-throw non-duplicate key errors', async () => {
      const otherError = new Error('connection timeout')
      vi.mocked(createUserFile).mockRejectedValue(otherError)

      await expect(associateFileToUser('file-456', 'user-123')).rejects.toThrow('connection timeout')
    })

    it('should handle error that is not an Error instance', async () => {
      vi.mocked(createUserFile).mockRejectedValue('string error')

      await expect(associateFileToUser('file-456', 'user-123')).rejects.toBe('string error')
    })

    it('should handle error with partial duplicate message', async () => {
      const partialDuplicateError = new Error('some error with duplicate key value in message')
      vi.mocked(createUserFile).mockRejectedValue(partialDuplicateError)

      const result = await associateFileToUser('file-456', 'user-123')

      expect(result).toBeUndefined()
    })
  })
})
