/**
 * TypeSpec to Zod Schema Generator
 *
 * Parses TypeSpec definitions and generates Zod validation schemas.
 * This replaces manual schema definitions with generated, type-safe validators.
 *
 * Usage: npx tsx scripts/generateApiTypes.ts
 *
 * @see https://typespec.io/docs/libraries/compiler/
 */
import {compile, isArrayModelType, Model, Namespace, NodeHost, Program, Type, Enum as TSEnum} from '@typespec/compiler'
import * as fs from 'node:fs'
import * as path from 'node:path'

const OUTPUT_DIR = 'src/types/api-schema'

interface GeneratedSchema {
  name: string
  zodSchema: string
  isEnum: boolean
}

/**
 * Convert TypeSpec type to Zod schema string
 */
function typeToZod(type: Type, program: Program): string {
  switch (type.kind) {
    case 'Scalar': {
      const scalarName = type.name
      switch (scalarName) {
        case 'string':
          return 'z.string()'
        case 'boolean':
          return 'z.boolean()'
        case 'int32':
        case 'int64':
        case 'float32':
        case 'float64':
        case 'numeric':
          return 'z.number()'
        case 'url':
          return 'z.string().url()'
        default:
          // Handle extended scalars
          if (type.baseScalar) {
            return typeToZod(type.baseScalar, program)
          }
          return 'z.unknown()'
      }
    }
    case 'Model': {
      // Check if it's an array
      if (isArrayModelType(program, type)) {
        const elementType = type.indexer?.value
        if (elementType) {
          return `z.array(${typeToZod(elementType, program)})`
        }
        return 'z.array(z.unknown())'
      }
      // Reference another model
      const modelName = type.name
      if (modelName) {
        return `${camelCase(modelName)}Schema`
      }
      // Inline object
      return modelToZodObject(type, program)
    }
    case 'Enum': {
      const enumName = type.name
      if (enumName) {
        return `${camelCase(enumName)}Schema`
      }
      return 'z.unknown()'
    }
    case 'Union': {
      // Handle union types (A | B | C)
      const variants: string[] = []
      for (const variant of type.variants.values()) {
        if (variant.type.kind === 'String') {
          variants.push(`z.literal('${variant.type.value}')`)
        } else {
          variants.push(typeToZod(variant.type, program))
        }
      }
      if (variants.length === 1) {
        return variants[0]
      }
      return `z.union([${variants.join(', ')}])`
    }
    case 'String':
      return `z.literal('${type.value}')`
    case 'Number':
      return `z.literal(${type.value})`
    case 'Boolean':
      return `z.literal(${type.value})`
    default:
      return 'z.unknown()'
  }
}

/**
 * Convert a TypeSpec Model to Zod object schema
 */
function modelToZodObject(model: Model, program: Program): string {
  const properties: string[] = []

  for (const [propName, prop] of model.properties) {
    let zodType = typeToZod(prop.type, program)
    if (prop.optional) {
      zodType = `${zodType}.optional()`
    }
    properties.push(`  ${propName}: ${zodType}`)
  }

  if (properties.length === 0) {
    return 'z.object({})'
  }

  return `z.object({\n${properties.join(',\n')}\n})`
}

/**
 * Generate Zod schema for an enum
 */
function enumToZod(enumType: TSEnum): string {
  const values: string[] = []
  for (const member of enumType.members.values()) {
    if (typeof member.value === 'string') {
      values.push(`'${member.value}'`)
    } else if (typeof member.value === 'number') {
      values.push(`${member.value}`)
    } else {
      // Use member name as value
      values.push(`'${member.name}'`)
    }
  }
  return `z.enum([${values.join(', ')}])`
}

/**
 * Convert PascalCase to camelCase
 */
function camelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1)
}

// Domain model names we want to include from TypeSpec
const DOMAIN_MODELS = new Set([
  'File',
  'FileListResponse',
  'Device',
  'DeviceRegistrationRequest',
  'DeviceRegistrationResponse',
  'FeedlyWebhookRequest',
  'WebhookResponse',
  'UserLoginRequest',
  'UserLoginResponse',
  'UserRegistrationRequest',
  'UserRegistrationResponse',
  'UserSubscriptionRequest',
  'UserSubscriptionResponse',
  'TokenRefreshResponse',
  'ClientEventRequest',
  'ErrorResponse',
  'UnauthorizedError',
  'ForbiddenError',
  'InternalServerError'
])

const DOMAIN_ENUMS = new Set(['FileStatus'])

/**
 * Collect all models and enums from a namespace recursively
 * Only includes types from the OfflineMediaDownloader namespace
 */
function collectTypes(namespace: Namespace, program: Program, namespacePath = ''): GeneratedSchema[] {
  const schemas: GeneratedSchema[] = []
  const currentPath = namespacePath ? `${namespacePath}.${namespace.name}` : namespace.name

  // Only process OfflineMediaDownloader namespaces
  const isOurNamespace = currentPath.startsWith('OfflineMediaDownloader')

  if (isOurNamespace) {
    // Collect enums first (they may be referenced by models)
    for (const [name, enumType] of namespace.enums) {
      if (DOMAIN_ENUMS.has(name)) {
        schemas.push({
          name,
          zodSchema: enumToZod(enumType),
          isEnum: true
        })
      }
    }

    // Collect models
    for (const [name, model] of namespace.models) {
      if (DOMAIN_MODELS.has(name)) {
        schemas.push({
          name,
          zodSchema: modelToZodObject(model, program),
          isEnum: false
        })
      }
    }
  }

  // Recurse into sub-namespaces
  for (const [, subNs] of namespace.namespaces) {
    schemas.push(...collectTypes(subNs, program, currentPath))
  }

  return schemas
}

/**
 * Sort schemas so dependencies come before dependents
 */
function topologicalSort(schemas: GeneratedSchema[]): GeneratedSchema[] {
  // Enums first, then models
  const enums = schemas.filter((s) => s.isEnum)
  const models = schemas.filter((s) => !s.isEnum)
  return [...enums, ...models]
}

/**
 * Apply post-processing fixes to generated schemas
 * - Add YouTube URL validation to FeedlyWebhook.articleURL
 */
function postProcessSchemas(schemas: GeneratedSchema[]): GeneratedSchema[] {
  return schemas.map((schema) => {
    if (schema.name === 'FeedlyWebhookRequest') {
      // Replace z.string().url() with YouTube regex validation for articleURL
      schema.zodSchema = schema.zodSchema.replace(
        /articleURL: z\.string\(\)\.url\(\)/,
        "articleURL: z.string().regex(youtubeUrlPattern, 'is not a valid YouTube URL')"
      )
    }
    return schema
  })
}

/**
 * Generate the schemas.ts file content
 */
function generateSchemasFile(schemas: GeneratedSchema[]): string {
  const lines = [
    '/**',
    ' * Generated Zod schemas from TypeSpec definitions',
    ' * DO NOT EDIT - This file is auto-generated by scripts/generateApiTypes.ts',
    ' */',
    "import { z } from 'zod'",
    ''
  ]

  // YouTube URL pattern for validation (from original schemas.ts)
  lines.push('// YouTube URL regex pattern for validation')
  lines.push(
    "const youtubeUrlPattern = /^((?:https?:)?\\/\\/)?((?:www|m)\\.)?((?:youtube(?:-nocookie)?\\.com|youtu.be))(\\/(?:[\\w-]+\\?v=|embed\\/|live\\/|v\\/)?)?([\\w-]+)(\\S+)?$/"
  )
  lines.push('')

  const sorted = topologicalSort(postProcessSchemas(schemas))

  for (const schema of sorted) {
    const schemaName = `${camelCase(schema.name)}Schema`
    lines.push(`export const ${schemaName} = ${schema.zodSchema}`)
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Generate the types.ts file content
 */
function generateTypesFile(schemas: GeneratedSchema[]): string {
  const lines = [
    '/**',
    ' * Generated TypeScript types from Zod schemas',
    ' * DO NOT EDIT - This file is auto-generated by scripts/generateApiTypes.ts',
    ' */',
    "import { z } from 'zod'",
    "import * as schemas from './schemas'",
    ''
  ]

  const sorted = topologicalSort(schemas)

  for (const schema of sorted) {
    const typeName = schema.name
    const schemaName = `${camelCase(schema.name)}Schema`
    lines.push(`export type ${typeName} = z.infer<typeof schemas.${schemaName}>`)
  }

  lines.push('')
  return lines.join('\n')
}

/**
 * Generate the index.ts file content
 *
 * TODO: Consider generating named exports instead of wildcard to improve tree-shaking.
 * Current pattern `export *` bundles all schemas even when Lambda only needs 1-2.
 * See: docs/wiki/Infrastructure/Bundle-Size-Analysis.md
 */
function generateIndexFile(): string {
  return `/**
 * API Schema exports
 * DO NOT EDIT - This file is auto-generated by scripts/generateApiTypes.ts
 */
export * from './schemas'
export * from './types'
`
}

async function main() {
  console.log('Compiling TypeSpec definitions...')

  // Compile TypeSpec using NodeHost
  const program = await compile(NodeHost, path.join(process.cwd(), 'tsp/main.tsp'), {
    noEmit: true,
    warningAsError: false
  })

  // Check for errors
  if (program.diagnostics.length > 0) {
    for (const diag of program.diagnostics) {
      if (diag.severity === 'error') {
        console.error(`Error: ${diag.message}`)
      }
    }
    // Continue even with warnings
    const errors = program.diagnostics.filter((d) => d.severity === 'error')
    if (errors.length > 0) {
      process.exit(1)
    }
  }

  console.log('Extracting models and enums...')

  // Collect all types from the global namespace
  const schemas: GeneratedSchema[] = []
  for (const [, ns] of program.getGlobalNamespaceType().namespaces) {
    schemas.push(...collectTypes(ns, program))
  }

  console.log(`Found ${schemas.length} types`)

  // Create output directory
  const outputPath = path.join(process.cwd(), OUTPUT_DIR)
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, {recursive: true})
  }

  // Generate files
  console.log('Generating schema files...')

  fs.writeFileSync(path.join(outputPath, 'schemas.ts'), generateSchemasFile(schemas))
  fs.writeFileSync(path.join(outputPath, 'types.ts'), generateTypesFile(schemas))
  fs.writeFileSync(path.join(outputPath, 'index.ts'), generateIndexFile())

  console.log(`Generated files in ${OUTPUT_DIR}/`)
  console.log('  - schemas.ts')
  console.log('  - types.ts')
  console.log('  - index.ts')
}

main().catch((err) => {
  console.error('Error generating API types:', err)
  process.exit(1)
})
