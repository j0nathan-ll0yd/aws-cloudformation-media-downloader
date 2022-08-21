import * as fs from 'fs'
import * as chai from 'chai'
import {AwsCloudfrontDistribution, AwsCloudfrontDistributionProduction, AwsLambdaFunction, TerraformD} from '../types/terraform'
const expect = chai.expect
import Debug from 'debug'
const log = Debug(__filename.slice(__dirname.length + 1, -3))

// IF NEW DEPENDENCIES ARE ADDED, YOU MAY NEED TO ADD MORE EXCLUSIONS HERE
const excludedSourceVariables = {
  hasOwnProperty: 1,
  let: 1,
  no_proxy: 1,
  t: 1
}

function filterSourceVariables(extractedVariables: string[]): string[] {
  return extractedVariables.filter((variable) => {
    return variable !== variable.toUpperCase() && !variable.startsWith('npm_') && !Object.prototype.hasOwnProperty.call(excludedSourceVariables, variable)
  })
}

function preprocessTerraformPlan(terraformPlan: TerraformD) {
  const cloudFrontDistributionNames: Record<string, number> = {}
  const environmentVariablesForFunction: Record<string, string[]> = {}
  const distributions: string[] = Object.keys(terraformPlan.resource.aws_cloudfront_distribution)
  distributions.map((key: keyof AwsCloudfrontDistribution) => {
    log('aws_cloudfront_distribution.name', key)
    const resource = terraformPlan.resource.aws_cloudfront_distribution[key] as AwsCloudfrontDistributionProduction
    log('aws_cloudfront_distribution.resource', resource)
    if (resource.origin && resource.origin.custom_header) {
      const matches = resource.comment.match(/aws_lambda_function\.(\w+)\.function_name/)
      log('resource.comment.match', matches)
      const functionName = matches[1]
      cloudFrontDistributionNames[functionName] = 1
      environmentVariablesForFunction[functionName] = resource.origin.custom_header.map((header) => header.name.toLowerCase())
      log(`environmentVariablesForFunction[${functionName}] = ${environmentVariablesForFunction[functionName]}`)
    }
  })
  const lambdaFunctionNames = Object.keys(terraformPlan.resource.aws_lambda_function)
  for (const functionName of lambdaFunctionNames) {
    log('aws_lambda_function.name', functionName)
    const resource = terraformPlan.resource.aws_lambda_function[functionName] as AwsLambdaFunction
    log('aws_lambda_function.resource', resource)
    if (resource.environment && resource.environment.variables) {
      environmentVariablesForFunction[functionName] = Object.keys(resource.environment.variables)
      log(`environmentVariablesForFunction[${functionName}] = ${environmentVariablesForFunction[functionName]}`)
    }
  }
  log('CloudFront distribution name', cloudFrontDistributionNames)
  log('Environment variables by function', environmentVariablesForFunction)
  log('Lambda function names', lambdaFunctionNames)
  return {cloudFrontDistributionNames, lambdaFunctionNames, environmentVariablesForFunction}
}

function getEnvironmentVariablesFromSource(functionName: string, sourceCodeRegex: RegExp, matchSubstring: number, matchSlice = [0]) {
  // You need to use the build version here to see dependent environment variables
  const functionPath = `${__dirname}/../../build/lambdas/${functionName}.js`
  const functionSource = fs.readFileSync(functionPath, 'utf8')
  let environmentVariablesSource: string[]
  const matches = functionSource.match(sourceCodeRegex)
  log(`functionSource.match(${sourceCodeRegex})`, matches)
  if (matches && matches.length > 0) {
    environmentVariablesSource = filterSourceVariables([...new Set(matches.map((match: string) => match.substring(matchSubstring).slice(...matchSlice)))])
    log(`environmentVariablesSource[${functionName}] = ${environmentVariablesSource}`)
  }
  return environmentVariablesSource
}

describe('#Terraform', () => {
  const jsonFilePath = `${__dirname}/../../build/terraform.json`
  log('Retrieving Terraform plan configuration')
  const jsonFile = fs.readFileSync(jsonFilePath, 'utf8')
  log('JSON file', jsonFile)
  const terraformPlan = JSON.parse(jsonFile) as TerraformD
  const {cloudFrontDistributionNames, lambdaFunctionNames, environmentVariablesForFunction} = preprocessTerraformPlan(terraformPlan)
  for (const functionName of lambdaFunctionNames) {
    let environmentVariablesTerraform: string[] = []
    let environmentVariablesTerraformCount = 0
    if (environmentVariablesForFunction[functionName]) {
      environmentVariablesTerraform = environmentVariablesForFunction[functionName]
      environmentVariablesTerraformCount = environmentVariablesTerraform.length
      for (const environmentVariable of environmentVariablesTerraform) {
        it(`should respect environment variable naming ${environmentVariable}`, async () => {
          expect(environmentVariable.toUpperCase()).to.not.eql(environmentVariable)
          if (cloudFrontDistributionNames[functionName]) {
            expect(environmentVariable)
              .to.be.a('string')
              .and.match(/^x-[a-z-]+$/)
          } else {
            expect(environmentVariable)
              .to.be.a('string')
              .and.match(/^[A-Z][A-Za-z]*$/)
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
      // TODO: Improve this include both process.env.VARIABLE and process.env['VARIABLE'] syntax
      matchSubstring = 12
      sourceCodeRegex = /process.env\.(\w+)/g
    }
    const environmentVariablesSource = getEnvironmentVariablesFromSource(functionName, sourceCodeRegex, matchSubstring, matchSlice)
    const environmentVariablesSourceCount = environmentVariablesSource.length
    it(`should match environment variables for lambda ${functionName}`, async () => {
      expect(environmentVariablesTerraform.sort()).to.eql(environmentVariablesSource.sort())
      expect(environmentVariablesTerraformCount).to.equal(environmentVariablesSourceCount)
    })
  }
})
