import {describe, expect, test} from '@jest/globals'
import * as fs from 'fs'
import type {InfrastructureD} from '#types/infrastructure'
import {logDebug} from '#util/logging'
import path from 'path'
import {fileURLToPath} from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// IF NEW DEPENDENCIES ARE ADDED, YOU MAY NEED TO ADD MORE EXCLUSIONS HERE
const excludedSourceVariables = {
  hasOwnProperty: 1,
  let: 1,
  no_proxy: 1,
  t: 1,
  http_proxy: 1,
  https_proxy: 1,
  PATH: 1, // System PATH for Lambda runtime and custom binaries
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
  RetryExhausted: 1
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
    return variable !== variable.toUpperCase() && !variable.startsWith('npm_') && !Object.prototype.hasOwnProperty.call(excludedSourceVariables, variable) &&
      !isOperationType(variable)
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
  const functionPath = `${__dirname}/../../build/lambdas/${functionName}.js`
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
  // - X("EnvVarName") where X is a single-letter minified function name
  // - yn("EnvVarName") where yn is a 2-3 letter minified function name
  // - }("EnvVarName") for IIFE patterns (immediately invoked function expressions)
  // - $("EnvVarName") where $ is used as minified function name ($ is not a word char in regex)
  // - bF("EnvVarName","default") for two-argument calls like getOptionalEnv (esbuild preserves both args)
  // Match function calls with string arguments that look like env vars (PascalCase, min 3 chars)
  const envValidationRegex = /(?:\b[a-zA-Z_][a-zA-Z0-9_$]{0,2}|\$|\})\(["']([A-Z][A-Za-z]{2,})["'](?:,[^)]+)?\)/g
  const envValidationMatches = functionSource.match(envValidationRegex)
  logDebug('functionSource.match(envValidationRegex)', JSON.stringify(envValidationMatches))
  if (envValidationMatches && envValidationMatches.length > 0) {
    const extracted = envValidationMatches.map((match: string) => {
      // Extract the variable name from patterns like X("VarName") or bF("VarName","default")
      const varMatch = match.match(/\(["']([A-Z][A-Za-z]{2,})["']/)
      return varMatch ? varMatch[1] : ''
    }).filter(Boolean) // Exclude ALL_CAPS strings (likely constants, not env vars), crypto terms, and library types
      .filter((v) => v !== v.toUpperCase() && !['HMAC', 'ECDSA', 'SHA'].includes(v) && !v.startsWith('Zod'))
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
          expect(environmentVariable.toUpperCase()).not.toBe(environmentVariable)
          if (cloudFrontDistributionNames[functionName]) {
            expect(environmentVariable).toMatch(/^x-[a-z-]+$/)
          } else {
            expect(environmentVariable).toMatch(/^[A-Z][A-Za-z]*$/)
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
