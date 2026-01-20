/**
 * Permission Gap Detection Rule
 * HIGH: Warn when Lambda imports vendor wrapper but permissions may not be properly traced
 *
 * This rule helps detect potential gaps where Lambda functions import vendor wrappers
 * but the permission extraction system may not correctly trace the required permissions.
 * This can happen due to dynamic imports, indirect calls, or missing decorators.
 */

import type {SourceFile} from 'ts-morph'
import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {createViolation} from '../types'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'permission-gap-detection'
const SEVERITY = 'HIGH' as const

interface ServicePermission {
  service: string
  resource: string
  hasWildcard: boolean
  operations: string[]
}

interface LambdaPermissions {
  services: ServicePermission[]
}

interface ServicePermissionsManifest {
  lambdas: Record<string, LambdaPermissions>
  vendorMethods: Record<string, {permissions: ServicePermission[]}>
}

// Cache the manifest to avoid repeated file reads
let cachedManifest: ServicePermissionsManifest | null | undefined = undefined
let manifestLoaded = false

/**
 * Load the generated service permissions manifest
 */
function loadServicePermissions(): ServicePermissionsManifest | null {
  if (manifestLoaded) {
    return cachedManifest ?? null
  }

  const manifestPath = join(process.cwd(), 'build/service-permissions.json')
  if (!existsSync(manifestPath)) {
    cachedManifest = null
    manifestLoaded = true
    return null
  }

  try {
    cachedManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    manifestLoaded = true
    return cachedManifest ?? null
  } catch {
    cachedManifest = null
    manifestLoaded = true
    return null
  }
}

/**
 * Extract Lambda name from file path
 */
function getLambdaName(filePath: string): string | null {
  const match = filePath.match(/src\/lambdas\/([^/]+)\//)
  return match ? match[1] : null
}

/**
 * Get vendor wrapper imports from source file.
 * Returns an array of service names imported from vendor wrappers.
 */
function getVendorImports(sourceFile: SourceFile): {service: string; line: number}[] {
  const imports = sourceFile.getImportDeclarations()
  const vendorImports: {service: string; line: number}[] = []

  for (const imp of imports) {
    const moduleSpec = imp.getModuleSpecifierValue()
    if (moduleSpec.startsWith('#lib/vendor/AWS/')) {
      const serviceName = moduleSpec.replace('#lib/vendor/AWS/', '')
      // Skip utility files that don't have service permissions
      if (!['clients', 'decorators', 'index'].includes(serviceName)) {
        vendorImports.push({service: serviceName, line: imp.getStartLineNumber()})
      }
    }
  }

  return vendorImports
}

/**
 * Clear the cached manifest (for testing)
 */
export function clearManifestCache(): void {
  cachedManifest = undefined
  manifestLoaded = false
}

export const permissionGapDetectionRule: ValidationRule = {
  name: RULE_NAME,
  description: 'Detect potential permission gaps where Lambda imports vendor wrapper but extraction may fail.',
  severity: SEVERITY,
  appliesTo: ['src/lambdas/*/src/index.ts'],
  excludes: [],

  validate(sourceFile: SourceFile, filePath: string): Violation[] {
    const violations: Violation[] = []

    const lambdaName = getLambdaName(filePath)
    if (!lambdaName) {
      return violations
    }

    const manifest = loadServicePermissions()
    if (!manifest) {
      // Can't validate without manifest - skip silently
      // The manifest is generated during build, so this is expected during development
      return violations
    }

    const vendorImports = getVendorImports(sourceFile)
    if (vendorImports.length === 0) {
      // No vendor imports - nothing to validate
      return violations
    }

    const lambdaPermissions = manifest.lambdas[lambdaName]

    // Check if Lambda imports vendor wrappers but has no extracted permissions
    if (!lambdaPermissions || lambdaPermissions.services.length === 0) {
      // Lambda imports vendors but has no permissions extracted - potential gap
      const importLine = vendorImports[0].line
      const importedServices = vendorImports.map((v) => v.service).join(', ')

      violations.push(
        createViolation(RULE_NAME, SEVERITY, importLine,
          `Lambda ${lambdaName} imports vendor wrappers [${importedServices}] but no permissions were extracted`, {
          suggestion: 'Ensure vendor methods have @RequiresXxx decorators and rebuild with pnpm run build:dependencies',
          codeSnippet: `Imports: ${importedServices}`
        })
      )
    }

    return violations
  }
}
