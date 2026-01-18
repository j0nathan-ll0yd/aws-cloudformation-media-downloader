/**
 * Terraform Permission Configuration Generator
 *
 * Reads build/db-permissions.json and generates Terraform locals for
 * Lambda DSQL access levels. Also validates existing Terraform files
 * against declared permissions.
 *
 * Output: terraform/generated/lambda_dsql_access.tf
 *
 * Usage: pnpm run generate:terraform-permissions
 *
 * @see docs/wiki/Infrastructure/Database-Permissions.md
 */
import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from 'fs'
import {dirname, join} from 'path'
import {fileURLToPath} from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

interface TablePermission {
  table: string
  operations: string[]
}

interface LambdaPermissions {
  tables: TablePermission[]
  description?: string
  computedAccessLevel: 'readonly' | 'readwrite' | 'admin'
}

interface PermissionsManifest {
  lambdas: Record<string, LambdaPermissions>
  generatedAt: string
}

interface ValidationIssue {
  lambda: string
  file: string
  type: 'env_var' | 'iam_policy'
  expected: string
  actual: string
  lineNumber?: number
}

/**
 * Map access level to IAM policy name
 */
function accessLevelToIamPolicy(level: 'readonly' | 'readwrite' | 'admin'): string {
  switch (level) {
    case 'readonly': return 'LambdaDSQLReadOnly'
    case 'readwrite': return 'LambdaDSQLReadWrite'
    case 'admin': return 'LambdaDSQLAdmin'
  }
}

/**
 * Generate Terraform locals file
 */
function generateTerraformLocals(manifest: PermissionsManifest): string {
  const lines: string[] = [
    '# Auto-generated from @RequiresDatabase decorators',
    '# Do not edit manually - run: pnpm run generate:terraform-permissions',
    `# Generated at: ${new Date().toISOString()}`,
    '#',
    '# This file provides a reference for Lambda DSQL access levels.',
    '# Update individual Lambda .tf files to use these values.',
    '',
    'locals {',
    '  # Lambda DSQL access level configuration',
    '  # Reference: build/db-permissions.json',
    '  lambda_dsql_access_levels = {'
  ]

  const entries = Object.entries(manifest.lambdas).sort((a, b) => a[0].localeCompare(b[0]))
  const maxLen = Math.max(...entries.map(([name]) => name.length))

  for (const [lambdaName, perms] of entries) {
    const padding = ' '.repeat(maxLen - lambdaName.length)
    lines.push(`    ${lambdaName}${padding} = "${perms.computedAccessLevel}"`)
  }

  lines.push('  }')
  lines.push('')
  lines.push('  # IAM policy ARN mapping')
  lines.push('  lambda_dsql_iam_policies = {')

  for (const [lambdaName, perms] of entries) {
    const padding = ' '.repeat(maxLen - lambdaName.length)
    const policy = accessLevelToIamPolicy(perms.computedAccessLevel)
    lines.push(`    ${lambdaName}${padding} = aws_iam_policy.${policy}.arn`)
  }

  lines.push('  }')
  lines.push('}')
  lines.push('')

  return lines.join('\n')
}

/**
 * Validate existing Terraform files against manifest
 */
function validateTerraformFiles(manifest: PermissionsManifest): ValidationIssue[] {
  const terraformDir = join(projectRoot, 'terraform')
  const issues: ValidationIssue[] = []

  const tfFiles = readdirSync(terraformDir).filter(f => f.endsWith('.tf'))

  for (const tfFile of tfFiles) {
    const filePath = join(terraformDir, tfFile)
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')

    // Check each Lambda in manifest
    for (const [lambdaName, perms] of Object.entries(manifest.lambdas)) {
      // Check if this file handles this Lambda
      const lambdaPattern = new RegExp(`function_name\\s*=\\s*.*${lambdaName}`, 'i')
      if (!lambdaPattern.test(content)) {
        continue
      }

      // Check DSQL_ACCESS_LEVEL environment variable
      const envVarPattern = /DSQL_ACCESS_LEVEL\s*=\s*"(\w+)"/
      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(envVarPattern)
        if (match) {
          const actual = match[1]
          if (actual !== perms.computedAccessLevel) {
            issues.push({
              lambda: lambdaName,
              file: tfFile,
              type: 'env_var',
              expected: perms.computedAccessLevel,
              actual,
              lineNumber: i + 1
            })
          }
        }
      }

      // Check IAM policy attachment
      const expectedPolicy = accessLevelToIamPolicy(perms.computedAccessLevel)
      const iamPolicies = ['LambdaDSQLReadOnly', 'LambdaDSQLReadWrite', 'LambdaDSQLAdmin']

      for (const policy of iamPolicies) {
        if (content.includes(`aws_iam_policy.${policy}.arn`) && content.includes(lambdaName)) {
          // Check if this Lambda uses this policy
          const lambdaBlock = extractLambdaBlock(content, lambdaName)
          if (lambdaBlock && lambdaBlock.includes(`aws_iam_policy.${policy}.arn`)) {
            if (policy !== expectedPolicy) {
              issues.push({
                lambda: lambdaName,
                file: tfFile,
                type: 'iam_policy',
                expected: expectedPolicy,
                actual: policy
              })
            }
          }
        }
      }
    }
  }

  return issues
}

/**
 * Extract the Terraform block for a specific Lambda
 */
function extractLambdaBlock(content: string, lambdaName: string): string | null {
  // Simple heuristic: look for content between resource declarations
  const lines = content.split('\n')
  let inLambdaSection = false
  const block: string[] = []

  for (const line of lines) {
    if (line.includes(lambdaName)) {
      inLambdaSection = true
    }
    if (inLambdaSection) {
      block.push(line)
      // End section on next major resource that's not this Lambda
      if (line.match(/^resource\s+"aws_/) && !line.includes(lambdaName) && block.length > 5) {
        break
      }
    }
  }

  return block.length > 0 ? block.join('\n') : null
}

/**
 * Generate fix suggestions
 */
function generateFixSuggestions(issues: ValidationIssue[]): string {
  const lines: string[] = [
    '# Terraform Permission Fixes Required',
    '',
    'The following changes are needed to align Terraform with @RequiresDatabase decorators:',
    ''
  ]

  // Group by file
  const byFile: Record<string, ValidationIssue[]> = {}
  for (const issue of issues) {
    if (!byFile[issue.file]) {
      byFile[issue.file] = []
    }
    byFile[issue.file].push(issue)
  }

  for (const [file, fileIssues] of Object.entries(byFile)) {
    lines.push(`## ${file}`)
    lines.push('')

    for (const issue of fileIssues) {
      if (issue.type === 'env_var') {
        lines.push(`### ${issue.lambda} - Environment Variable (line ${issue.lineNumber})`)
        lines.push('```diff')
        lines.push(`- DSQL_ACCESS_LEVEL = "${issue.actual}"`)
        lines.push(`+ DSQL_ACCESS_LEVEL = "${issue.expected}"`)
        lines.push('```')
      } else {
        lines.push(`### ${issue.lambda} - IAM Policy`)
        lines.push('```diff')
        lines.push(`- policy_arn = aws_iam_policy.${issue.actual}.arn`)
        lines.push(`+ policy_arn = aws_iam_policy.${issue.expected}.arn`)
        lines.push('```')
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const manifestPath = join(projectRoot, 'build/db-permissions.json')

  if (!existsSync(manifestPath)) {
    console.error('Error: build/db-permissions.json not found.')
    console.error('Run: pnpm run extract:db-permissions first.')
    process.exit(1)
  }

  const manifest: PermissionsManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))

  console.log(`Loaded permissions for ${Object.keys(manifest.lambdas).length} Lambdas`)

  // Generate Terraform locals
  const terraformLocals = generateTerraformLocals(manifest)
  const generatedDir = join(projectRoot, 'terraform/generated')
  if (!existsSync(generatedDir)) {
    mkdirSync(generatedDir, {recursive: true})
  }
  const localsPath = join(generatedDir, 'lambda_dsql_access.tf')
  writeFileSync(localsPath, terraformLocals)
  console.log(`\nGenerated: ${localsPath}`)

  // Validate existing Terraform files
  console.log('\n=== Validating Terraform Files ===\n')
  const issues = validateTerraformFiles(manifest)

  if (issues.length === 0) {
    console.log('All Terraform files match declared permissions.')
  } else {
    console.log(`Found ${issues.length} issue(s):\n`)

    for (const issue of issues) {
      if (issue.type === 'env_var') {
        console.log(`  [ENV] ${issue.file}:${issue.lineNumber} - ${issue.lambda}`)
        console.log(`        Expected: DSQL_ACCESS_LEVEL="${issue.expected}"`)
        console.log(`        Actual:   DSQL_ACCESS_LEVEL="${issue.actual}"`)
      } else {
        console.log(`  [IAM] ${issue.file} - ${issue.lambda}`)
        console.log(`        Expected: aws_iam_policy.${issue.expected}.arn`)
        console.log(`        Actual:   aws_iam_policy.${issue.actual}.arn`)
      }
      console.log('')
    }

    // Generate fix suggestions
    const fixSuggestions = generateFixSuggestions(issues)
    const fixPath = join(projectRoot, 'build/terraform-permission-fixes.md')
    writeFileSync(fixPath, fixSuggestions)
    console.log(`Fix suggestions written to: ${fixPath}`)
  }

  // Summary
  console.log('\n=== Access Level Summary ===')
  const counts = {readonly: 0, readwrite: 0, admin: 0}
  for (const perms of Object.values(manifest.lambdas)) {
    counts[perms.computedAccessLevel]++
  }
  console.log(`  readonly:  ${counts.readonly} Lambdas`)
  console.log(`  readwrite: ${counts.readwrite} Lambdas`)
  console.log(`  admin:     ${counts.admin} Lambdas`)

  // Exit with error if there are issues
  if (issues.length > 0) {
    process.exit(1)
  }
}

main().catch(error => {
  console.error('Failed to generate Terraform configuration:', error)
  process.exit(1)
})
