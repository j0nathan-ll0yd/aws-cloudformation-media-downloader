/**
 * MCP Handler: Apply Convention
 * 
 * Automatically applies architectural conventions to code.
 * This tool enables the MCP server to fix violations rather than just report them.
 */

import {readFileSync, writeFileSync} from 'fs'
import {Project, SyntaxKind} from 'ts-morph'
import {join} from 'path'

export interface ApplyConventionArgs {
  file: string
  convention: 'aws-sdk-wrapper' | 'electrodb-mock' | 'response-helper' | 'env-validation' | 'powertools' | 'all'
  dryRun?: boolean
}

interface FixResult {
  file: string
  convention: string
  applied: boolean
  changes: string[]
  errors: string[]
}

const ROOT_DIR = join(import.meta.dirname, '../..')

/**
 * Apply AWS SDK wrapper convention
 * Replace direct @aws-sdk imports with vendor wrappers
 */
function applyAwsSdkWrapper(filePath: string, dryRun: boolean): FixResult {
  const result: FixResult = {
    file: filePath,
    convention: 'aws-sdk-wrapper',
    applied: false,
    changes: [],
    errors: []
  }

  try {
    const project = new Project({tsConfigFilePath: join(ROOT_DIR, 'tsconfig.json')})
    const sourceFile = project.addSourceFileAtPath(filePath)

    const awsSdkImports = sourceFile.getImportDeclarations().filter(imp => 
      imp.getModuleSpecifierValue().startsWith('@aws-sdk/')
    )

    if (awsSdkImports.length === 0) {
      result.changes.push('No AWS SDK imports found')
      return result
    }

    // Map common AWS SDK imports to vendor wrappers
    const vendorMappings: Record<string, string> = {
      '@aws-sdk/client-s3': '#lib/vendor/AWS/S3',
      '@aws-sdk/client-dynamodb': '#lib/vendor/AWS/DynamoDB',
      '@aws-sdk/lib-dynamodb': '#lib/vendor/AWS/DynamoDB',
      '@aws-sdk/client-lambda': '#lib/vendor/AWS/Lambda',
      '@aws-sdk/client-sns': '#lib/vendor/AWS/SNS',
      '@aws-sdk/client-sqs': '#lib/vendor/AWS/SQS'
    }

    for (const imp of awsSdkImports) {
      const moduleSpec = imp.getModuleSpecifierValue()
      const vendorPath = vendorMappings[moduleSpec]

      if (vendorPath) {
        if (!dryRun) {
          imp.setModuleSpecifier(vendorPath)
        }
        result.changes.push(`Replaced ${moduleSpec} with ${vendorPath}`)
      } else {
        result.errors.push(`No vendor wrapper mapping for ${moduleSpec}`)
      }
    }

    if (!dryRun && result.changes.length > 0) {
      sourceFile.saveSync()
      result.applied = true
    }

  } catch (error) {
    result.errors.push(`Failed to apply fix: ${error}`)
  }

  return result
}

/**
 * Apply ElectroDB mock helper convention
 * Replace manual ElectroDB entity mocks with helper
 */
function applyElectroDbMock(filePath: string, dryRun: boolean): FixResult {
  const result: FixResult = {
    file: filePath,
    convention: 'electrodb-mock',
    applied: false,
    changes: [],
    errors: []
  }

  // This is complex and would require sophisticated AST manipulation
  // For now, provide guidance
  result.errors.push('Auto-fix for ElectroDB mocks not yet implemented')
  result.changes.push('Manual fix required: Use createElectroDBEntityMock() from #test/helpers/electrodb-mock')

  return result
}

/**
 * Apply response helper convention
 * Replace raw response objects with buildApiResponse()
 */
function applyResponseHelper(filePath: string, dryRun: boolean): FixResult {
  const result: FixResult = {
    file: filePath,
    convention: 'response-helper',
    applied: false,
    changes: [],
    errors: []
  }

  try {
    const content = readFileSync(filePath, 'utf-8')
    
    // Look for raw response patterns
    const rawResponsePattern = /return\s*\{\s*statusCode:\s*\d+,\s*body:/g
    const matches = content.match(rawResponsePattern)

    if (matches) {
      result.changes.push(`Found ${matches.length} raw response objects`)
      result.errors.push('Auto-fix for response helpers not yet implemented')
      result.changes.push('Manual fix required: Replace with buildApiResponse()')
    } else {
      result.changes.push('No raw response objects found')
    }

  } catch (error) {
    result.errors.push(`Failed to analyze: ${error}`)
  }

  return result
}

/**
 * Apply environment validation convention
 * Replace direct process.env with getRequiredEnv()
 */
function applyEnvValidation(filePath: string, dryRun: boolean): FixResult {
  const result: FixResult = {
    file: filePath,
    convention: 'env-validation',
    applied: false,
    changes: [],
    errors: []
  }

  try {
    const content = readFileSync(filePath, 'utf-8')
    
    // Look for direct process.env access
    const processEnvPattern = /process\.env\.\w+/g
    const matches = content.match(processEnvPattern)

    if (matches) {
      result.changes.push(`Found ${matches.length} direct process.env accesses`)
      result.errors.push('Auto-fix for env validation not yet implemented')
      result.changes.push('Manual fix required: Use getRequiredEnv() from #util/env-validation')
    } else {
      result.changes.push('No direct process.env accesses found')
    }

  } catch (error) {
    result.errors.push(`Failed to analyze: ${error}`)
  }

  return result
}

/**
 * Apply PowerTools wrapper convention
 * Wrap Lambda handlers with withPowertools()
 */
function applyPowertools(filePath: string, dryRun: boolean): FixResult {
  const result: FixResult = {
    file: filePath,
    convention: 'powertools',
    applied: false,
    changes: [],
    errors: []
  }

  // This requires complex AST manipulation
  result.errors.push('Auto-fix for PowerTools wrappers not yet implemented')
  result.changes.push('Manual fix required: Wrap handler with withPowertools() or wrapLambdaInvokeHandler()')

  return result
}

/**
 * Apply all applicable conventions
 */
function applyAll(filePath: string, dryRun: boolean): FixResult[] {
  return [
    applyAwsSdkWrapper(filePath, dryRun),
    applyElectroDbMock(filePath, dryRun),
    applyResponseHelper(filePath, dryRun),
    applyEnvValidation(filePath, dryRun),
    applyPowertools(filePath, dryRun)
  ]
}

/**
 * Main handler for convention application
 */
export async function handleApplyConvention(args: ApplyConventionArgs) {
  const {file, convention, dryRun = false} = args

  const filePath = join(ROOT_DIR, file)

  let results: FixResult[]

  if (convention === 'all') {
    results = applyAll(filePath, dryRun)
  } else {
    const fixers: Record<string, (path: string, dry: boolean) => FixResult> = {
      'aws-sdk-wrapper': applyAwsSdkWrapper,
      'electrodb-mock': applyElectroDbMock,
      'response-helper': applyResponseHelper,
      'env-validation': applyEnvValidation,
      'powertools': applyPowertools
    }

    const fixer = fixers[convention]
    if (!fixer) {
      throw new Error(`Unknown convention: ${convention}`)
    }

    results = [fixer(filePath, dryRun)]
  }

  return {
    file,
    dryRun,
    results,
    summary: {
      totalChanges: results.reduce((sum, r) => sum + r.changes.length, 0),
      totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
      applied: results.filter(r => r.applied).length
    }
  }
}
