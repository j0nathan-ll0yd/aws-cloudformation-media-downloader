import {describe, expect, test} from '@jest/globals'
import * as fs from 'fs'
import type {InfrastructureD} from '#types/infrastructure'
import {logDebug} from '#lib/system/logging'
import path from 'path'
import {fileURLToPath} from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// IF NEW DEPENDENCIES ARE ADDED, YOU MAY NEED TO ADD MORE EXCLUSIONS HERE
// These are false positives detected by the source code regex that are NOT env vars
const excludedSourceVariables: Record<string, number> = {
  // Runtime/system variables (lowercase)
  hasOwnProperty: 1,
  let: 1,
  no_proxy: 1,
  t: 1,
  http_proxy: 1,
  https_proxy: 1,
  // Library false positives (Zod literals, HTTP headers, etc.)
  Exclusive: 1, // Zod validation literal
  Connection: 1, // HTTP header
  Upgrade: 1, // HTTP header
  // better-auth library model/type names (matched by minified function call pattern)
  Account: 1, // better-auth Account model
  Session: 1, // better-auth Session model
  ZodSuccess: 1, // Zod brand/success type
  // Web API and library types (esbuild preserves these as string literals)
  FormData: 1, // Web API
  Headers: 1, // Web API / HTTP
  SemVer: 1, // Version handling library type
  // Lambda function names referenced as strings (not env vars)
  StartFileUpload: 1, // Lambda function name in invoke calls
  // Query/ORM library keywords
  RightJoin: 1, // ElectroDB/SQL join type
  Using: 1, // Query keyword
  // CloudWatch metric names (used as string literals, not env vars)
  CookieAuthenticationFailure: 1,
  LambdaExecutionFailure: 1,
  LambdaExecutionSuccess: 1,
  RetryExhausted: 1,
  // OpenTelemetry SDK false positives (AWS SDK instrumentation types)
  DynamoDB: 1,
  Kinesis: 1,
  Lambda: 1,
  ProtocolError: 1,
  // AWS service name constants
  SNS: 1,
  SQS: 1,
  // System/Node.js environment variables (we don't control these)
  HOME: 1,
  USER: 1,
  PATH: 1,
  LOGNAME: 1,
  LNAME: 1,
  USERNAME: 1,
  USERPROFILE: 1,
  HOMEDRIVE: 1,
  HOMEPATH: 1,
  NODE_ENV: 1,
  NODE_DEBUG: 1,
  JEST_WORKER_ID: 1,
  LOG_LEVEL: 1,
  ENVIRONMENT: 1,
  USE_LOCALSTACK: 1,
  ENABLE_XRAY: 1,
  NO_PROXY: 1,
  HTTP_PROXY: 1,
  HTTPS_PROXY: 1,
  UNDICI_NO_WASM_SIMD: 1,
  POWERTOOLS_METRICS_DISABLED: 1,
  // OpenTelemetry infrastructure variables (set by ADOT layer, not in source)
  OTEL_SERVICE_NAME: 1,
  OTEL_EXPORTER_OTLP_ENDPOINT: 1,
  OTEL_EXPORTER_OTLP_COMPRESSION: 1,
  OTEL_EXPORTER_OTLP_HEADERS: 1,
  OTEL_EXPORTER_OTLP_TIMEOUT: 1,
  OTEL_PROPAGATORS: 1,
  // AWS Lambda runtime environment variables (set by AWS, not in source)
  AWS_EXECUTION_ENV: 1,
  AWS_LAMBDA_BENCHMARK_MODE: 1,
  AWS_LAMBDA_FUNCTION_NAME: 1,
  AWS_LAMBDA_INITIALIZATION_TYPE: 1,
  AWS_REGION: 1,
  AWS_SDK_UA_APP_ID: 1,
  // CI/debug environment variables
  CI: 1,
  DEBUG: 1,
  // SemVer library constants (matched by minified pattern)
  COMPARATOR: 1,
  // Better Auth / Apple Sign-in constants and error codes
  APPLE_ID_TOKEN_ISSUER: 1,
  DOMAIN_AND_REGION_REQUIRED: 1,
  FAILED_TO_GET_ACCESS_TOKEN: 1,
  FAILED_TO_REFRESH_ACCESS_TOKEN: 1,
  CLIENT_ID_AND_SECRET_REQUIRED: 1,
  CLIENT_SECRET_REQUIRED: 1,
  AUTH_SECRET: 1,
  BETTER_AUTH_TELEMETRY: 1,
  BETTER_AUTH_TELEMETRY_DEBUG: 1,
  BETTER_AUTH_TELEMETRY_ENDPOINT: 1,
  BETTER_AUTH_TELEMETRY_ID: 1,
  // Crypto algorithm constants
  PBKDF2: 1,
  HMAC: 1,
  ECDSA: 1,
  // CI/deployment platform detection (std-env library)
  RAILWAY_STATIC_URL: 1,
  RENDER: 1,
  TEAMCITY_VERSION: 1,
  VERCEL: 1,
  GOOGLE_CLOUD_FUNCTION_NAME: 1,
  KOYEB: 1,
  NETLIFY: 1,
  DENO_DEPLOYMENT_ID: 1,
  DO_DEPLOYMENT_ID: 1,
  DYNO: 1,
  FLY_APP_NAME: 1,
  AZURE_FUNCTION_NAME: 1,
  CF_PAGES: 1,
  CI_NAME: 1,
  // Terminal detection environment variables
  TERM: 1,
  TERM_PROGRAM: 1,
  TERM_PROGRAM_VERSION: 1,
  TMUX: 1,
  // HTTP status code constants
  UNAUTHORIZED: 1,
  UNPROCESSABLE_ENTITY: 1,
  INTERNAL_SERVER_ERROR: 1,
  NOT_FOUND: 1,
  FOUND: 1,
  FORBIDDEN: 1,
  EXPECTATION_FAILED: 1,
  BAD_REQUEST: 1,
  // Color/terminal output detection
  FORCE_COLOR: 1,
  NO_COLOR: 1,
  NODE_DISABLE_COLORS: 1,
  COLORTERM: 1,
  // Package/version constants
  PACKAGE_VERSION: 1
}

// Patterns that indicate SemVer constants or version parsing patterns (NOT env vars)
// These are string constants used by semver library that match SCREAMING_SNAKE_CASE
const semverPatterns = [
  /^(FULL|LOOSE|PLAIN|PRE|RANGE|CARET|TILDE|STAR|XRANGE|LONE|TRIM|HYPEN|GT|LT|GTE|COERCE|MAIN|NUMERIC|PRERELEASE|BUILD|NONNUMERIC)/,
  /LOOSE$/,
  /PLAIN$/,
  /RANGE$/,
  /TRIM$/
]

function isSemverConstant(variable: string): boolean {
  return semverPatterns.some((pattern) => pattern.test(variable))
}

// Patterns that indicate library operation types or domain literals, not environment variables
// These are verb+noun patterns commonly used in ORMs and libraries (e.g., ElectroDB)
const operationTypePatterns = [
  /^(Create|Delete|Update|Get|Put|Scan|Query|Batch|Find|List|Remove|Insert|Upsert)(One|Many|Item|Items|All)?$/,
  /Notification$/, // Type literals like MetadataNotification, DownloadReadyNotification
  /Join$/, // SQL join types: InnerJoin, LeftJoin, RightJoin, FullJoin, CrossJoin, etc.
  /^Lateral/, // SQL lateral joins: LateralLeftJoin, LateralInnerJoin, etc.
  /Apply$/, // SQL apply types: CrossApply, OuterApply
  /^Array/, // SQL/ORM array operations: ArrayLocation
  /^Member$/ // SQL/ORM member access
]

function isOperationType(variable: string): boolean {
  return operationTypePatterns.some((pattern) => pattern.test(variable))
}

function filterSourceVariables(extractedVariables: string[]): string[] {
  return extractedVariables.filter((variable) => {
    // Keep our SCREAMING_SNAKE_CASE environment variables
    // Filter out: npm_ vars, excluded vars, library operation types, semver constants
    return !variable.startsWith('npm_') &&
      !Object.prototype.hasOwnProperty.call(excludedSourceVariables, variable) &&
      !isOperationType(variable) &&
      !isSemverConstant(variable)
  })
}

function preprocessInfrastructurePlan(infrastructurePlan: InfrastructureD) {
  const cloudFrontDistributionNames: Record<string, number> = {}
  const environmentVariablesForFunction: Record<string, string[]> = {}
  const lambdaFunctions = infrastructurePlan.resource.aws_lambda_function as unknown as Record<string, unknown[]>
  const lambdaFunctionNames = Object.keys(lambdaFunctions)
  for (const functionName of lambdaFunctionNames) {
    logDebug('aws_lambda_function.name', functionName)
    const resources = lambdaFunctions[functionName]
    const resource = resources[0] as {environment?: {variables?: Record<string, unknown>}[]}
    const environments = resource.environment
    logDebug('aws_lambda_function.resource', resource)
    if (environments && environments[0].variables) {
      environmentVariablesForFunction[functionName] = Object.keys(environments[0].variables)
      logDebug(`environmentVariablesForFunction[${functionName}] = ${environmentVariablesForFunction[functionName]}`)
    }
  }
  logDebug('CloudFront distribution name', cloudFrontDistributionNames)
  logDebug('Environment variables by function', environmentVariablesForFunction)
  logDebug('Lambda function names', lambdaFunctionNames)
  return {cloudFrontDistributionNames, lambdaFunctionNames, environmentVariablesForFunction}
}

function getEnvironmentVariablesFromSource(functionName: string, sourceCodeRegex: RegExp, matchSubstring: number, matchSlice = [0]) {
  // You need to use the build version here to see dependent environment variables
  const functionPath = `${__dirname}/../../build/lambdas/${functionName}.mjs`
  const functionSource = fs.readFileSync(functionPath, 'utf8')
  let environmentVariablesSource: string[] = []

  // Match direct process.env access patterns
  const matches = functionSource.match(sourceCodeRegex)
  logDebug(`functionSource.match(${sourceCodeRegex})`, JSON.stringify(matches))
  if (matches && matches.length > 0) {
    const extracted = matches.map((match: string) => match.substring(matchSubstring).slice(...matchSlice))
    environmentVariablesSource.push(...extracted)
  }

  // Also match minified getRequiredEnv/getOptionalEnv patterns
  // After minification, these become patterns like:
  // - X("ENV_VAR_NAME") where X is a single-letter minified function name
  // - yn("ENV_VAR_NAME") where yn is a 2-3 letter minified function name
  // - }("ENV_VAR_NAME") for IIFE patterns (immediately invoked function expressions)
  // - $("ENV_VAR_NAME") where $ is used as minified function name ($ is not a word char in regex)
  // - bF("ENV_VAR_NAME","default") for two-argument calls like getOptionalEnv (esbuild preserves both args)
  // Match function calls with string arguments that look like env vars (SCREAMING_SNAKE_CASE, min 3 chars)
  const envValidationRegex = /(?:\b[a-zA-Z_][a-zA-Z0-9_$]{0,2}|\$|\})\(["']([A-Z][A-Z0-9_]{2,})["'](?:,[^)]+)?\)/g
  const envValidationMatches = functionSource.match(envValidationRegex)
  logDebug('functionSource.match(envValidationRegex)', JSON.stringify(envValidationMatches))
  if (envValidationMatches && envValidationMatches.length > 0) {
    const extracted = envValidationMatches.map((match: string) => {
      // Extract the variable name from patterns like X("ENV_VAR") or bF("ENV_VAR","default")
      const varMatch = match.match(/\(["']([A-Z][A-Z0-9_]{2,})["']/)
      return varMatch ? varMatch[1] : ''
    }).filter(Boolean)
    environmentVariablesSource.push(...extracted)
  }

  // Deduplicate and filter
  environmentVariablesSource = filterSourceVariables([...new Set(environmentVariablesSource)])
  logDebug(`environmentVariablesSource[${functionName}] = ${environmentVariablesSource}`)
  return environmentVariablesSource
}

describe('#Infrastructure', () => {
  const jsonFilePath = `${__dirname}/../../build/infrastructure.json`
  logDebug('Retrieving infrastructure configuration')
  const jsonFile = fs.readFileSync(jsonFilePath, 'utf8')
  logDebug('JSON file', jsonFile)
  const infrastructurePlan = JSON.parse(jsonFile) as InfrastructureD
  const {cloudFrontDistributionNames, lambdaFunctionNames, environmentVariablesForFunction} = preprocessInfrastructurePlan(infrastructurePlan)
  for (const functionName of lambdaFunctionNames) {
    let environmentVariablesTerraform: string[] = []
    if (environmentVariablesForFunction[functionName]) {
      environmentVariablesTerraform = environmentVariablesForFunction[functionName]
      for (const environmentVariable of environmentVariablesTerraform) {
        test(`should respect environment variable naming ${environmentVariable}`, async () => {
          // Skip naming convention tests for infrastructure-level variables
          if (Object.prototype.hasOwnProperty.call(excludedSourceVariables, environmentVariable)) {
            return
          }
          if (cloudFrontDistributionNames[functionName]) {
            // CloudFront custom headers use lowercase kebab-case
            expect(environmentVariable).toMatch(/^x-[a-z-]+$/)
          } else {
            // All environment variables must be SCREAMING_SNAKE_CASE
            expect(environmentVariable).toMatch(/^[A-Z][A-Z0-9_]*$/)
          }
        })
      }
    }

    let matchSlice = [0]
    let matchSubstring = 0
    let sourceCodeRegex
    if (cloudFrontDistributionNames[functionName]) {
      matchSlice = [0, -2]
      matchSubstring = 15
      sourceCodeRegex = /customHeaders\["([\w-]+)"]/g
    } else {
      matchSubstring = 12
      sourceCodeRegex = /process\.env(?:\[['"]([^'"\]]+)['"]\]|\.(\w+))/gi
    }
    const environmentVariablesSource = getEnvironmentVariablesFromSource(functionName, sourceCodeRegex, matchSubstring, matchSlice)
    const environmentVariablesSourceCount = environmentVariablesSource.length
    test(`should match environment variables for lambda ${functionName}`, async () => {
      // Filter out infrastructure-level variables from Terraform list for comparison
      const filteredTerraformVars = environmentVariablesTerraform.filter((v) => !Object.prototype.hasOwnProperty.call(excludedSourceVariables, v))
      expect(filteredTerraformVars.sort()).toEqual(environmentVariablesSource.sort())
      expect(filteredTerraformVars.length).toEqual(environmentVariablesSourceCount)
    })
  }
})
