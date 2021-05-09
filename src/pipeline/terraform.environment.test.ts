import * as fs from 'fs'
import chai from 'chai'
import {TerraformD} from '../types/terraform'
const expect = chai.expect
import Log from 'debug-level'
const log = new Log(__filename.slice(__dirname.length + 1, -3))

// IF YOU ADD NEW DEPENDENCIES YOU MAY NEED TO ADD MORE EXCLUSIONS HERE
const excludedSourceVariables = {
  hasOwnProperty: 1,
  let: 1,
  no_proxy: 1,
  t: 1
}

// TODO: These parsing rules will need to be represented somewhere
// A lambda associated with a cloudfront distribution must share the same name
// Environment variables should never be all caps or with an npm_ prefix
// Underlying dependencies include their own environment variables

// They need to be excluded from the filtering
function filterSourceVariables(extractedVariables: string[]): string[] {
  return extractedVariables.filter((variable) => {
    return variable !== variable.toUpperCase() && !variable.startsWith('npm_') && !Object.prototype.hasOwnProperty.call(excludedSourceVariables, variable)
  })
}

function preprocessTerraformPlan(terraformPlan: TerraformD) {
  const cloudFrontDistributionNames = {}
  const environmentVariablesForFunction = {}
  const lambdaFunctionNames = {}
  for (const resource of terraformPlan.planned_values.root_module.resources) {
    if (!resource.values) {
      continue
    }
    if (resource.type !== 'aws_cloudfront_distribution' && resource.type !== 'aws_lambda_function') {
      continue
    }
    log.debug('preprocessTerraformPlan.resource', resource)
    const functionName = resource.name
    // determine which lambda functions are aws_cloudfront_distributions and exclude them
    if (resource.type === 'aws_cloudfront_distribution') {
      const functionName = resource.values.comment
      cloudFrontDistributionNames[functionName] = 1
    } else if (resource.type === 'aws_lambda_function') {
      lambdaFunctionNames[functionName] = 1
    }
    if (resource.values.environment && resource.values.environment.length > 0) {
      if (resource.values.environment.length > 1) {
        throw new Error('Invalid environment structure in Terraform output')
      }
      if (resource.values.environment[0].variables) {
        environmentVariablesForFunction[functionName] = Object.keys(resource.values.environment[0].variables)
        log.debug(`environmentVariablesForFunction[${functionName}] = ${environmentVariablesForFunction[functionName]}`)
      }
    }
    if (resource.values.origin && resource.values.origin.length > 0) {
      environmentVariablesForFunction[functionName] = resource.values.origin[0].custom_header.map((header) => header.name.toLowerCase())
      log.debug(`environmentVariablesForFunction[${functionName}] = ${environmentVariablesForFunction[functionName]}`)
    }
  }
  log.debug('CloudFront distribution name', cloudFrontDistributionNames)
  log.debug('Environment variables by function', environmentVariablesForFunction)
  log.debug('Lambda function names', lambdaFunctionNames)
  return {cloudFrontDistributionNames, lambdaFunctionNames, environmentVariablesForFunction}
}

// TODO: Improve this include both process.env.VARIABLE and process.env['VARIABLE'] syntax
const jsonFilePath = `${__dirname}/../../build/terraform.json`
log.info('Retrieving Terraform plan configuration')
const jsonFile = fs.readFileSync(jsonFilePath, 'utf8')
log.debug('JSON file', jsonFile)
const terraformPlan = JSON.parse(jsonFile) as TerraformD
const {cloudFrontDistributionNames, environmentVariablesForFunction} = preprocessTerraformPlan(terraformPlan)

describe('#Terraform', () => {
  for (const resource of terraformPlan.planned_values.root_module.resources) {
    if (resource.type !== 'aws_lambda_function') {
      continue
    }
    const functionName = resource.name
    let sourceCodeRegex: RegExp
    if (cloudFrontDistributionNames[functionName]) {
      // It should be customHeaders\["(.+)"]\.value; but that changes at compile time
      sourceCodeRegex = /\.\w+\["(.+)"]\.value/g
    } else {
      sourceCodeRegex = /process.env\.(\w+)/g
    }
    let environmentVariablesTerraform = []
    let environmentVariablesTerraformCount = 0
    if (environmentVariablesForFunction[functionName]) {
      environmentVariablesTerraform = environmentVariablesForFunction[functionName]
      environmentVariablesTerraformCount = environmentVariablesTerraform.length
    }
    // You need to use the build version here to see dependent environment variables
    const functionPath = `${__dirname}/../../build/lambdas/${functionName}.js`
    const functionSource = fs.readFileSync(functionPath, 'utf8')
    const matches = functionSource.match(sourceCodeRegex)
    let environmentVariablesSource = []
    let environmentVariablesSourceCount = 0
    if (matches && matches.length > 0) {
      console.log(`sourceCodeRegex[${functionName}] = ${sourceCodeRegex}`)
      environmentVariablesSource = filterSourceVariables([...new Set(matches.map((match: string) => match.substring(12)))])
      console.log(`environmentVariablesSource[${functionName}] = ${environmentVariablesSource}`)
      environmentVariablesSourceCount = environmentVariablesSource.length
    }
    it(`should match environment variables for lambda ${functionName}`, async () => {
      expect(environmentVariablesTerraform.sort()).to.eql(environmentVariablesSource.sort())
      expect(environmentVariablesTerraformCount).to.equal(environmentVariablesSourceCount)
    })
  }
})
