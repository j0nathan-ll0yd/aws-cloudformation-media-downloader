/**
 * Service IAM Policy Generator
 *
 * Generates Terraform IAM policy documents from @RequiresServices and @RequiresDynamoDB
 * decorator metadata. Creates aws_iam_policy_document, aws_iam_policy, and
 * aws_iam_role_policy_attachment resources for each Lambda with service permissions.
 *
 * Output: terraform/generated_service_permissions.tf
 *
 * Usage: pnpm run generate:service-iam-policies
 *
 * @see docs/wiki/Infrastructure/Lambda-Decorators.md
 */
import {execSync} from 'child_process'
import {existsSync, readFileSync, unlinkSync, writeFileSync} from 'fs'
import {dirname, join} from 'path'
import {fileURLToPath} from 'url'
import {writeIfChanged} from './lib/writeIfChanged.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

type ServiceType = 's3' | 'sqs' | 'sns' | 'events' | 'apigateway' | 'lambda'

interface ServicePermission {
  service: ServiceType
  resource: string
  hasWildcard: boolean
  arnRef: string
  operations: string[]
}

interface LambdaServicePermissions {
  services: ServicePermission[]
}

interface ServicePermissionsManifest {
  lambdas: Record<string, LambdaServicePermissions>
  generatedAt: string
}

interface DynamoDBPermission {
  table: string
  arnRef: string
  operations: string[]
}

interface LambdaDynamoDBPermissions {
  tables: DynamoDBPermission[]
}

interface DynamoDBPermissionsManifest {
  lambdas: Record<string, LambdaDynamoDBPermissions>
  generatedAt: string
}

/**
 * Generate a policy document statement for a service permission
 */
function generateStatement(permission: ServicePermission, comment: string): string {
  const actions = permission.operations.map((op) => `"${op}"`).join(', ')

  // Build resource ARN reference
  let resourceArns: string[]

  if (permission.service === 'apigateway') {
    // API Gateway requires specific ARN paths for resources
    // Format: arn:aws:apigateway:{region}::/{path}
    resourceArns = [
      '"arn:aws:apigateway:${data.aws_region.current.id}::/apikeys"',
      '"arn:aws:apigateway:${data.aws_region.current.id}::/apikeys/*"',
      '"arn:aws:apigateway:${data.aws_region.current.id}::/usageplans"',
      '"arn:aws:apigateway:${data.aws_region.current.id}::/usageplans/*"'
    ]
  } else if (permission.hasWildcard) {
    // For wildcard permissions (like S3 objects), append /* to the ARN
    resourceArns = [`"\${${permission.arnRef}}/*"`]
  } else {
    resourceArns = [`${permission.arnRef}`]
  }

  const resourcesStr = resourceArns.length === 1
    ? resourceArns[0]
    : `[\n      ${resourceArns.join(',\n      ')}\n    ]`

  return `  # ${comment}
  statement {
    actions = [${actions}]
    resources = ${resourceArns.length === 1 ? `[${resourcesStr}]` : resourcesStr}
  }`
}

/**
 * Generate service description for comments
 */
function getServiceDescription(service: ServiceType): string {
  const descriptions: Record<ServiceType, string> = {
    's3': 'S3',
    'sqs': 'SQS',
    'sns': 'SNS',
    'events': 'EventBridge',
    'apigateway': 'API Gateway',
    'lambda': 'Lambda'
  }
  return descriptions[service] || service
}

/**
 * Generate a policy document statement for a DynamoDB permission
 */
function generateDynamoDBStatement(permission: DynamoDBPermission): string {
  const actions = permission.operations.map((op) => `"${op}"`).join(', ')
  const comment = `DynamoDB: ${permission.table}`
  return `  # ${comment}
  statement {
    actions = [${actions}]
    resources = [${permission.arnRef}]
  }`
}

/**
 * Generate Terraform HCL for a Lambda's service permissions
 */
function generateLambdaPolicies(
  lambdaName: string,
  servicePerms: LambdaServicePermissions | undefined,
  dynamodbPerms: LambdaDynamoDBPermissions | undefined
): string {
  const services = servicePerms?.services || []
  const tables = dynamodbPerms?.tables || []

  if (services.length === 0 && tables.length === 0) {
    return ''
  }

  const serviceNames: string[] = []
  if (services.length > 0) {
    serviceNames.push(...services.map((s) => getServiceDescription(s.service)))
  }
  if (tables.length > 0) {
    serviceNames.push('DynamoDB')
  }

  const lines: string[] = [
    `# ${lambdaName}: ${[...new Set(serviceNames)].join(' + ')} permissions`,
    `data "aws_iam_policy_document" "${lambdaName}_services" {`
  ]

  for (const perm of services) {
    const comment = `${getServiceDescription(perm.service)}: ${perm.resource}${perm.hasWildcard ? '/*' : ''}`
    lines.push(generateStatement(perm, comment))
  }

  for (const tbl of tables) {
    lines.push(generateDynamoDBStatement(tbl))
  }

  lines.push('}')
  lines.push('')
  lines.push(`resource "aws_iam_policy" "${lambdaName}_services" {`)
  lines.push(`  name   = "\${var.resource_prefix}-${lambdaName}-services"`)
  lines.push(`  policy = data.aws_iam_policy_document.${lambdaName}_services.json`)
  lines.push('  tags   = local.common_tags')
  lines.push('}')
  lines.push('')
  lines.push(`resource "aws_iam_role_policy_attachment" "${lambdaName}_services" {`)
  lines.push(`  role       = aws_iam_role.${lambdaName}.name`)
  lines.push(`  policy_arn = aws_iam_policy.${lambdaName}_services.arn`)
  lines.push('}')

  return lines.join('\n')
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const serviceManifestPath = join(projectRoot, 'build/service-permissions.json')
  const dynamodbManifestPath = join(projectRoot, 'build/dynamodb-permissions.json')

  // Load service permissions (required)
  if (!existsSync(serviceManifestPath)) {
    console.error('Error: build/service-permissions.json not found.')
    console.error('Run: pnpm run extract:service-permissions first.')
    process.exit(1)
  }

  console.log('Reading build/service-permissions.json...')
  const serviceManifest: ServicePermissionsManifest = JSON.parse(readFileSync(serviceManifestPath, 'utf-8'))
  console.log(`Loaded service permissions for ${Object.keys(serviceManifest.lambdas).length} Lambdas`)

  // Load DynamoDB permissions (optional)
  let dynamodbManifest: DynamoDBPermissionsManifest = {lambdas: {}, generatedAt: ''}
  if (existsSync(dynamodbManifestPath)) {
    console.log('Reading build/dynamodb-permissions.json...')
    dynamodbManifest = JSON.parse(readFileSync(dynamodbManifestPath, 'utf-8'))
    console.log(`Loaded DynamoDB permissions for ${Object.keys(dynamodbManifest.lambdas).length} Lambdas`)
  } else {
    console.log('Note: build/dynamodb-permissions.json not found, skipping DynamoDB permissions.')
  }

  // Generate header
  const header = `# Auto-generated Lambda IAM policies from @RequiresServices and @RequiresDynamoDB decorators
# Generated at: ${new Date().toISOString()}
# Source: build/service-permissions.json, build/dynamodb-permissions.json
#
# DO NOT EDIT - regenerate with: pnpm run generate:service-iam-policies
#
# This file creates IAM policies based on the @RequiresServices and @RequiresDynamoDB
# decorator declarations in Lambda handler code. Each Lambda gets a policy document,
# an IAM policy, and a role policy attachment.

`

  // Combine all Lambda names from both manifests
  const allLambdas = new Set([
    ...Object.keys(serviceManifest.lambdas),
    ...Object.keys(dynamodbManifest.lambdas)
  ])

  // Generate policies for each Lambda
  const policies: string[] = []
  for (const lambdaName of [...allLambdas].sort()) {
    const servicePerms = serviceManifest.lambdas[lambdaName]
    const dynamodbPerms = dynamodbManifest.lambdas[lambdaName]
    const policy = generateLambdaPolicies(lambdaName, servicePerms, dynamodbPerms)
    if (policy) {
      policies.push(policy)
    }
  }

  const content = header + policies.join('\n\n') + '\n'

  // Write to temp file, format with tofu fmt if available, then compare
  const outputPath = join(projectRoot, 'terraform/generated_service_permissions.tf')
  let formattedContent = content

  // Try to format with tofu if available (optional - may not be installed in CI)
  try {
    execSync('which tofu', {stdio: 'pipe'})
    const tempPath = join(projectRoot, 'terraform/generated_service_permissions_tmp.tf')
    writeFileSync(tempPath, content)
    execSync(`tofu fmt ${tempPath}`, {stdio: 'pipe'})
    formattedContent = readFileSync(tempPath, 'utf-8')
    unlinkSync(tempPath)
  } catch {
    console.log('Note: tofu not installed, skipping Terraform formatting')
  }

  const result = writeIfChanged(outputPath, formattedContent)

  if (result.written) {
    console.log(`\n${result.reason === 'new' ? 'Created' : 'Updated'}: ${outputPath}`)
  } else {
    console.log(`\nNo changes: ${outputPath}`)
  }
  console.log(`\nCreated IAM policies for:`)
  for (const lambdaName of [...allLambdas].sort()) {
    const servicePerms = serviceManifest.lambdas[lambdaName]
    const dynamodbPerms = dynamodbManifest.lambdas[lambdaName]
    const parts: string[] = []
    if (servicePerms) {
      parts.push(...servicePerms.services.map((s) => `${s.service}:${s.resource}${s.hasWildcard ? '/*' : ''}`))
    }
    if (dynamodbPerms) {
      parts.push(...dynamodbPerms.tables.map((t) => `dynamodb:${t.table}`))
    }
    console.log(`  - ${lambdaName}: ${parts.join(', ')}`)
  }

  console.log('\n=== Next Steps ===')
  console.log('1. Review the generated terraform/generated_service_permissions.tf')
  console.log('2. Run: cd terraform && tofu validate')
  console.log('3. If valid, existing hardcoded policies in Lambda .tf files can be removed')
}

main().catch((error) => {
  console.error('Failed to generate IAM policies:', error)
  process.exit(1)
})
