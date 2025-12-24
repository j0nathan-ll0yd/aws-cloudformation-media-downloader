/**
 * MCP Apply Convention Handler
 *
 * Programmatic convention application for AI agents.
 * Supports auto-fix for common convention violations.
 *
 * Supported conventions:
 * - aws-sdk-wrapper: Replace direct aws-sdk imports with vendor wrappers
 * - electrodb-mock: Fix ElectroDB mock patterns in tests
 * - response-helper: Replace raw response objects with buildApiResponse
 * - env-validation: Replace process.env with getRequiredEnv
 * - powertools: Wrap handlers with withPowertools
 */

import {existsSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {Project, SyntaxKind} from 'ts-morph'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '../../..')

export type ConventionType = 'aws-sdk-wrapper' | 'electrodb-mock' | 'response-helper' | 'env-validation' | 'powertools'

export interface ApplyConventionArgs {
  file: string
  convention: ConventionType
  dryRun?: boolean
}

interface ApplyResult {
  file: string
  convention: ConventionType
  applied: boolean
  changes: string[]
  dryRun: boolean
  error?: string
}

// AWS SDK service to vendor wrapper mapping
const AWS_SDK_MAPPING: Record<string, {wrapper: string; functions: string[]}> = {
  '@aws-sdk/client-dynamodb': {wrapper: '#lib/vendor/AWS/DynamoDB', functions: ['queryItems', 'getItem', 'putItem', 'deleteItem']},
  '@aws-sdk/lib-dynamodb': {wrapper: '#lib/vendor/AWS/DynamoDB', functions: ['queryItems', 'getItem', 'putItem', 'deleteItem']},
  '@aws-sdk/client-s3': {wrapper: '#lib/vendor/AWS/S3', functions: ['uploadToS3', 'getObject', 'deleteObject']},
  '@aws-sdk/client-lambda': {wrapper: '#lib/vendor/AWS/Lambda', functions: ['invokeFunction', 'invokeFunctionAsync']},
  '@aws-sdk/client-sns': {wrapper: '#lib/vendor/AWS/SNS', functions: ['publishToSNS', 'createPlatformEndpoint']},
  '@aws-sdk/client-sqs': {wrapper: '#lib/vendor/AWS/SQS', functions: ['sendMessage', 'receiveMessage']}
}

/**
 * Apply AWS SDK wrapper convention
 * Replaces direct AWS SDK imports with vendor wrapper imports
 */
async function applyAwsSdkWrapper(filePath: string, dryRun: boolean): Promise<ApplyResult> {
  const changes: string[] = []

  const project = new Project({tsConfigFilePath: join(projectRoot, 'tsconfig.json')})

  const sourceFile = project.addSourceFileAtPath(filePath)
  let modified = false

  for (const importDecl of sourceFile.getImportDeclarations()) {
    const moduleSpecifier = importDecl.getModuleSpecifierValue()

    if (moduleSpecifier.startsWith('@aws-sdk/')) {
      const mapping = AWS_SDK_MAPPING[moduleSpecifier]

      if (mapping) {
        importDecl.setModuleSpecifier(mapping.wrapper)
        changes.push(`Replaced '${moduleSpecifier}' with '${mapping.wrapper}'`)
        modified = true
      } else {
        changes.push(`WARNING: No mapping for '${moduleSpecifier}' - manual fix required`)
      }
    }
  }

  if (modified && !dryRun) {
    sourceFile.saveSync()
  }

  return {file: filePath, convention: 'aws-sdk-wrapper', applied: modified, changes, dryRun}
}

/**
 * Apply ElectroDB mock convention
 * Fixes mock patterns to use createElectroDBEntityMock correctly
 */
async function applyElectroDBMock(filePath: string, dryRun: boolean): Promise<ApplyResult> {
  const changes: string[] = []

  if (!filePath.includes('.test.')) {
    return {file: filePath, convention: 'electrodb-mock', applied: false, changes: ['File is not a test file - skipping'], dryRun}
  }

  const content = readFileSync(filePath, 'utf-8')
  const newContent = content

  // Check for manual entity mocks (not using createElectroDBEntityMock)
  const manualMockPattern = /jest\.unstable_mockModule\(['"]#entities\/(\w+)['"]/g
  const helperImportExists = content.includes('createElectroDBEntityMock')

  const matches = [...content.matchAll(manualMockPattern)]

  if (matches.length > 0 && !helperImportExists) {
    changes.push('Detected manual entity mocks without createElectroDBEntityMock helper')
    changes.push('Manual fix required:')
    changes.push("1. Import: import {createElectroDBEntityMock} from '#test/helpers/electrodb-mock'")
    changes.push('2. Create mock: const entityMock = createElectroDBEntityMock()')
    changes.push('3. Use in unstable_mockModule: ({Entity: entityMock.entity})')

    return {file: filePath, convention: 'electrodb-mock', applied: false, changes, dryRun, error: 'Auto-fix not available - complex refactoring required'}
  }

  // Check for mock defined inside jest.unstable_mockModule (wrong pattern)
  const wrongPatternRegex = /jest\.unstable_mockModule\([^)]+,\s*\(\)\s*=>\s*createElectroDBEntityMock/g
  if (wrongPatternRegex.test(content)) {
    changes.push('Detected createElectroDBEntityMock inside mock factory (wrong pattern)')
    changes.push('Mock must be created BEFORE jest.unstable_mockModule call')
    changes.push('Correct pattern:')
    changes.push('  const entityMock = createElectroDBEntityMock()')
    changes.push("  jest.unstable_mockModule('#entities/X', () => ({X: entityMock.entity}))")

    return {file: filePath, convention: 'electrodb-mock', applied: false, changes, dryRun, error: 'Auto-fix not available - manual reordering required'}
  }

  const applied = newContent !== content
  if (applied && !dryRun) {
    writeFileSync(filePath, newContent)
  }

  return {file: filePath, convention: 'electrodb-mock', applied, changes: applied ? changes : ['No issues found - file follows convention'], dryRun}
}

/**
 * Apply response helper convention
 * Replaces raw response objects with buildApiResponse
 */
async function applyResponseHelper(filePath: string, dryRun: boolean): Promise<ApplyResult> {
  const changes: string[] = []

  if (!filePath.includes('/lambdas/')) {
    return {file: filePath, convention: 'response-helper', applied: false, changes: ['File is not a Lambda handler - skipping'], dryRun}
  }

  const project = new Project({tsConfigFilePath: join(projectRoot, 'tsconfig.json')})

  const sourceFile = project.addSourceFileAtPath(filePath)

  // Check if buildApiResponse is imported
  const hasResponseImport = sourceFile.getImportDeclarations().some((imp) =>
    imp.getModuleSpecifierValue().includes('responses') && imp.getNamedImports().some((n) => n.getName() === 'buildApiResponse')
  )

  // Find raw response objects
  const returnStatements = sourceFile.getDescendantsOfKind(SyntaxKind.ReturnStatement)
  const rawResponses: string[] = []

  for (const ret of returnStatements) {
    const expr = ret.getExpression()
    if (expr?.getKind() === SyntaxKind.ObjectLiteralExpression) {
      const text = expr.getText()
      if (text.includes('statusCode') && text.includes('body')) {
        rawResponses.push(`Line ${ret.getStartLineNumber()}: ${text.substring(0, 50)}...`)
      }
    }
  }

  if (rawResponses.length > 0) {
    changes.push(`Found ${rawResponses.length} raw response object(s):`)
    changes.push(...rawResponses.map((r) => `  - ${r}`))

    if (!hasResponseImport) {
      changes.push("Add import: import {buildApiResponse} from '#lib/lambda/responses'")
    }
    changes.push('Replace: return {statusCode: X, body: JSON.stringify(data)}')
    changes.push('With: return buildApiResponse(context, X, data)')

    return {file: filePath, convention: 'response-helper', applied: false, changes, dryRun, error: 'Auto-fix not available - manual replacement required'}
  }

  return {file: filePath, convention: 'response-helper', applied: false, changes: ['No raw response objects found - file follows convention'], dryRun}
}

/**
 * Apply environment validation convention
 * Replaces direct process.env access with getRequiredEnv
 */
async function applyEnvValidation(filePath: string, dryRun: boolean): Promise<ApplyResult> {
  const changes: string[] = []

  if (!filePath.includes('/lambdas/') && !filePath.includes('/util/')) {
    return {file: filePath, convention: 'env-validation', applied: false, changes: ['File is not a Lambda or utility - skipping'], dryRun}
  }

  const content = readFileSync(filePath, 'utf-8')

  // Skip env-validation.ts itself
  if (filePath.includes('env-validation')) {
    return {file: filePath, convention: 'env-validation', applied: false, changes: ['Skipping env-validation utility itself'], dryRun}
  }

  // Find direct process.env access
  const envPattern = /process\.env\.(\w+)/g
  const matches = [...content.matchAll(envPattern)]

  // Filter out AWS runtime vars
  const awsRuntimeVars = ['AWS_REGION', 'AWS_LAMBDA_FUNCTION_NAME', 'AWS_EXECUTION_ENV']
  const directAccesses = matches.filter((m) => !awsRuntimeVars.includes(m[1]))

  if (directAccesses.length > 0) {
    changes.push(`Found ${directAccesses.length} direct process.env access(es):`)
    for (const match of directAccesses) {
      changes.push(`  - process.env.${match[1]}`)
    }
    changes.push('')
    changes.push("Add import: import {getRequiredEnv} from '#lib/system/env'")
    changes.push(`Replace: process.env.VAR_NAME`)
    changes.push(`With: getRequiredEnv('VAR_NAME')`)

    return {file: filePath, convention: 'env-validation', applied: false, changes, dryRun, error: 'Auto-fix not available - manual replacement required'}
  }

  return {file: filePath, convention: 'env-validation', applied: false, changes: ['No direct process.env access found - file follows convention'], dryRun}
}

/**
 * Apply powertools convention
 * Wraps handlers with withPowertools
 */
async function applyPowertools(filePath: string, dryRun: boolean): Promise<ApplyResult> {
  const changes: string[] = []

  if (!filePath.includes('/lambdas/') || !filePath.endsWith('index.ts')) {
    return {file: filePath, convention: 'powertools', applied: false, changes: ['File is not a Lambda handler - skipping'], dryRun}
  }

  const content = readFileSync(filePath, 'utf-8')

  // Check if already wrapped
  if (content.includes('withPowertools') || content.includes('wrapLambdaInvokeHandler')) {
    return {file: filePath, convention: 'powertools', applied: false, changes: ['Handler already uses PowerTools wrapper'], dryRun}
  }

  // Check for unwrapped handler export
  const unwrappedPattern = /export\s+const\s+handler\s*=\s*async/
  if (unwrappedPattern.test(content)) {
    changes.push('Handler is not wrapped with withPowertools')
    changes.push('')
    changes.push("Add import: import {withPowertools} from '#lib/lambda/middleware/powertools'")
    changes.push('Wrap handler:')
    changes.push('  export const handler = withPowertools(async (event, context) => {')
    changes.push('    // handler code')
    changes.push('  })')

    return {file: filePath, convention: 'powertools', applied: false, changes, dryRun, error: 'Auto-fix not available - manual wrapping required'}
  }

  return {file: filePath, convention: 'powertools', applied: false, changes: ['Handler appears to be properly wrapped'], dryRun}
}

/**
 * Main handler for apply_convention MCP tool
 */
export async function handleApplyConvention(args: ApplyConventionArgs): Promise<ApplyResult> {
  const {file, convention, dryRun = true} = args

  if (!file) {
    return {file: '', convention, applied: false, changes: [], dryRun, error: 'File path required'}
  }

  const filePath = file.startsWith('/') ? file : join(projectRoot, file)

  if (!existsSync(filePath)) {
    return {file: filePath, convention, applied: false, changes: [], dryRun, error: `File not found: ${filePath}`}
  }

  switch (convention) {
    case 'aws-sdk-wrapper':
      return applyAwsSdkWrapper(filePath, dryRun)

    case 'electrodb-mock':
      return applyElectroDBMock(filePath, dryRun)

    case 'response-helper':
      return applyResponseHelper(filePath, dryRun)

    case 'env-validation':
      return applyEnvValidation(filePath, dryRun)

    case 'powertools':
      return applyPowertools(filePath, dryRun)

    default:
      return {
        file: filePath,
        convention,
        applied: false,
        changes: [],
        dryRun,
        error: `Unknown convention: ${convention}. Available: aws-sdk-wrapper, electrodb-mock, response-helper, env-validation, powertools`
      }
  }
}
