/**
 * Naming conventions handler for MCP server
 * Provides naming validation and TypeSpec alignment checking
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import {fileURLToPath} from 'url'
import {Project, SourceFile} from 'ts-morph'
import {createSuccessResponse} from './shared/response-types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '../../..')

// Type definitions for naming analysis
interface TypeDefinition {
  name: string
  kind: 'interface' | 'type' | 'enum' | 'model'
  properties: PropertyDefinition[]
  file: string
  line: number
}

interface PropertyDefinition {
  name: string
  type: string
  optional: boolean
}

interface AlignmentIssue {
  typeName: string
  issue: string
  typeScriptValue?: string
  typeSpecValue?: string
  suggestion: string
}

interface NamingViolation {
  name: string
  file: string
  line: number
  issue: string
  currentPattern: string
  expectedPattern: string
  autoFixable: boolean
  suggestedName: string
}

// Naming convention patterns
const NAMING_RULES = {
  forbiddenPrefixes: [
    {prefix: 'DynamoDB', replacement: 'Record', message: 'Use *Record suffix instead of DynamoDB* prefix'},
    {prefix: 'I', replacement: '', message: "Don't use 'I' prefix for interfaces"},
    {prefix: 'T', replacement: '', message: "Don't use 'T' prefix for types"}
  ],
  suffixPatterns: [
    {suffix: 'Response', contexts: ['api', 'http', 'lambda'], description: 'API response wrapper'},
    {suffix: 'Request', contexts: ['api', 'http', 'lambda'], description: 'API request payload'},
    {suffix: 'Input', contexts: ['mutation', 'create', 'update'], description: 'Mutation input parameters'},
    {suffix: 'Item', contexts: ['entity', 'drizzle'], description: 'Drizzle entity return type'},
    {suffix: 'Record', contexts: ['persistence', 'database'], description: 'Database record type'}
  ],
  domainModels: ['User', 'File', 'Device', 'Session']
}

/**
 * Parse TypeSpec models from a .tsp file
 */
async function parseTypeSpecModels(tspPath: string): Promise<TypeDefinition[]> {
  const models: TypeDefinition[] = []
  try {
    const content = await fs.readFile(tspPath, 'utf-8')
    const lines = content.split('\n')

    let currentModel: TypeDefinition | null = null
    let braceDepth = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNum = i + 1

      // Match model definition
      const modelMatch = line.match(/^(?:\/\*\*[\s\S]*?\*\/\s*)?model\s+(\w+)\s*\{/)
      if (modelMatch) {
        currentModel = {name: modelMatch[1], kind: 'model', properties: [], file: tspPath, line: lineNum}
        braceDepth = 1
        continue
      }

      // Match enum definition
      const enumMatch = line.match(/^(?:\/\*\*[\s\S]*?\*\/\s*)?enum\s+(\w+)\s*\{/)
      if (enumMatch) {
        currentModel = {name: enumMatch[1], kind: 'enum', properties: [], file: tspPath, line: lineNum}
        braceDepth = 1
        continue
      }

      if (currentModel) {
        // Track brace depth
        braceDepth += (line.match(/\{/g) || []).length
        braceDepth -= (line.match(/\}/g) || []).length

        // Match property
        const propMatch = line.match(/^\s*(\w+)(\?)?:\s*(.+?);?\s*$/)
        if (propMatch && braceDepth === 1) {
          currentModel.properties.push({name: propMatch[1], type: propMatch[3].replace(/;$/, '').trim(), optional: propMatch[2] === '?'})
        }

        // End of model
        if (braceDepth === 0) {
          models.push(currentModel)
          currentModel = null
        }
      }
    }
  } catch {
    // File doesn't exist or can't be read
  }
  return models
}

/**
 * Parse TypeScript types from a file
 */
async function parseTypeScriptTypes(filePath: string): Promise<TypeDefinition[]> {
  const types: TypeDefinition[] = []
  const project = new Project({skipFileDependencyResolution: true})

  try {
    const sourceFile = project.addSourceFileAtPath(filePath)

    // Get interfaces
    for (const iface of sourceFile.getInterfaces()) {
      const properties: PropertyDefinition[] = []
      for (const prop of iface.getProperties()) {
        properties.push({name: prop.getName(), type: prop.getType().getText(), optional: prop.hasQuestionToken()})
      }
      types.push({name: iface.getName(), kind: 'interface', properties, file: filePath, line: iface.getStartLineNumber()})
    }

    // Get type aliases with object structure
    for (const typeAlias of sourceFile.getTypeAliases()) {
      types.push({name: typeAlias.getName(), kind: 'type', properties: [], file: filePath, line: typeAlias.getStartLineNumber()})
    }

    // Get enums
    for (const enumDecl of sourceFile.getEnums()) {
      const properties: PropertyDefinition[] = []
      for (const member of enumDecl.getMembers()) {
        const initializer = member.getInitializer()
        properties.push({name: member.getName(), type: initializer ? initializer.getText().replace(/['"]/g, '') : member.getName(), optional: false})
      }
      types.push({name: enumDecl.getName(), kind: 'enum', properties, file: filePath, line: enumDecl.getStartLineNumber()})
    }
  } catch {
    // File parsing error
  }

  return types
}

/**
 * Check alignment between TypeScript types and TypeSpec models
 */
export async function handleTypeAlignmentQuery(args: {typeName?: string; query: 'check' | 'list' | 'all'}) {
  const {typeName, query} = args
  const tspPath = path.join(projectRoot, 'tsp/models/models.tsp')
  const typesDirs = [
    path.join(projectRoot, 'src/types/domain-models.d.ts'),
    path.join(projectRoot, 'src/types/request-types.d.ts'),
    path.join(projectRoot, 'src/types/persistence-types.d.ts'),
    path.join(projectRoot, 'src/types/enums.ts')
  ]

  // Parse TypeSpec models
  const typeSpecModels = await parseTypeSpecModels(tspPath)

  // Parse TypeScript types
  const allTypeScriptTypes: TypeDefinition[] = []
  for (const typeFile of typesDirs) {
    try {
      const types = await parseTypeScriptTypes(typeFile)
      allTypeScriptTypes.push(...types)
    } catch {
      // Skip files that don't exist
    }
  }

  const issues: AlignmentIssue[] = []

  if (query === 'list') {
    return createSuccessResponse({
      aligned: true,
      issues: [],
      typeSpecModels: typeSpecModels.map((m) => m.name),
      typeScriptTypes: allTypeScriptTypes.map((t) => t.name)
    })
  }

  // Check specific type or all types
  const modelsToCheck = typeName ? typeSpecModels.filter((m) => m.name === typeName) : typeSpecModels

  for (const model of modelsToCheck) {
    const tsType = allTypeScriptTypes.find((t) => t.name === model.name || t.name === model.name + 'Response' || t.name === model.name + 'Input')

    if (!tsType) {
      issues.push({
        typeName: model.name,
        issue: 'TypeSpec model has no corresponding TypeScript type',
        typeSpecValue: model.name,
        suggestion: `Create TypeScript type '${model.name}' in src/types/`
      })
      continue
    }

    // Check properties alignment for models (not enums)
    if (model.kind === 'model' && tsType.kind === 'interface') {
      const tsProps = new Set(tsType.properties.map((p) => p.name))
      const tspProps = new Set(model.properties.map((p) => p.name))

      // Find missing in TypeScript
      for (const prop of model.properties) {
        if (!tsProps.has(prop.name)) {
          issues.push({
            typeName: model.name,
            issue: `Property '${prop.name}' exists in TypeSpec but missing in TypeScript`,
            typeSpecValue: `${prop.name}: ${prop.type}`,
            suggestion: `Add property '${prop.name}' to TypeScript type`
          })
        }
      }

      // Find extra in TypeScript
      for (const prop of tsType.properties) {
        if (!tspProps.has(prop.name)) {
          issues.push({
            typeName: model.name,
            issue: `Property '${prop.name}' exists in TypeScript but missing in TypeSpec`,
            typeScriptValue: `${prop.name}: ${prop.type}`,
            suggestion: `Add property '${prop.name}' to TypeSpec model or remove from TypeScript`
          })
        }
      }
    }

    // Check enum value alignment
    if (model.kind === 'enum' && tsType.kind === 'enum') {
      const tsValues = new Set(tsType.properties.map((p) => p.type))
      const tspValues = new Set(model.properties.map((p) => p.type))

      for (const prop of model.properties) {
        if (!tsValues.has(prop.type)) {
          issues.push({
            typeName: model.name,
            issue: `Enum value '${prop.type}' exists in TypeSpec but missing in TypeScript`,
            typeSpecValue: prop.type,
            suggestion: `Add enum value '${prop.name} = "${prop.type}"' to TypeScript enum`
          })
        }
      }

      for (const prop of tsType.properties) {
        if (!tspValues.has(prop.type)) {
          issues.push({
            typeName: model.name,
            issue: `Enum value '${prop.type}' exists in TypeScript but missing in TypeSpec`,
            typeScriptValue: prop.type,
            suggestion: `Add enum value to TypeSpec or remove from TypeScript`
          })
        }
      }
    }
  }

  return createSuccessResponse({
    aligned: issues.length === 0,
    issues,
    typeSpecModels: typeSpecModels.map((m) => m.name),
    typeScriptTypes: allTypeScriptTypes.map((t) => t.name)
  })
}

/**
 * Validate naming conventions across files
 */
export async function handleNamingValidationQuery(args: {file?: string; query: 'validate' | 'suggest' | 'all'}) {
  const {file, query} = args
  const violations: NamingViolation[] = []
  const suggestions: {file: string; fixes: {current: string; suggested: string; reason: string}[]}[] = []

  // Get files to check
  const filesToCheck: string[] = []
  if (file) {
    filesToCheck.push(path.isAbsolute(file) ? file : path.join(projectRoot, file))
  } else {
    // Check all type files
    const typeFiles = [
      'src/types/domain-models.d.ts',
      'src/types/request-types.d.ts',
      'src/types/persistence-types.d.ts',
      'src/types/notification-types.d.ts',
      'src/types/infrastructure-types.d.ts',
      'src/types/enums.ts'
    ]
    for (const f of typeFiles) {
      filesToCheck.push(path.join(projectRoot, f))
    }
  }

  const project = new Project({skipFileDependencyResolution: true})

  for (const filePath of filesToCheck) {
    let sourceFile: SourceFile
    try {
      sourceFile = project.addSourceFileAtPath(filePath)
    } catch {
      continue // Skip files that don't exist
    }

    const relativePath = path.relative(projectRoot, filePath)
    const fileFixes: {current: string; suggested: string; reason: string}[] = []

    // Check interfaces
    for (const iface of sourceFile.getInterfaces()) {
      const name = iface.getName()
      const line = iface.getStartLineNumber()

      // Check forbidden prefixes
      for (const rule of NAMING_RULES.forbiddenPrefixes) {
        if (name.startsWith(rule.prefix) && name.length > rule.prefix.length) {
          const suggestedName = rule.prefix === 'DynamoDB'
            ? name.replace(/^DynamoDB/, '') + 'Record'
            : rule.prefix === 'I' || rule.prefix === 'T'
            ? name.slice(1)
            : name + rule.replacement

          violations.push({
            name,
            file: relativePath,
            line,
            issue: rule.message,
            currentPattern: `${rule.prefix}*`,
            expectedPattern: rule.prefix === 'DynamoDB' ? '*Record' : 'No prefix',
            autoFixable: true,
            suggestedName
          })

          fileFixes.push({current: name, suggested: suggestedName, reason: rule.message})
        }
      }
    }

    // Check type aliases
    for (const typeAlias of sourceFile.getTypeAliases()) {
      const name = typeAlias.getName()
      const line = typeAlias.getStartLineNumber()

      for (const rule of NAMING_RULES.forbiddenPrefixes) {
        if (name.startsWith(rule.prefix) && name.length > rule.prefix.length) {
          const suggestedName = rule.prefix === 'DynamoDB'
            ? name.replace(/^DynamoDB/, '') + 'Record'
            : rule.prefix === 'I' || rule.prefix === 'T'
            ? name.slice(1)
            : name + rule.replacement

          violations.push({
            name,
            file: relativePath,
            line,
            issue: rule.message,
            currentPattern: `${rule.prefix}*`,
            expectedPattern: rule.prefix === 'DynamoDB' ? '*Record' : 'No prefix',
            autoFixable: true,
            suggestedName
          })

          fileFixes.push({current: name, suggested: suggestedName, reason: rule.message})
        }
      }
    }

    // Check enums for PascalCase
    for (const enumDecl of sourceFile.getEnums()) {
      const enumName = enumDecl.getName()
      for (const member of enumDecl.getMembers()) {
        const memberName = member.getName()
        const initializer = member.getInitializer()
        const line = member.getStartLineNumber()

        // Check if value is lowercase
        if (initializer) {
          const value = initializer.getText().replace(/['"]/g, '')
          if (value === value.toLowerCase() && value.length > 0) {
            const pascalValue = value.charAt(0).toUpperCase() + value.slice(1)
            violations.push({
              name: `${enumName}.${memberName}`,
              file: relativePath,
              line,
              issue: 'Enum value should be PascalCase',
              currentPattern: value,
              expectedPattern: pascalValue,
              autoFixable: true,
              suggestedName: pascalValue
            })

            fileFixes.push({
              current: `${memberName} = '${value}'`,
              suggested: `${memberName} = '${pascalValue}'`,
              reason: 'Enum values should be PascalCase'
            })
          }
        }
      }
    }

    if (fileFixes.length > 0) {
      suggestions.push({file: relativePath, fixes: fileFixes})
    }
  }

  return createSuccessResponse({valid: violations.length === 0, violations, suggestions: query === 'suggest' || query === 'all' ? suggestions : []})
}
