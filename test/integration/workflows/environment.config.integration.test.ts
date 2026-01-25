/**
 * Environment Configuration Integration Tests
 *
 * Validates that staging and production environment configurations are correct
 * and consistent with the Terraform tfvars files.
 *
 * These tests ensure:
 * - Environment fixtures match actual tfvars
 * - Resource naming follows the prefix convention
 * - Environment-specific settings are properly configured
 */

import {readFileSync} from 'fs'
import {join} from 'path'
import {describe, expect, it} from 'vitest'
import {getEnvironmentConfig, getLambdaFunctionNames, getPrefixedResourceName, PRODUCTION_CONFIG, STAGING_CONFIG} from '#test/helpers/environment-fixtures'

describe('Environment Configuration', () => {
  describe('Staging Configuration', () => {
    it('should have correct environment name', () => {
      expect(STAGING_CONFIG.environment).toBe('staging')
    })

    it('should use stag- prefix for resources', () => {
      expect(STAGING_CONFIG.resourcePrefix).toBe('stag')
    })

    it('should use DEBUG log level for better debugging', () => {
      expect(STAGING_CONFIG.logLevel).toBe('DEBUG')
    })

    it('should have short log retention to reduce costs', () => {
      expect(STAGING_CONFIG.logRetentionDays).toBe(3)
    })

    it('should have CloudWatch alarms disabled for cost savings', () => {
      expect(STAGING_CONFIG.enableCloudwatchAlarms).toBe(false)
    })

    it('should have DSQL deletion protection disabled for easy cleanup', () => {
      expect(STAGING_CONFIG.dsqlDeletionProtection).toBe(false)
    })
  })

  describe('Production Configuration', () => {
    it('should have correct environment name', () => {
      expect(PRODUCTION_CONFIG.environment).toBe('production')
    })

    it('should use prod- prefix for resources', () => {
      expect(PRODUCTION_CONFIG.resourcePrefix).toBe('prod')
    })

    it('should use INFO log level for reduced log volume', () => {
      expect(PRODUCTION_CONFIG.logLevel).toBe('INFO')
    })

    it('should have longer log retention for debugging', () => {
      expect(PRODUCTION_CONFIG.logRetentionDays).toBe(7)
    })

    it('should have CloudWatch alarms enabled for monitoring', () => {
      expect(PRODUCTION_CONFIG.enableCloudwatchAlarms).toBe(true)
    })

    it('should have DSQL deletion protection enabled', () => {
      expect(PRODUCTION_CONFIG.dsqlDeletionProtection).toBe(true)
    })
  })

  describe('Resource Naming Convention', () => {
    it('should generate correct staging Lambda names', () => {
      const lambdas = getLambdaFunctionNames('staging')
      expect(lambdas).toContain('stag-RegisterUser')
      expect(lambdas).toContain('stag-LoginUser')
      expect(lambdas).toContain('stag-WebhookFeedly')
      // Ensure no production names leak
      expect(lambdas.every((name) => name.startsWith('stag-'))).toBe(true)
    })

    it('should generate correct production Lambda names', () => {
      const lambdas = getLambdaFunctionNames('production')
      expect(lambdas).toContain('prod-RegisterUser')
      expect(lambdas).toContain('prod-LoginUser')
      expect(lambdas).toContain('prod-WebhookFeedly')
      // Ensure no staging names leak
      expect(lambdas.every((name) => name.startsWith('prod-'))).toBe(true)
    })

    it('should prefix resource names correctly', () => {
      expect(getPrefixedResourceName('RegisterUser', 'staging')).toBe('stag-RegisterUser')
      expect(getPrefixedResourceName('RegisterUser', 'production')).toBe('prod-RegisterUser')
    })
  })

  describe('getEnvironmentConfig', () => {
    it('should return staging config', () => {
      const config = getEnvironmentConfig('staging')
      expect(config).toEqual(STAGING_CONFIG)
    })

    it('should return production config', () => {
      const config = getEnvironmentConfig('production')
      expect(config).toEqual(PRODUCTION_CONFIG)
    })

    it('should throw for invalid environment', () => {
      // @ts-expect-error Testing invalid input
      expect(() => getEnvironmentConfig('invalid')).toThrow('Invalid environment: invalid')
    })
  })

  describe('Terraform tfvars Consistency', () => {
    const projectRoot = join(__dirname, '../../..')
    const terraformDir = join(projectRoot, 'terraform/environments')

    // Helper to match tfvars key-value pairs with flexible whitespace
    // terraform fmt may align '=' signs differently
    const matchesTfvar = (content: string, key: string, value: string): boolean => {
      const pattern = new RegExp(`${key}\\s*=\\s*${value}`)
      return pattern.test(content)
    }

    it('should have staging.tfvars that matches fixture', () => {
      const tfvarsPath = join(terraformDir, 'staging.tfvars')
      const content = readFileSync(tfvarsPath, 'utf-8')

      // Verify key values match (flexible whitespace for terraform fmt compatibility)
      expect(matchesTfvar(content, 'environment', '"staging"')).toBe(true)
      expect(matchesTfvar(content, 'resource_prefix', '"stag"')).toBe(true)
      expect(matchesTfvar(content, 'log_level', '"DEBUG"')).toBe(true)
      expect(matchesTfvar(content, 'log_retention_days', '3')).toBe(true)
      expect(matchesTfvar(content, 'enable_cloudwatch_alarms', 'false')).toBe(true)
    })

    it('should have production.tfvars that matches fixture', () => {
      const tfvarsPath = join(terraformDir, 'production.tfvars')
      const content = readFileSync(tfvarsPath, 'utf-8')

      // Verify key values match (flexible whitespace for terraform fmt compatibility)
      expect(matchesTfvar(content, 'environment', '"production"')).toBe(true)
      expect(matchesTfvar(content, 'resource_prefix', '"prod"')).toBe(true)
      expect(matchesTfvar(content, 'log_level', '"INFO"')).toBe(true)
      expect(matchesTfvar(content, 'log_retention_days', '7')).toBe(true)
      expect(matchesTfvar(content, 'enable_cloudwatch_alarms', 'true')).toBe(true)
    })
  })

  describe('Environment Isolation', () => {
    it('staging and production should have different prefixes', () => {
      expect(STAGING_CONFIG.resourcePrefix).not.toBe(PRODUCTION_CONFIG.resourcePrefix)
    })

    it('staging and production should have different log levels', () => {
      expect(STAGING_CONFIG.logLevel).not.toBe(PRODUCTION_CONFIG.logLevel)
    })

    it('staging and production should have different alarm settings', () => {
      expect(STAGING_CONFIG.enableCloudwatchAlarms).not.toBe(PRODUCTION_CONFIG.enableCloudwatchAlarms)
    })

    it('staging should be less protected than production', () => {
      // Staging: lower retention, no deletion protection, no alarms
      expect(STAGING_CONFIG.logRetentionDays).toBeLessThan(PRODUCTION_CONFIG.logRetentionDays)
      expect(STAGING_CONFIG.dsqlDeletionProtection).toBe(false)
      expect(PRODUCTION_CONFIG.dsqlDeletionProtection).toBe(true)
    })
  })
})
