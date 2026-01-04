import {afterEach, beforeEach, describe, expect, it, type MockInstance, vi} from 'vitest'
import {logger} from '#lib/vendor/Powertools'
import {withQueryLogging, withSyncLogging} from '../query-wrapper'

describe('query-wrapper', () => {
  let loggerDebugSpy: MockInstance<typeof logger.debug>

  beforeEach(() => {
    loggerDebugSpy = vi.spyOn(logger, 'debug').mockImplementation(() => undefined)
  })

  afterEach(() => {
    loggerDebugSpy.mockRestore()
  })

  describe('withQueryLogging', () => {
    it('should call the wrapped function and return its result', async () => {
      const mockFn = vi.fn().mockResolvedValue({id: '123', name: 'test'})
      const wrapped = withQueryLogging(mockFn, 'getUser')

      const result = await wrapped('user-id')

      expect(result).toEqual({id: '123', name: 'test'})
      expect(mockFn).toHaveBeenCalledWith('user-id')
    })

    it('should log input with single argument directly', async () => {
      const mockFn = vi.fn().mockResolvedValue('result')
      const wrapped = withQueryLogging(mockFn, 'getData')

      await wrapped('single-arg')

      expect(loggerDebugSpy).toHaveBeenCalledWith('getData <=', {data: 'single-arg'})
    })

    it('should log input with multiple arguments as array', async () => {
      const mockFn = vi.fn().mockResolvedValue('result')
      const wrapped = withQueryLogging(mockFn, 'getData')

      await wrapped('arg1', 'arg2', 'arg3')

      expect(loggerDebugSpy).toHaveBeenCalledWith('getData <=', {data: ['arg1', 'arg2', 'arg3']})
    })

    it('should log output result', async () => {
      const result = {userId: 'u123', files: ['file1', 'file2']}
      const mockFn = vi.fn().mockResolvedValue(result)
      const wrapped = withQueryLogging(mockFn, 'getFiles')

      await wrapped('u123')

      expect(loggerDebugSpy).toHaveBeenCalledWith('getFiles =>', {data: result})
    })

    it('should propagate errors from wrapped function', async () => {
      const error = new Error('Database connection failed')
      const mockFn = vi.fn().mockRejectedValue(error)
      const wrapped = withQueryLogging(mockFn, 'failingQuery')

      await expect(wrapped('test')).rejects.toThrow('Database connection failed')
      expect(loggerDebugSpy).toHaveBeenCalledWith('failingQuery <=', {data: 'test'})
      // Should not log output on error
      expect(loggerDebugSpy).toHaveBeenCalledTimes(1)
    })

    it('should handle null and undefined results', async () => {
      const mockFn = vi.fn().mockResolvedValue(null)
      const wrapped = withQueryLogging(mockFn, 'getNullable')

      const result = await wrapped('id')

      expect(result).toBeNull()
      expect(loggerDebugSpy).toHaveBeenCalledWith('getNullable =>', {data: null})
    })

    it('should handle empty array results', async () => {
      const mockFn = vi.fn().mockResolvedValue([])
      const wrapped = withQueryLogging(mockFn, 'getEmptyList')

      const result = await wrapped('query')

      expect(result).toEqual([])
      expect(loggerDebugSpy).toHaveBeenCalledWith('getEmptyList =>', {data: []})
    })

    it('should preserve function context with no arguments', async () => {
      const mockFn = vi.fn().mockResolvedValue('no-args-result')
      const wrapped = withQueryLogging(mockFn, 'getAll')

      const result = await wrapped()

      expect(result).toBe('no-args-result')
      expect(mockFn).toHaveBeenCalledWith()
    })
  })

  describe('withSyncLogging', () => {
    it('should call the wrapped function and return its result', () => {
      const mockFn = vi.fn().mockReturnValue(42)
      const wrapped = withSyncLogging(mockFn, 'calculate')

      const result = wrapped(10, 32)

      expect(result).toBe(42)
      expect(mockFn).toHaveBeenCalledWith(10, 32)
    })

    it('should log input with single argument directly', () => {
      const mockFn = vi.fn().mockReturnValue('parsed')
      const wrapped = withSyncLogging(mockFn, 'parse')

      wrapped('input')

      expect(loggerDebugSpy).toHaveBeenCalledWith('parse <=', {data: 'input'})
    })

    it('should log input with multiple arguments as array', () => {
      const mockFn = vi.fn().mockReturnValue('combined')
      const wrapped = withSyncLogging(mockFn, 'combine')

      wrapped('a', 'b', 'c')

      expect(loggerDebugSpy).toHaveBeenCalledWith('combine <=', {data: ['a', 'b', 'c']})
    })

    it('should log output result', () => {
      const result = {computed: true}
      const mockFn = vi.fn().mockReturnValue(result)
      const wrapped = withSyncLogging(mockFn, 'compute')

      wrapped('input')

      expect(loggerDebugSpy).toHaveBeenCalledWith('compute =>', {data: result})
    })

    it('should propagate errors from wrapped function', () => {
      const error = new Error('Computation failed')
      const mockFn = vi.fn().mockImplementation(() => {
        throw error
      })
      const wrapped = withSyncLogging(mockFn, 'failingCompute')

      expect(() => wrapped('test')).toThrow('Computation failed')
      expect(loggerDebugSpy).toHaveBeenCalledWith('failingCompute <=', {data: 'test'})
      // Should not log output on error
      expect(loggerDebugSpy).toHaveBeenCalledTimes(1)
    })
  })
})
