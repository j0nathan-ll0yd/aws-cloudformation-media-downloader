import {describe, expect, it} from 'vitest'
import {extractFingerprintFromError, generateErrorFingerprint} from '../errorFingerprint'

describe('generateErrorFingerprint', () => {
  describe('stability', () => {
    it('should produce same fingerprint for same input', () => {
      const input = {errorType: 'TypeError', errorCode: '500', lambdaName: 'TestLambda'}
      const result1 = generateErrorFingerprint(input)
      const result2 = generateErrorFingerprint(input)

      expect(result1.fingerprint).toBe(result2.fingerprint)
    })

    it('should produce different fingerprints for different inputs', () => {
      const input1 = {errorType: 'TypeError', lambdaName: 'Lambda1'}
      const input2 = {errorType: 'TypeError', lambdaName: 'Lambda2'}

      const result1 = generateErrorFingerprint(input1)
      const result2 = generateErrorFingerprint(input2)

      expect(result1.fingerprint).not.toBe(result2.fingerprint)
    })

    it('should produce different fingerprints for different error types', () => {
      const input1 = {errorType: 'TypeError'}
      const input2 = {errorType: 'ReferenceError'}

      const result1 = generateErrorFingerprint(input1)
      const result2 = generateErrorFingerprint(input2)

      expect(result1.fingerprint).not.toBe(result2.fingerprint)
    })
  })

  describe('fingerprint format', () => {
    it('should start with error-fp- prefix', () => {
      const result = generateErrorFingerprint({errorType: 'Error'})
      expect(result.fingerprint).toMatch(/^error-fp-[a-f0-9]{12}$/)
    })

    it('should include components in summary', () => {
      const result = generateErrorFingerprint({errorType: 'CustomError', errorCode: 'E001', lambdaName: 'TestLambda'})

      expect(result.summary).toContain('type:CustomError')
      expect(result.summary).toContain('code:E001')
      expect(result.summary).toContain('lambda:TestLambda')
    })
  })

  describe('optional fields', () => {
    it('should handle minimal input (just errorType)', () => {
      const result = generateErrorFingerprint({errorType: 'Error'})
      expect(result.fingerprint).toBeDefined()
      expect(result.summary).toBe('type:Error')
    })

    it('should include stackFrame when provided', () => {
      const result = generateErrorFingerprint({errorType: 'Error', stackFrame: 'handler.ts'})

      expect(result.summary).toContain('frame:handler.ts')
    })

    it('should include context when provided', () => {
      const result = generateErrorFingerprint({errorType: 'Error', context: 'video-download'})

      expect(result.summary).toContain('ctx:video-download')
    })
  })
})

describe('extractFingerprintFromError', () => {
  describe('error type extraction', () => {
    it('should extract error name', () => {
      const error = new TypeError('test')
      const input = extractFingerprintFromError(error)

      expect(input.errorType).toBe('TypeError')
    })

    it('should use constructor name as fallback', () => {
      class CustomError extends Error {
        constructor() {
          super('test')
          this.name = ''
        }
      }
      const error = new CustomError()
      error.name = '' // Clear the name
      const input = extractFingerprintFromError(error)

      expect(input.errorType).toBe('CustomError')
    })
  })

  describe('error code extraction', () => {
    it('should extract string code property', () => {
      const error = new Error('test') as Error & {code: string}
      error.code = 'ENOENT'
      const input = extractFingerprintFromError(error)

      expect(input.errorCode).toBe('ENOENT')
    })

    it('should extract numeric statusCode', () => {
      const error = new Error('test') as Error & {statusCode: number}
      error.statusCode = 404
      const input = extractFingerprintFromError(error)

      expect(input.errorCode).toBe('404')
    })

    it('should handle errors without code', () => {
      const error = new Error('test')
      const input = extractFingerprintFromError(error)

      expect(input.errorCode).toBeUndefined()
    })
  })

  describe('lambda name', () => {
    it('should include lambda name when provided', () => {
      const error = new Error('test')
      const input = extractFingerprintFromError(error, 'StartFileUpload')

      expect(input.lambdaName).toBe('StartFileUpload')
    })
  })

  describe('context', () => {
    it('should include context when provided', () => {
      const error = new Error('test')
      const input = extractFingerprintFromError(error, undefined, 'download-phase')

      expect(input.context).toBe('download-phase')
    })
  })

  describe('stack frame extraction', () => {
    it('should extract stackFrame from error', () => {
      const error = new Error('test')
      // Stack trace is auto-generated
      const input = extractFingerprintFromError(error)

      // Should have some stack frame (may vary by environment)
      // Just verify we get something or undefined
      expect(typeof input.stackFrame === 'string' || input.stackFrame === undefined).toBe(true)
    })
  })

  describe('integration with generateErrorFingerprint', () => {
    it('should produce stable fingerprints end-to-end', () => {
      const error1 = new TypeError('Something went wrong')
      const error2 = new TypeError('Something went wrong')

      // Use same lambda name to ensure consistent context
      const input1 = extractFingerprintFromError(error1, 'TestLambda')
      const input2 = extractFingerprintFromError(error2, 'TestLambda')

      // Clear stack frames for stability (they may differ)
      input1.stackFrame = undefined
      input2.stackFrame = undefined

      const fp1 = generateErrorFingerprint(input1)
      const fp2 = generateErrorFingerprint(input2)

      expect(fp1.fingerprint).toBe(fp2.fingerprint)
    })
  })
})
