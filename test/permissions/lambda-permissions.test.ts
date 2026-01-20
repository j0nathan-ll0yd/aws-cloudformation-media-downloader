/**
 * Lambda Permission Verification Tests
 *
 * These tests verify that Lambda handlers have the correct permissions
 * for the vendor functions they call, using the extracted permission manifests.
 *
 * Run `pnpm run build:dependencies` before running these tests to ensure
 * the permission manifests are up to date.
 */

import {describe, expect, it} from 'vitest'
import {
  entityPermissionsExist,
  getPermissionsSummary,
  getVendorMethodPermissions,
  loadEntityPermissions,
  loadServicePermissions,
  servicePermissionsExist,
  verifyAllVendorMethodsHavePermissions,
  verifyLambdaServicePermissions,
  verifyLambdaTablePermissions
} from '../helpers/permission-verification'

// Skip these tests if manifests don't exist (they're generated during build)
const skipIfNoServiceManifest = servicePermissionsExist() ? describe : describe.skip
const skipIfNoEntityManifest = entityPermissionsExist() ? describe : describe.skip
const skipIfNoManifests = servicePermissionsExist() && entityPermissionsExist() ? describe : describe.skip

skipIfNoServiceManifest('Lambda Service Permissions', () => {
  describe('Service Permission Verification', () => {
    it('StartFileUpload should have S3 and EventBridge permissions', () => {
      const result = verifyLambdaServicePermissions('StartFileUpload', ['s3', 'events'])
      expect(result.valid, `Missing: ${result.missing.join(', ')}`).toBe(true)
    })

    it('SendPushNotification should have SNS permissions', () => {
      const result = verifyLambdaServicePermissions('SendPushNotification', ['sns'])
      expect(result.valid, `Missing: ${result.missing.join(', ')}`).toBe(true)
    })

    it('WebhookFeedly should have EventBridge permissions', () => {
      const result = verifyLambdaServicePermissions('WebhookFeedly', ['events'])
      expect(result.valid, `Missing: ${result.missing.join(', ')}`).toBe(true)
    })

    it('ApiGatewayAuthorizer should have ApiGateway permissions', () => {
      const result = verifyLambdaServicePermissions('ApiGatewayAuthorizer', ['apigateway'])
      expect(result.valid, `Missing: ${result.missing.join(', ')}`).toBe(true)
    })
  })

  describe('Vendor Method Permissions', () => {
    it('all vendor methods should have permissions defined', () => {
      const result = verifyAllVendorMethodsHavePermissions()
      expect(result.valid, `Methods without permissions: ${result.missingPermissions.join(', ')}`).toBe(true)
    })

    it('vendor methods should have non-empty operations', () => {
      const methodPermissions = getVendorMethodPermissions()
      for (const [methodName, permissions] of Object.entries(methodPermissions)) {
        for (const perm of permissions) {
          expect(perm.operations.length, `${methodName} should have operations`).toBeGreaterThan(0)
        }
      }
    })
  })

  describe('Manifest Consistency', () => {
    it('manifest should have generatedAt timestamp', () => {
      const manifest = loadServicePermissions()
      expect(manifest.generatedAt).toBeDefined()
      expect(new Date(manifest.generatedAt).getTime()).not.toBeNaN()
    })

    it('all Lambdas with permissions should have valid service types', () => {
      const manifest = loadServicePermissions()
      const validServices = ['s3', 'sqs', 'sns', 'events', 'apigateway', 'lambda']

      for (const [lambdaName, lambdaData] of Object.entries(manifest.lambdas)) {
        for (const service of lambdaData.services) {
          expect(validServices.includes(service.service), `${lambdaName} has invalid service type: ${service.service}`).toBe(true)
        }
      }
    })
  })
})

skipIfNoEntityManifest('Lambda Entity Permissions', () => {
  describe('Table Permission Verification', () => {
    it('ListFiles should have files and user_files table access', () => {
      const result = verifyLambdaTablePermissions('ListFiles', ['files', 'user_files'])
      expect(result.valid, `Missing: ${result.missing.join(', ')}`).toBe(true)
    })

    it('manifest should have generatedAt timestamp', () => {
      const manifest = loadEntityPermissions()
      expect(manifest.generatedAt).toBeDefined()
      expect(new Date(manifest.generatedAt).getTime()).not.toBeNaN()
    })
  })
})

skipIfNoManifests('Permission Summary', () => {
  it('should have a valid permissions summary', () => {
    const summary = getPermissionsSummary()

    expect(summary.totalLambdas).toBeGreaterThan(0)
    expect(summary.totalServices.size).toBeGreaterThan(0)
    expect(summary.totalTables.size).toBeGreaterThan(0)
  })
})
