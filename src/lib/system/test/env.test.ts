import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {getOptionalEnv, getRequiredEnv, getRequiredEnvNumber, MissingEnvVarError} from '../env'

describe('env-validation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {...originalEnv}
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('getRequiredEnv', () => {
    it('should return the environment variable value when set', () => {
      process.env.TEST_VAR = 'test-value'
      expect(getRequiredEnv('TEST_VAR')).toBe('test-value')
    })

    it('should throw MissingEnvVarError when variable is not set', () => {
      delete process.env.MISSING_VAR
      expect(() => getRequiredEnv('MISSING_VAR')).toThrow(MissingEnvVarError)
      expect(() => getRequiredEnv('MISSING_VAR')).toThrow('Missing required environment variable: MISSING_VAR')
    })

    it('should throw when variable is empty string', () => {
      process.env.EMPTY_VAR = ''
      expect(() => getRequiredEnv('EMPTY_VAR')).toThrow(MissingEnvVarError)
    })
  })

  describe('getOptionalEnv', () => {
    it('should return the environment variable value when set', () => {
      process.env.OPTIONAL_VAR = 'optional-value'
      expect(getOptionalEnv('OPTIONAL_VAR', 'default')).toBe('optional-value')
    })

    it('should return default value when variable is not set', () => {
      delete process.env.UNSET_VAR
      expect(getOptionalEnv('UNSET_VAR', 'default-value')).toBe('default-value')
    })

    it('should return empty string if set to empty (not default)', () => {
      process.env.EMPTY_OPTIONAL = ''
      expect(getOptionalEnv('EMPTY_OPTIONAL', 'default')).toBe('')
    })
  })

  describe('getRequiredEnvNumber', () => {
    it('should return parsed number when valid', () => {
      process.env.NUM_VAR = '42'
      expect(getRequiredEnvNumber('NUM_VAR')).toBe(42)
    })

    it('should throw when variable is not set', () => {
      delete process.env.MISSING_NUM
      expect(() => getRequiredEnvNumber('MISSING_NUM')).toThrow(MissingEnvVarError)
    })

    it('should throw when variable is not a valid number', () => {
      process.env.INVALID_NUM = 'not-a-number'
      expect(() => getRequiredEnvNumber('INVALID_NUM')).toThrow('Environment variable INVALID_NUM is not a valid number')
    })

    it('should handle negative numbers', () => {
      process.env.NEG_NUM = '-5'
      expect(getRequiredEnvNumber('NEG_NUM')).toBe(-5)
    })

    it('should handle zero', () => {
      process.env.ZERO_NUM = '0'
      expect(getRequiredEnvNumber('ZERO_NUM')).toBe(0)
    })
  })
})
