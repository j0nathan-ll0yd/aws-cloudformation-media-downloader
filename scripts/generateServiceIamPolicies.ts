/**
 * Service IAM Policy Generator
 *
 * Generates Terraform IAM policy documents from @RequiresServices decorator metadata.
 * Creates aws_iam_policy_document, aws_iam_policy, and aws_iam_role_policy_attachment
 * resources for each Lambda with service permissions.
 *
 * Output: terraform/generated_service_permissions.tf
 *
 * Usage: pnpm run generate:service-iam-policies
 *
 * @see docs/wiki/Infrastructure/Lambda-Decorators.md
 */
import {existsSync, readFileSync, writeFileSync} from 'fs'
import {dirname, join} from 'path'
import {fileURLToPath} from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

type ServiceType = 's3' | 'sqs' | 'sns' | 'events'

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

/**
 * Generate a policy document statement for a service permission
 */
function generateStatement(permission: ServicePermission, comment: string): string {
  const actions = permission.operations.map((op) => `"${op}"`).join(', ')

  // Build resource ARN reference
  let resourceArn: string
  if (permission.hasWildcard) {
    // For wildcard permissions (like S3 objects), append /* to the ARN
    resourceArn = `"\${${permission.arnRef}}/*"`
  } else {
    resourceArn = `${permission.arnRef}`
  }

  return `  # ${comment}
  statement {
    actions   = [${actions}]
    resources = [${resourceArn}]
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
    'events': 'EventBridge'
  }
  return descriptions[service]
}

/**
 * Generate Terraform HCL for a Lambda's service permissions
 */
function generateLambdaPolicies(lambdaName: string, permissions: LambdaServicePermissions): string {
  const serviceNames = permissions.services.map((s) => getServiceDescription(s.service)).join(' + ')

  const lines: string[] = [
    `# ${lambdaName}: ${serviceNames} permissions`,
    `data "aws_iam_policy_document" "${lambdaName}_services" {`
  ]

  for (const perm of permissions.services) {
    const comment = `${getServiceDescription(perm.service)}: ${perm.resource}${perm.hasWildcard ? '/*' : ''}`
    lines.push(generateStatement(perm, comment))
  }

  lines.push('}')
  lines.push('')
  lines.push(`resource "aws_iam_policy" "${lambdaName}_services" {`)
  lines.push(`  name   = "${lambdaName}-services"`)
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
  const manifestPath = join(projectRoot, 'build/service-permissions.json')

  if (!existsSync(manifestPath)) {
    console.error('Error: build/service-permissions.json not found.')
    console.error('Run: pnpm run extract:service-permissions first.')
    process.exit(1)
  }

  console.log('Reading build/service-permissions.json...')
  const manifest: ServicePermissionsManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))

  console.log(`Loaded permissions for ${Object.keys(manifest.lambdas).length} Lambdas`)
  console.log(`Generated at: ${manifest.generatedAt}`)

  // Generate header
  const header = `# Auto-generated Lambda IAM policies from @RequiresServices decorators
# Generated at: ${new Date().toISOString()}
# Source: build/service-permissions.json
#
# DO NOT EDIT - regenerate with: pnpm run generate:service-iam-policies
#
# This file creates IAM policies based on the @RequiresServices decorator
# declarations in Lambda handler code. Each Lambda gets a policy document,
# an IAM policy, and a role policy attachment.

`

  // Generate policies for each Lambda
  const policies: string[] = []
  for (const [lambdaName, perms] of Object.entries(manifest.lambdas).sort()) {
    policies.push(generateLambdaPolicies(lambdaName, perms))
  }

  const content = header + policies.join('\n\n') + '\n'

  // Write to terraform directory
  const outputPath = join(projectRoot, 'terraform/generated_service_permissions.tf')
  writeFileSync(outputPath, content)

  console.log(`\nGenerated ${outputPath}`)
  console.log(`\nCreated IAM policies for:`)
  for (const [name, perms] of Object.entries(manifest.lambdas).sort()) {
    const services = perms.services.map((s) => `${s.service}:${s.resource}${s.hasWildcard ? '/*' : ''}`).join(', ')
    console.log(`  - ${name}: ${services}`)
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
