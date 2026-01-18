/**
 * Secret Permission Extraction Script
 *
 * Uses ts-morph to extract `@RequiresSecrets` decorator metadata from Lambda handlers
 * and generates a JSON manifest for downstream tooling.
 *
 * Output: build/secret-permissions.json
 *
 * Usage: pnpm run extract:secret-permissions
 *
 * @see docs/wiki/Infrastructure/Lambda-Decorators.md
 */
import {existsSync, mkdirSync, writeFileSync} from 'fs'
import {dirname, join} from 'path'
import {fileURLToPath} from 'url'
import {Project, SyntaxKind} from 'ts-morph'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

interface SecretPermission {
  type: 'secretsmanager' | 'ssm'
  name: string
  encrypted?: boolean
}

interface LambdaSecretPermissions {
  secrets: SecretPermission[]
}

interface SecretPermissionsManifest {
  lambdas: Record<string, LambdaSecretPermissions>
  generatedAt: string
}

/**
 * Extract secret type from expression like SecretType.SecretsManager
 */
function extractSecretType(expr: string): 'secretsmanager' | 'ssm' {
  const match = expr.match(/SecretType\.(\w+)/)
  if (match) {
    const typeMap: Record<string, 'secretsmanager' | 'ssm'> = {
      'SecretsManager': 'secretsmanager',
      'ParameterStore': 'ssm'
    }
    return typeMap[match[1]] || 'secretsmanager'
  }
  // Handle string literal
  if (expr.includes('ssm')) return 'ssm'
  return 'secretsmanager'
}

/**
 * Extract string value from quoted expression
 */
function extractStringValue(expr: string): string {
  const match = expr.match(/['"`]([^'"`]+)['"`]/)
  return match ? match[1] : expr
}

/**
 * Extract boolean value from expression
 */
function extractBooleanValue(expr: string): boolean {
  return expr.trim() === 'true'
}

/**
 * Extract Lambda name from file path
 */
function extractLambdaName(filePath: string): string {
  const match = filePath.match(/lambdas\/([^/]+)\//)
  return match ? match[1] : 'Unknown'
}

/**
 * Main extraction function
 */
async function extractPermissions(): Promise<SecretPermissionsManifest> {
  console.log('Loading TypeScript project...')

  const project = new Project({
    tsConfigFilePath: join(projectRoot, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true
  })

  // Add only Lambda handler files
  const lambdaPattern = join(projectRoot, 'src/lambdas/*/src/index.ts')
  project.addSourceFilesAtPaths(lambdaPattern)

  console.log(`Found ${project.getSourceFiles().length} Lambda handler files`)

  const manifest: SecretPermissionsManifest = {
    lambdas: {},
    generatedAt: new Date().toISOString()
  }

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath()
    const lambdaName = extractLambdaName(filePath)

    // Find classes with @RequiresSecrets decorator
    for (const classDecl of sourceFile.getClasses()) {
      const decorator = classDecl.getDecorator('RequiresSecrets')
      if (!decorator) continue

      console.log(`Processing ${lambdaName}...`)

      // Get decorator arguments
      const args = decorator.getArguments()
      if (args.length === 0) continue

      // Parse the secrets array from the decorator argument
      const secrets: SecretPermission[] = []

      const arrayLiteral = args[0].asKind(SyntaxKind.ArrayLiteralExpression)
      if (arrayLiteral) {
        for (const element of arrayLiteral.getElements()) {
          const secretObj = element.asKind(SyntaxKind.ObjectLiteralExpression)
          if (secretObj) {
            let type: 'secretsmanager' | 'ssm' = 'secretsmanager'
            let name = ''
            let encrypted: boolean | undefined

            for (const prop of secretObj.getProperties()) {
              if (prop.isKind(SyntaxKind.PropertyAssignment)) {
                const propName = prop.getName()
                const initText = prop.getInitializer()?.getText() || ''

                if (propName === 'type') {
                  type = extractSecretType(initText)
                } else if (propName === 'name') {
                  name = extractStringValue(initText)
                } else if (propName === 'encrypted') {
                  encrypted = extractBooleanValue(initText)
                }
              }
            }

            if (name) {
              const secretPerm: SecretPermission = {type, name}
              if (encrypted !== undefined) {
                secretPerm.encrypted = encrypted
              }
              secrets.push(secretPerm)
            }
          }
        }
      }

      if (secrets.length > 0) {
        manifest.lambdas[lambdaName] = {secrets}
      }
    }
  }

  return manifest
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const manifest = await extractPermissions()

    // Ensure build directory exists
    const buildDir = join(projectRoot, 'build')
    if (!existsSync(buildDir)) {
      mkdirSync(buildDir, {recursive: true})
    }

    // Write manifest
    const outputPath = join(buildDir, 'secret-permissions.json')
    writeFileSync(outputPath, JSON.stringify(manifest, null, 2))

    console.log(`\nGenerated ${outputPath}`)
    console.log(`Found permissions for ${Object.keys(manifest.lambdas).length} Lambdas:`)

    for (const [name, perms] of Object.entries(manifest.lambdas)) {
      const secretCount = perms.secrets.length
      console.log(`  - ${name}: ${secretCount} secret(s)`)
      for (const secret of perms.secrets) {
        console.log(`      ${secret.type}: ${secret.name}`)
      }
    }
  } catch (error) {
    console.error('Failed to extract permissions:', error)
    process.exit(1)
  }
}

main()
