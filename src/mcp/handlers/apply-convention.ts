/**
 * MCP Apply Convention Handler
 *
 * Programmatic convention application for AI agents.
 * Supports auto-fix for common convention violations.
 *
 * Supported conventions:
 * - aws-sdk-wrapper: Replace direct aws-sdk imports with vendor wrappers
 * - entity-mock: Fix entity mock patterns in tests
 * - response-helper: Replace raw response objects with buildApiResponse
 * - env-validation: Replace process.env with getRequiredEnv
 * - class-handlers: Convert to class-based handler pattern
 */

import {existsSync, readFileSync} from 'node:fs'
import {dirname, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {Project, SyntaxKind} from 'ts-morph'
import {createSuccessResponse, type McpSuccessResponse} from './shared/response-types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '../../..')

export type ConventionType = 'aws-sdk-wrapper' | 'entity-mock' | 'response-helper' | 'env-validation' | 'class-handlers'

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
 * Legacy entity module names that should be mocked via #entities/queries
 */
const LEGACY_ENTITY_MODULES = ['Users', 'Files', 'Devices', 'Sessions', 'Accounts', 'UserFiles', 'UserDevices', 'FileDownloads', 'VerificationTokens']

/**
 * Apply entity mock convention
 * Fixes legacy entity module mocks to use #entities/queries pattern
 */
async function applyEntityMock(filePath: string, dryRun: boolean): Promise<ApplyResult> {
  const changes: string[] = []

  if (!filePath.includes('.test.')) {
    return {file: filePath, convention: 'entity-mock', applied: false, changes: ['File is not a test file - skipping'], dryRun}
  }

  const project = new Project({tsConfigFilePath: join(projectRoot, 'tsconfig.json')})
  const sourceFile = project.addSourceFileAtPath(filePath)
  let modified = false

  // Find vi.mock calls with legacy entity module patterns
  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)

  for (const call of callExpressions) {
    const expr = call.getExpression()

    // Check for vi.mock('#entities/EntityName') pattern
    if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
      const propAccess = expr.asKind(SyntaxKind.PropertyAccessExpression)
      if (propAccess?.getName() === 'mock' && propAccess.getExpression().getText() === 'vi') {
        const args = call.getArguments()
        if (args.length > 0) {
          const moduleArg = args[0].getText().replace(/['"]/g, '')

          // Check if it's a legacy entity module
          for (const entity of LEGACY_ENTITY_MODULES) {
            if (moduleArg === `#entities/${entity}`) {
              changes.push(`Found legacy entity mock: vi.mock('${moduleArg}')`)
              changes.push(`  → Should use: vi.mock('#entities/queries', () => ({...}))`)
              changes.push('')
              changes.push('Manual fix required:')
              changes.push("1. Change import path to '#entities/queries'")
              changes.push('2. Update mock factory to return specific query functions')
              changes.push('Example:')
              changes.push("  vi.mock('#entities/queries', () => ({getUser: vi.fn(), createUser: vi.fn()}))")
              modified = true
            }
          }
        }
      }
    }
  }

  if (modified) {
    return {
      file: filePath,
      convention: 'entity-mock',
      applied: false,
      changes,
      dryRun,
      error: 'Auto-fix not available - requires mapping entity modules to query functions. Manual fix required.'
    }
  }

  return {file: filePath, convention: 'entity-mock', applied: false, changes: ['No legacy entity mocks found - file follows convention'], dryRun}
}

/**
 * Apply response helper convention
 * Replaces raw response objects with response() helper
 */
async function applyResponseHelper(filePath: string, dryRun: boolean): Promise<ApplyResult> {
  const changes: string[] = []

  if (!filePath.includes('/lambdas/') || !filePath.endsWith('index.ts')) {
    return {file: filePath, convention: 'response-helper', applied: false, changes: ['File is not a Lambda handler - skipping'], dryRun}
  }

  const project = new Project({tsConfigFilePath: join(projectRoot, 'tsconfig.json')})
  const sourceFile = project.addSourceFileAtPath(filePath)
  let modified = false

  // Check if response helper is already imported
  const hasResponseImport = sourceFile.getImportDeclarations().some((imp) => {
    const specifier = imp.getModuleSpecifierValue()
    return specifier.includes('#lib/lambda/responses') || specifier.includes('lib/lambda/responses')
  })

  // Find raw response objects: return {statusCode: X, body: JSON.stringify(...)}
  const returnStatements = sourceFile.getDescendantsOfKind(SyntaxKind.ReturnStatement)
  const rawResponses: {lineNumber: number; statusCode: string; bodyText: string; node: typeof returnStatements[0]}[] = []

  for (const ret of returnStatements) {
    const expr = ret.getExpression()
    if (expr?.getKind() === SyntaxKind.ObjectLiteralExpression) {
      const objLit = expr.asKind(SyntaxKind.ObjectLiteralExpression)
      if (!objLit) {
        continue
      }

      const props = objLit.getProperties()
      let statusCode: string | null = null
      let bodyText: string | null = null

      for (const prop of props) {
        if (prop.getKind() === SyntaxKind.PropertyAssignment) {
          const assignment = prop.asKind(SyntaxKind.PropertyAssignment)
          const name = assignment?.getName()
          const initializer = assignment?.getInitializer()

          if (name === 'statusCode' && initializer) {
            statusCode = initializer.getText()
          }
          if (name === 'body' && initializer) {
            // Check if body is JSON.stringify(...)
            if (initializer.getText().startsWith('JSON.stringify')) {
              // Extract the argument to JSON.stringify
              const callExpr = initializer.asKind(SyntaxKind.CallExpression)
              if (callExpr) {
                const args = callExpr.getArguments()
                if (args.length > 0) {
                  bodyText = args[0].getText()
                }
              }
            }
          }
        }
      }

      if (statusCode && bodyText) {
        rawResponses.push({lineNumber: ret.getStartLineNumber(), statusCode, bodyText, node: ret})
      }
    }
  }

  if (rawResponses.length > 0) {
    for (const rawResponse of rawResponses) {
      changes.push(`Line ${rawResponse.lineNumber}: Found raw response with statusCode ${rawResponse.statusCode}`)

      // Auto-fix: Replace with response(statusCode, data)
      const newReturn = `return response(${rawResponse.statusCode}, ${rawResponse.bodyText})`
      rawResponse.node.replaceWithText(newReturn)
      modified = true
      changes.push(`  → Replaced with: response(${rawResponse.statusCode}, ...)`)
    }

    // Add import if needed
    if (!hasResponseImport) {
      const lastImport = sourceFile.getImportDeclarations().pop()
      if (lastImport) {
        lastImport.getParent().insertStatements(lastImport.getChildIndex() + 1, "import {response} from '#lib/lambda/responses'")
      } else {
        sourceFile.insertStatements(0, "import {response} from '#lib/lambda/responses'")
      }
      changes.push("Added import: import {response} from '#lib/lambda/responses'")
    }

    if (!dryRun) {
      sourceFile.saveSync()
    }

    changes.push('')
    changes.push(`Replaced ${rawResponses.length} raw response object(s) with response() helper`)
  }

  return {
    file: filePath,
    convention: 'response-helper',
    applied: modified,
    changes: modified ? changes : ['No raw response objects found - file follows convention'],
    dryRun
  }
}

/**
 * Apply environment validation convention
 * Replaces direct process.env access with getRequiredEnv
 */
async function applyEnvValidation(filePath: string, dryRun: boolean): Promise<ApplyResult> {
  const changes: string[] = []

  if (!filePath.includes('/lambdas/') && !filePath.includes('/lib/')) {
    return {file: filePath, convention: 'env-validation', applied: false, changes: ['File is not a Lambda or library - skipping'], dryRun}
  }

  // Skip env.ts itself and test files
  if (filePath.includes('/system/env') || filePath.includes('.test.')) {
    return {file: filePath, convention: 'env-validation', applied: false, changes: ['Skipping env utility or test file'], dryRun}
  }

  const project = new Project({tsConfigFilePath: join(projectRoot, 'tsconfig.json')})
  const sourceFile = project.addSourceFileAtPath(filePath)
  let modified = false

  // AWS runtime vars that should not be replaced (they're set by Lambda runtime)
  const awsRuntimeVars = new Set(['AWS_REGION', 'AWS_LAMBDA_FUNCTION_NAME', 'AWS_EXECUTION_ENV', 'NODE_ENV', 'LOG_LEVEL'])

  // Find process.env.VAR_NAME access patterns
  const propertyAccesses = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)

  const varsToReplace: string[] = []

  for (const access of propertyAccesses) {
    const expr = access.getExpression()

    // Check for process.env.VAR pattern
    if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
      const innerAccess = expr.asKind(SyntaxKind.PropertyAccessExpression)
      if (innerAccess?.getName() === 'env' && innerAccess.getExpression().getText() === 'process') {
        const varName = access.getName()

        // Skip AWS runtime vars
        if (!awsRuntimeVars.has(varName)) {
          varsToReplace.push(varName)
          changes.push(`Found: process.env.${varName}`)

          // Auto-fix: Replace process.env.VAR with getRequiredEnv('VAR')
          access.replaceWithText(`getRequiredEnv('${varName}')`)
          modified = true
        }
      }
    }
  }

  // Add import if we made changes and import doesn't exist
  if (modified) {
    const hasEnvImport = sourceFile.getImportDeclarations().some((imp) => {
      const specifier = imp.getModuleSpecifierValue()
      return specifier.includes('#lib/system/env') || specifier.includes('lib/system/env')
    })

    if (!hasEnvImport) {
      // Add import at the top after other imports
      const lastImport = sourceFile.getImportDeclarations().pop()
      if (lastImport) {
        lastImport.getParent().insertStatements(lastImport.getChildIndex() + 1, "import {getRequiredEnv} from '#lib/system/env'")
      } else {
        sourceFile.insertStatements(0, "import {getRequiredEnv} from '#lib/system/env'")
      }
      changes.push("Added import: import {getRequiredEnv} from '#lib/system/env'")
    }

    if (!dryRun) {
      sourceFile.saveSync()
    }

    changes.push('')
    changes.push(`Replaced ${varsToReplace.length} process.env access(es) with getRequiredEnv()`)
  }

  return {
    file: filePath,
    convention: 'env-validation',
    applied: modified,
    changes: modified ? changes : ['No direct process.env access found - file follows convention'],
    dryRun
  }
}

/**
 * Apply class-handlers convention
 * Checks if handlers use class-based pattern instead of functional wrappers
 */
async function applyClassHandlers(filePath: string, dryRun: boolean): Promise<ApplyResult> {
  const changes: string[] = []

  if (!filePath.includes('/lambdas/') || !filePath.endsWith('index.ts')) {
    return {file: filePath, convention: 'class-handlers', applied: false, changes: ['File is not a Lambda handler - skipping'], dryRun}
  }

  const content = readFileSync(filePath, 'utf-8')

  // Check if using class-based pattern
  const classBasedPattern = /class\s+\w+Handler\s+extends\s+\w+Handler/
  if (classBasedPattern.test(content)) {
    return {file: filePath, convention: 'class-handlers', applied: false, changes: ['Handler already uses class-based pattern'], dryRun}
  }

  // Check for old functional patterns
  const oldPatterns = ['withPowertools', 'wrapAuthenticatedHandler', 'wrapOptionalAuthHandler', 'wrapApiHandler', 'wrapSqsBatchHandler']
  const foundOldPatterns = oldPatterns.filter((pattern) => content.includes(pattern))

  if (foundOldPatterns.length > 0) {
    changes.push(`Handler uses deprecated patterns: ${foundOldPatterns.join(', ')}`)
    changes.push('')
    changes.push('Convert to class-based pattern:')
    changes.push("1. Import base class: import {AuthenticatedHandler} from '#lib/lambda/handlers'")
    changes.push('2. Create handler class extending appropriate base:')
    changes.push('   class MyHandler extends AuthenticatedHandler {')
    changes.push("     readonly operationName = 'MyOperation'")
    changes.push('     protected async handleAuthenticated(event, context) { ... }')
    changes.push('   }')
    changes.push('3. Export bound handler:')
    changes.push('   const handlerInstance = new MyHandler()')
    changes.push('   export const handler = handlerInstance.handler.bind(handlerInstance)')

    return {file: filePath, convention: 'class-handlers', applied: false, changes, dryRun, error: 'Auto-fix not available - requires class-based refactor'}
  }

  return {
    file: filePath,
    convention: 'class-handlers',
    applied: false,
    changes: ['Handler pattern could not be determined - manual review required'],
    dryRun
  }
}

/**
 * Main handler for apply_convention MCP tool
 */
export async function handleApplyConvention(args: ApplyConventionArgs): Promise<McpSuccessResponse> {
  const {file, convention, dryRun = true} = args

  if (!file) {
    return createSuccessResponse({file: '', convention, applied: false, changes: [], dryRun, error: 'File path required'})
  }

  const filePath = file.startsWith('/') ? file : join(projectRoot, file)

  if (!existsSync(filePath)) {
    return createSuccessResponse({file: filePath, convention, applied: false, changes: [], dryRun, error: `File not found: ${filePath}`})
  }

  switch (convention) {
    case 'aws-sdk-wrapper':
      return createSuccessResponse(await applyAwsSdkWrapper(filePath, dryRun))

    case 'entity-mock':
      return createSuccessResponse(await applyEntityMock(filePath, dryRun))

    case 'response-helper':
      return createSuccessResponse(await applyResponseHelper(filePath, dryRun))

    case 'env-validation':
      return createSuccessResponse(await applyEnvValidation(filePath, dryRun))

    case 'class-handlers':
      return createSuccessResponse(await applyClassHandlers(filePath, dryRun))

    default:
      return createSuccessResponse({
        file: filePath,
        convention,
        applied: false,
        changes: [],
        dryRun,
        error: `Unknown convention: ${convention}. Available: aws-sdk-wrapper, entity-mock, response-helper, env-validation, class-handlers`
      })
  }
}
