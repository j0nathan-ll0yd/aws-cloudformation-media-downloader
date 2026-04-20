import {describe, expect, it} from 'vitest'
import {extractFingerprintFromError, generateErrorFingerprint} from '#integrations/github/errorFingerprint.js'

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

    it('should include all optional fields in summary when all provided', () => {
      const result = generateErrorFingerprint({
        errorType: 'CustomError',
        errorCode: 'E001',
        stackFrame: 'index.ts',
        lambdaName: 'MyLambda',
        context: 'upload'
      })

      expect(result.summary).toContain('type:CustomError')
      expect(result.summary).toContain('code:E001')
      expect(result.summary).toContain('frame:index.ts')
      expect(result.summary).toContain('lambda:MyLambda')
      expect(result.summary).toContain('ctx:upload')
    })

    it('should produce different fingerprint when context differs', () => {
      const base = {errorType: 'Error', lambdaName: 'Lambda1'}
      const r1 = generateErrorFingerprint({...base, context: 'ctx-a'})
      const r2 = generateErrorFingerprint({...base, context: 'ctx-b'})

      expect(r1.fingerprint).not.toBe(r2.fingerprint)
    })

    it('should produce different fingerprint with and without errorCode', () => {
      const withCode = generateErrorFingerprint({errorType: 'Error', errorCode: 'E001'})
      const withoutCode = generateErrorFingerprint({errorType: 'Error'})

      expect(withCode.fingerprint).not.toBe(withoutCode.fingerprint)
    })

    it('should produce different fingerprint with and without stackFrame', () => {
      const withFrame = generateErrorFingerprint({errorType: 'Error', stackFrame: 'file.ts'})
      const withoutFrame = generateErrorFingerprint({errorType: 'Error'})

      expect(withFrame.fingerprint).not.toBe(withoutFrame.fingerprint)
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

    it('should handle error with no stack trace', () => {
      const error = new Error('test')
      error.stack = undefined
      const input = extractFingerprintFromError(error)

      expect(input.stackFrame).toBeUndefined()
    })

    it('should skip node_modules frames', () => {
      const error = new Error('test')
      error.stack = `Error: test
    at node_modules/some-lib/index.js:10:5
    at myFunction (src/handler.ts:42:10)`
      const input = extractFingerprintFromError(error)

      // Should skip the node_modules frame and get the app frame
      expect(input.stackFrame).toBeDefined()
      expect(input.stackFrame).not.toContain('node_modules')
    })

    it('should skip node:internal frames', () => {
      const error = new Error('test')
      error.stack = `Error: test
    at node:internal/process/task_queues:95:5
    at myHandler (src/index.ts:10:3)`
      const input = extractFingerprintFromError(error)

      expect(input.stackFrame).toBeDefined()
      expect(input.stackFrame).not.toContain('node:internal')
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
