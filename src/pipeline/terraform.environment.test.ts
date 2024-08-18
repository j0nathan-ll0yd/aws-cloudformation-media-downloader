import {describe, expect, test} from '@jest/globals'
import * as fs from 'fs'
import {AwsLambdaFunction, TerraformD} from '../types/terraform'
import {logDebug} from '../util/lambda-helpers'
import path from 'path'
import {fileURLToPath} from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// IF NEW DEPENDENCIES ARE ADDED, YOU MAY NEED TO ADD MORE EXCLUSIONS HERE
const excludedSourceVariables = {
  hasOwnProperty: 1,
  let: 1,
  no_proxy: 1,
  t: 1
}

function listAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
  const files = fs.readdirSync(dirPath)

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file)
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = listAllFiles(fullPath, arrayOfFiles)
    } else {
      arrayOfFiles.push(fullPath)
    }
  })

  return arrayOfFiles
}

console.log('__dirname', __dirname)
console.log('__filename', __filename)

const allFiles = listAllFiles(__dirname)
console.log(allFiles)

function filterSourceVariables(extractedVariables: string[]): string[] {
  return extractedVariables.filter((variable) => {
    return variable !== variable.toUpperCase() && !variable.startsWith('npm_') && !Object.prototype.hasOwnProperty.call(excludedSourceVariables, variable)
  })
}

function preprocessTerraformPlan(terraformPlan: TerraformD) {
  const cloudFrontDistributionNames: Record<string, number> = {}
  const environmentVariablesForFunction: Record<string, string[]> = {}
  const lambdaFunctionNames = Object.keys(terraformPlan.resource.aws_lambda_function)
  for (const functionName of lambdaFunctionNames) {
    logDebug('aws_lambda_function.name', functionName)
    const resources = terraformPlan.resource.aws_lambda_function[functionName] as AwsLambdaFunction[]
    const resource = resources[0]
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
  let environmentVariablesSource: string[]
  const matches = functionSource.match(sourceCodeRegex)
  logDebug(`functionSource.match(${sourceCodeRegex})`, JSON.stringify(matches))
  if (matches && matches.length > 0) {
    environmentVariablesSource = filterSourceVariables([...new Set(matches.map((match: string) => match.substring(matchSubstring).slice(...matchSlice)))])
    logDebug(`environmentVariablesSource[${functionName}] = ${environmentVariablesSource}`)
    return environmentVariablesSource
  } else {
    return []
  }
}

describe('#Terraform', () => {
  const jsonFilePath = `${__dirname}/../../build/terraform.json`
  logDebug('Retrieving Terraform plan configuration')
  const jsonFile = fs.readFileSync(jsonFilePath, 'utf8')
  logDebug('JSON file', jsonFile)
  const terraformPlan = JSON.parse(jsonFile) as TerraformD
  const {cloudFrontDistributionNames, lambdaFunctionNames, environmentVariablesForFunction} = preprocessTerraformPlan(terraformPlan)
  for (const functionName of lambdaFunctionNames) {
    let environmentVariablesTerraform: string[] = []
    let environmentVariablesTerraformCount = 0
    if (environmentVariablesForFunction[functionName]) {
      environmentVariablesTerraform = environmentVariablesForFunction[functionName]
      environmentVariablesTerraformCount = environmentVariablesTerraform.length
      for (const environmentVariable of environmentVariablesTerraform) {
        test(`should respect environment variable naming ${environmentVariable}`, async () => {
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
      expect(environmentVariablesTerraform.sort()).toEqual(environmentVariablesSource.sort())
      expect(environmentVariablesTerraformCount).toEqual(environmentVariablesSourceCount)
    })
  }
})
