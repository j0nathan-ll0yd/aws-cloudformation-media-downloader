import {describe, expect, it} from 'vitest'
import {allSucceeded, anyFailed, countBatchResults, getFailureMessages, separateBatchResults} from '../batch'

describe('batch', () => {
  describe('separateBatchResults', () => {
    it('should separate fulfilled and rejected results', () => {
      const results: PromiseSettledResult<string>[] = [
        {status: 'fulfilled', value: 'success1'},
        {status: 'rejected', reason: new Error('error1')},
        {status: 'fulfilled', value: 'success2'},
        {status: 'rejected', reason: new Error('error2')}
      ]

      const {succeeded, failed} = separateBatchResults(results)

      expect(succeeded).toEqual(['success1', 'success2'])
      expect(failed).toHaveLength(2)
      expect(failed[0].message).toBe('error1')
      expect(failed[1].message).toBe('error2')
    })

    it('should handle all fulfilled results', () => {
      const results: PromiseSettledResult<number>[] = [
        {status: 'fulfilled', value: 1},
        {status: 'fulfilled', value: 2},
        {status: 'fulfilled', value: 3}
      ]

      const {succeeded, failed} = separateBatchResults(results)

      expect(succeeded).toEqual([1, 2, 3])
      expect(failed).toEqual([])
    })

    it('should handle all rejected results', () => {
      const results: PromiseSettledResult<string>[] = [
        {status: 'rejected', reason: new Error('fail1')},
        {status: 'rejected', reason: new Error('fail2')}
      ]

      const {succeeded, failed} = separateBatchResults(results)

      expect(succeeded).toEqual([])
      expect(failed).toHaveLength(2)
    })

    it('should handle empty results array', () => {
      const results: PromiseSettledResult<unknown>[] = []

      const {succeeded, failed} = separateBatchResults(results)

      expect(succeeded).toEqual([])
      expect(failed).toEqual([])
    })

    it('should convert non-Error rejection reasons to Error objects', () => {
      const results: PromiseSettledResult<string>[] = [
        {status: 'rejected', reason: 'string error'},
        {status: 'rejected', reason: 123},
        {status: 'rejected', reason: {custom: 'object'}}
      ]

      const {failed} = separateBatchResults(results)

      expect(failed).toHaveLength(3)
      expect(failed[0]).toBeInstanceOf(Error)
      expect(failed[0].message).toBe('string error')
      expect(failed[1]).toBeInstanceOf(Error)
      expect(failed[1].message).toBe('123')
      expect(failed[2]).toBeInstanceOf(Error)
      expect(failed[2].message).toBe('[object Object]')
    })

    it('should preserve original Error instances', () => {
      class CustomError extends Error {
        code: string
        constructor(message: string, code: string) {
          super(message)
          this.code = code
        }
      }
      const customError = new CustomError('custom', 'ERR_CUSTOM')
      const results: PromiseSettledResult<string>[] = [{status: 'rejected', reason: customError}]

      const {failed} = separateBatchResults(results)

      expect(failed[0]).toBe(customError)
      expect((failed[0] as CustomError).code).toBe('ERR_CUSTOM')
    })

    it('should handle object results with complex types', () => {
      interface User {
        id: string
        name: string
      }
      const results: PromiseSettledResult<User>[] = [
        {status: 'fulfilled', value: {id: '1', name: 'Alice'}},
        {status: 'fulfilled', value: {id: '2', name: 'Bob'}}
      ]

      const {succeeded} = separateBatchResults(results)

      expect(succeeded).toHaveLength(2)
      expect(succeeded[0].name).toBe('Alice')
      expect(succeeded[1].name).toBe('Bob')
    })
  })

  describe('countBatchResults', () => {
    it('should count fulfilled and rejected results', () => {
      const results: PromiseSettledResult<unknown>[] = [
        {status: 'fulfilled', value: 'a'},
        {status: 'rejected', reason: new Error('b')},
        {status: 'fulfilled', value: 'c'},
        {status: 'rejected', reason: new Error('d')},
        {status: 'fulfilled', value: 'e'}
      ]

      const {successCount, failureCount} = countBatchResults(results)

      expect(successCount).toBe(3)
      expect(failureCount).toBe(2)
    })

    it('should return zero for empty array', () => {
      const {successCount, failureCount} = countBatchResults([])

      expect(successCount).toBe(0)
      expect(failureCount).toBe(0)
    })

    it('should handle all successes', () => {
      const results: PromiseSettledResult<number>[] = [
        {status: 'fulfilled', value: 1},
        {status: 'fulfilled', value: 2}
      ]

      const {successCount, failureCount} = countBatchResults(results)

      expect(successCount).toBe(2)
      expect(failureCount).toBe(0)
    })

    it('should handle all failures', () => {
      const results: PromiseSettledResult<unknown>[] = [
        {status: 'rejected', reason: 'err1'},
        {status: 'rejected', reason: 'err2'}
      ]

      const {successCount, failureCount} = countBatchResults(results)

      expect(successCount).toBe(0)
      expect(failureCount).toBe(2)
    })
  })

  describe('getFailureMessages', () => {
    it('should extract error messages from rejected results', () => {
      const results: PromiseSettledResult<unknown>[] = [
        {status: 'fulfilled', value: 'ok'},
        {status: 'rejected', reason: new Error('error message 1')},
        {status: 'rejected', reason: new Error('error message 2')}
      ]

      const messages = getFailureMessages(results)

      expect(messages).toEqual(['error message 1', 'error message 2'])
    })

    it('should handle non-Error rejection reasons', () => {
      const results: PromiseSettledResult<unknown>[] = [
        {status: 'rejected', reason: 'plain string'},
        {status: 'rejected', reason: 42}
      ]

      const messages = getFailureMessages(results)

      expect(messages).toEqual(['plain string', '42'])
    })

    it('should return empty array when no failures', () => {
      const results: PromiseSettledResult<string>[] = [
        {status: 'fulfilled', value: 'a'},
        {status: 'fulfilled', value: 'b'}
      ]

      const messages = getFailureMessages(results)

      expect(messages).toEqual([])
    })
  })

  describe('allSucceeded', () => {
    it('should return true when all results are fulfilled', () => {
      const results: PromiseSettledResult<number>[] = [
        {status: 'fulfilled', value: 1},
        {status: 'fulfilled', value: 2},
        {status: 'fulfilled', value: 3}
      ]

      expect(allSucceeded(results)).toBe(true)
    })

    it('should return false when any result is rejected', () => {
      const results: PromiseSettledResult<unknown>[] = [
        {status: 'fulfilled', value: 'ok'},
        {status: 'rejected', reason: new Error('fail')}
      ]

      expect(allSucceeded(results)).toBe(false)
    })

    it('should return true for empty array', () => {
      expect(allSucceeded([])).toBe(true)
    })
  })

  describe('anyFailed', () => {
    it('should return true when at least one result is rejected', () => {
      const results: PromiseSettledResult<unknown>[] = [
        {status: 'fulfilled', value: 'ok'},
        {status: 'rejected', reason: new Error('fail')}
      ]

      expect(anyFailed(results)).toBe(true)
    })

    it('should return false when all results are fulfilled', () => {
      const results: PromiseSettledResult<number>[] = [
        {status: 'fulfilled', value: 1},
        {status: 'fulfilled', value: 2}
      ]

      expect(anyFailed(results)).toBe(false)
    })

    it('should return false for empty array', () => {
      expect(anyFailed([])).toBe(false)
    })
  })
})
