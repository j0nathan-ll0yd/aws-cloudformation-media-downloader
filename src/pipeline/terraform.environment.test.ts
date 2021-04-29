import {execSync} from 'child_process'
import * as fs from 'fs'
import {TerraformPlan} from './terraform-status'
import chai from 'chai'
const expect = chai.expect

// IF YOU ADD NEW DEPENDENCIES YOU MAY NEED TO ADD MORE EXCLUSIONS HERE
const excludedSourceVariables = {
  hasOwnProperty: undefined,
  let: undefined,
  no_proxy: undefined,
  t: undefined
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

const cloudFrontDistributionNames = {}
const environmentVariablesForFunction = {}
const lambdaFunctionNames = {}
// TODO: Improve this include both process.env.VARIABLE and process.env['VARIABLE'] syntax
const jsonFilePath = `${__dirname}/../../build/terraform.json`
execSync(`cd ${__dirname}/../../terraform && terraform show -json > ${jsonFilePath}`)
const jsonFile = fs.readFileSync(jsonFilePath, 'utf8')
const terraformPlan = JSON.parse(jsonFile) as TerraformPlan.RootObject
for (const resource of terraformPlan.values.root_module.resources) {
  // determine which lambda functions are aws_cloudfront_distributions and exclude them
  const functionName = resource.name
  if (resource.type === 'aws_cloudfront_distribution') {
    cloudFrontDistributionNames[functionName] = undefined
    if (resource.values.origin && resource.values.origin.length > 0) {
      environmentVariablesForFunction[functionName] = resource.values.origin[0].custom_header.map((header) => header.name.toLowerCase())
      console.log(`environmentVariablesForFunction[${functionName}] = ${environmentVariablesForFunction[functionName]}`)
    }
  } else if (resource.type === 'aws_lambda_function') {
    lambdaFunctionNames[functionName] = undefined
    if (resource.values.environment && resource.values.environment.length > 0) {
      if (resource.values.environment.length > 1) {
        throw new Error('Invalid environment structure in Terraform output')
      }
      environmentVariablesForFunction[functionName] = Object.keys(resource.values.environment[0].variables)
      console.log(`environmentVariablesForFunction[${functionName}] = ${environmentVariablesForFunction[functionName]}`)
    }
  }
}

// TODO: This would need to run POST-deploy, because only then is the status updated
describe('#Terraform', () => {
  for (const resource of terraformPlan.values.root_module.resources) {
    if (resource.type !== 'aws_lambda_function') {
      continue
    }
    const functionName = resource.name
    let environmentVariablesTerraformCount = 0
    let environmentVariablesSourceCount = 0
    let environmentVariablesTerraform = []
    let environmentVariablesSource = []
    let sourceCodeRegex: RegExp
    if (cloudFrontDistributionNames[functionName]) {
      sourceCodeRegex = /\.customHeaders\["(.+)"]/g
    } else {
      sourceCodeRegex = /process.env\.(\w+)/g
    }
    if (!environmentVariablesForFunction[functionName]) {
      continue
    }
    environmentVariablesTerraform = environmentVariablesForFunction[functionName]
    environmentVariablesTerraformCount = environmentVariablesTerraform.length
    // You need to use the build version here to see dependent environment variables
    const functionPath = `${__dirname}/../../build/lambdas/${functionName}.js`
    const functionSource = fs.readFileSync(functionPath, 'utf8')
    const matches = functionSource.match(sourceCodeRegex)
    if (matches && matches.length > 0) {
      environmentVariablesSource = filterSourceVariables([...new Set(matches.map((match) => match.substring(12)))])
      console.log(`environmentVariablesSource = ${environmentVariablesSource}`)
      environmentVariablesSourceCount = environmentVariablesSource.length
    }
    it(`should match environment variables for lambda ${functionName}`, async () => {
      expect(environmentVariablesTerraform.sort()).to.eql(environmentVariablesSource.sort())
      expect(environmentVariablesTerraformCount).to.equal(environmentVariablesSourceCount)
    })
  }
})
