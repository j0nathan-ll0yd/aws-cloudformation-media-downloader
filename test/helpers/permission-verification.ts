/**
 * Permission Verification Test Utilities
 *
 * Provides utilities for verifying Lambda permissions match vendor function requirements.
 * Uses the extracted permission manifests generated during the build process.
 */

import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'

interface ServicePermission {
  service: string
  resource: string
  hasWildcard: boolean
  arnRef: string
  operations: string[]
}

interface LambdaServicePermissions {
  services: ServicePermission[]
}

interface ServicePermissionsManifest {
  lambdas: Record<string, LambdaServicePermissions>
  vendorMethods: Record<string, {className: string; methodName: string; permissions: ServicePermission[]}>
  generatedAt: string
}

interface TablePermission {
  table: string
  operations: string[]
}

interface LambdaEntityPermissions {
  tables: TablePermission[]
}

interface EntityPermissionsManifest {
  lambdas: Record<string, LambdaEntityPermissions>
  generatedAt: string
}

/**
 * Load service permissions manifest
 */
export function loadServicePermissions(): ServicePermissionsManifest {
  const manifestPath = join(process.cwd(), 'build/service-permissions.json')
  if (!existsSync(manifestPath)) {
    throw new Error('Service permissions manifest not found. Run pnpm run build:dependencies first.')
  }
  return JSON.parse(readFileSync(manifestPath, 'utf-8'))
}

/**
 * Load entity permissions manifest
 */
export function loadEntityPermissions(): EntityPermissionsManifest {
  const manifestPath = join(process.cwd(), 'build/entity-permissions.json')
  if (!existsSync(manifestPath)) {
    throw new Error('Entity permissions manifest not found. Run pnpm run build:dependencies first.')
  }
  return JSON.parse(readFileSync(manifestPath, 'utf-8'))
}

/**
 * Check if service permissions manifest exists
 */
export function servicePermissionsExist(): boolean {
  const manifestPath = join(process.cwd(), 'build/service-permissions.json')
  return existsSync(manifestPath)
}

/**
 * Check if entity permissions manifest exists
 */
export function entityPermissionsExist(): boolean {
  const manifestPath = join(process.cwd(), 'build/entity-permissions.json')
  return existsSync(manifestPath)
}

interface PermissionVerificationResult {
  valid: boolean
  missing: string[]
  extra: string[]
}

/**
 * Verify a Lambda has all required service permissions
 */
export function verifyLambdaServicePermissions(lambdaName: string, expectedServices: string[]): PermissionVerificationResult {
  const manifest = loadServicePermissions()
  const lambdaPerms = manifest.lambdas[lambdaName]

  if (!lambdaPerms) {
    return {valid: expectedServices.length === 0, missing: expectedServices, extra: []}
  }

  const actualServices = new Set(lambdaPerms.services.map((s) => s.service))
  const missing = expectedServices.filter((s) => !actualServices.has(s))
  const extra = [...actualServices].filter((s) => !expectedServices.includes(s))

  return {valid: missing.length === 0, missing, extra}
}

/**
 * Verify a Lambda has all required table permissions
 */
export function verifyLambdaTablePermissions(lambdaName: string, expectedTables: string[]): PermissionVerificationResult {
  const manifest = loadEntityPermissions()
  const lambdaPerms = manifest.lambdas[lambdaName]

  if (!lambdaPerms) {
    return {valid: expectedTables.length === 0, missing: expectedTables, extra: []}
  }

  const actualTables = new Set(lambdaPerms.tables.map((t) => t.table))
  const missing = expectedTables.filter((t) => !actualTables.has(t))
  const extra = [...actualTables].filter((t) => !expectedTables.includes(t))

  return {valid: missing.length === 0, missing, extra}
}

/**
 * Get all Lambdas that have a specific service permission
 */
export function getLambdasWithService(service: string): string[] {
  const manifest = loadServicePermissions()
  return Object.entries(manifest.lambdas).filter(([, perms]) => perms.services.some((s) => s.service === service)).map(([name]) => name)
}

/**
 * Get all Lambdas that access a specific table
 */
export function getLambdasWithTable(table: string): string[] {
  const manifest = loadEntityPermissions()
  return Object.entries(manifest.lambdas).filter(([, perms]) => perms.tables.some((t) => t.table === table)).map(([name]) => name)
}

/**
 * Get all vendor methods and their permissions
 */
export function getVendorMethodPermissions(): Record<string, ServicePermission[]> {
  const manifest = loadServicePermissions()
  const result: Record<string, ServicePermission[]> = {}

  for (const [methodName, methodData] of Object.entries(manifest.vendorMethods)) {
    result[methodName] = methodData.permissions
  }

  return result
}

/**
 * Verify all vendor methods have permissions defined
 */
export function verifyAllVendorMethodsHavePermissions(): {valid: boolean; missingPermissions: string[]} {
  const manifest = loadServicePermissions()
  const missingPermissions: string[] = []

  for (const [methodName, methodData] of Object.entries(manifest.vendorMethods)) {
    if (!methodData.permissions || methodData.permissions.length === 0) {
      missingPermissions.push(methodName)
    }
  }

  return {valid: missingPermissions.length === 0, missingPermissions}
}

/**
 * Get a summary of all Lambda permissions
 */
export function getPermissionsSummary(): {
  totalLambdas: number
  lambdasWithServicePermissions: number
  lambdasWithEntityPermissions: number
  totalServices: Set<string>
  totalTables: Set<string>
} {
  const serviceManifest = loadServicePermissions()
  const entityManifest = loadEntityPermissions()

  const totalServices = new Set<string>()
  const totalTables = new Set<string>()

  for (const perms of Object.values(serviceManifest.lambdas)) {
    for (const service of perms.services) {
      totalServices.add(service.service)
    }
  }

  for (const perms of Object.values(entityManifest.lambdas)) {
    for (const table of perms.tables) {
      totalTables.add(table.table)
    }
  }

  const allLambdas = new Set([...Object.keys(serviceManifest.lambdas), ...Object.keys(entityManifest.lambdas)])

  return {
    totalLambdas: allLambdas.size,
    lambdasWithServicePermissions: Object.keys(serviceManifest.lambdas).length,
    lambdasWithEntityPermissions: Object.keys(entityManifest.lambdas).length,
    totalServices,
    totalTables
  }
}
