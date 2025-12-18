/**
 * Naming Conventions Rule
 * HIGH: Validates TypeScript type names follow project conventions
 *
 * Pattern Standards:
 * - Domain entities: Simple nouns (User, File, Device)
 * - Entity items: *Item suffix (UserItem, FileItem)
 * - Mutation inputs: Create*Input, Update*Input
 * - Request payloads: *Input suffix
 * - Response types: *Response suffix
 * - Relationship types: Simple nouns (UserDevice, UserFile)
 * - Enums: PascalCase values
 *
 * @see docs/wiki/Conventions/Naming-Conventions.md
 */

import type {SourceFile} from 'ts-morph'
import {createViolation} from '../types'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'naming-conventions'
const SEVERITY = 'HIGH' as const

// Forbidden prefixes that indicate old patterns
const FORBIDDEN_PREFIXES = [
  {
    prefix: 'DynamoDB',
    message: 'Use domain model names (e.g., File, User) instead of DynamoDB* prefix',
    autoFix: (name: string) => name.replace(/^DynamoDB/, '')
  },
  {prefix: 'I', message: "Don't use 'I' prefix for interfaces (e.g., use User instead of IUser)", autoFix: (name: string) => name.slice(1)},
  {prefix: 'T', message: "Don't use 'T' prefix for types (e.g., use Status instead of TStatus)", autoFix: (name: string) => name.slice(1)}
]

// Valid enum value patterns (PascalCase)
const PASCAL_CASE_PATTERN = /^[A-Z][a-zA-Z0-9]*$/

/**
 * Check if a string is in PascalCase
 */
function isPascalCase(str: string): boolean {
  return PASCAL_CASE_PATTERN.test(str)
}

/**
 * Convert to suggested PascalCase
 */
function toPascalCase(str: string): string {
  // Handle snake_case
  if (str.includes('_')) {
    return str.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join('')
  }
  // Handle already lowercase
  if (str === str.toLowerCase()) {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }
  return str
}

export const namingConventionsRule: ValidationRule = {
  name: RULE_NAME,
  description: 'Type names should follow project naming conventions (no DynamoDB* prefix, PascalCase enums, proper suffixes)',
  severity: SEVERITY,
  appliesTo: ['src/**/*.ts', 'src/**/*.d.ts'],
  excludes: ['**/*.test.ts', 'test/**/*.ts', 'src/mcp/**/*.ts'],

  validate(sourceFile: SourceFile, filePath: string): Violation[] {
    const violations: Violation[] = []

    // Check type aliases
    const typeAliases = sourceFile.getTypeAliases()
    for (const typeAlias of typeAliases) {
      const name = typeAlias.getName()
      const line = typeAlias.getStartLineNumber()

      // Check for forbidden prefixes
      for (const {prefix, message, autoFix} of FORBIDDEN_PREFIXES) {
        if (name.startsWith(prefix) && name.length > prefix.length) {
          // Only flag if it's a pattern like DynamoDBFile, not just "DynamoDB"
          if (prefix === 'DynamoDB' || name[prefix.length] === name[prefix.length].toUpperCase()) {
            violations.push(
              createViolation(RULE_NAME, SEVERITY, line, `Type '${name}': ${message}`, {
                suggestion: `Rename to '${autoFix(name)}'`,
                codeSnippet: typeAlias.getText().substring(0, 60)
              })
            )
          }
        }
      }
    }

    // Check interfaces
    const interfaces = sourceFile.getInterfaces()
    for (const iface of interfaces) {
      const name = iface.getName()
      const line = iface.getStartLineNumber()

      // Check for forbidden prefixes
      for (const {prefix, message, autoFix} of FORBIDDEN_PREFIXES) {
        if (name.startsWith(prefix) && name.length > prefix.length) {
          if (prefix === 'DynamoDB' || name[prefix.length] === name[prefix.length].toUpperCase()) {
            violations.push(
              createViolation(RULE_NAME, SEVERITY, line, `Interface '${name}': ${message}`, {
                suggestion: `Rename to '${autoFix(name)}'`,
                codeSnippet: iface.getText().substring(0, 60)
              })
            )
          }
        }
      }
    }

    // Check enums for PascalCase values
    const enums = sourceFile.getEnums()
    for (const enumDecl of enums) {
      const enumName = enumDecl.getName()
      const members = enumDecl.getMembers()

      for (const member of members) {
        const memberName = member.getName()
        const memberLine = member.getStartLineNumber()
        const initializer = member.getInitializer()

        // Check member name is PascalCase
        if (!isPascalCase(memberName)) {
          violations.push(
            createViolation(RULE_NAME, 'MEDIUM', memberLine, `Enum member '${enumName}.${memberName}' should be PascalCase`, {
              suggestion: `Rename to '${toPascalCase(memberName)}'`
            })
          )
        }

        // Check string value is PascalCase if present
        if (initializer) {
          const value = initializer.getText().replace(/['"]/g, '')
          if (value && !isPascalCase(value) && value !== memberName.toLowerCase()) {
            violations.push(
              createViolation(RULE_NAME, 'MEDIUM', memberLine, `Enum value '${value}' for '${enumName}.${memberName}' should be PascalCase`, {
                suggestion: `Use value '${toPascalCase(value)}'`
              })
            )
          }
        }
      }
    }

    // Check for property naming (camelCase)
    const checkProperties = (node: {getProperties: () => {getName: () => string; getStartLineNumber: () => number}[]}, containerName: string) => {
      for (const prop of node.getProperties()) {
        const propName = prop.getName()
        const propLine = prop.getStartLineNumber()

        // Check for snake_case (common in external APIs)
        if (propName.includes('_') && !filePath.includes('youtube.ts') && !filePath.includes('yt-dlp')) {
          violations.push(
            createViolation(RULE_NAME, 'MEDIUM', propLine, `Property '${containerName}.${propName}' uses snake_case, should be camelCase`, {
              suggestion: `Rename to '${
                propName.split('_').map((p, i) => (i === 0 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())).join('')
              }'`
            })
          )
        }

        // Check ID naming pattern
        if (propName.toLowerCase().endsWith('id') && !propName.endsWith('Id') && propName !== 'id') {
          violations.push(
            createViolation(RULE_NAME, 'LOW', propLine, `Property '${containerName}.${propName}' should use *Id pattern (e.g., userId, fileId)`, {
              suggestion: `Rename to '${propName.slice(0, -2)}Id'`
            })
          )
        }
      }
    }

    // Check interface properties
    for (const iface of interfaces) {
      checkProperties(iface, iface.getName())
    }

    return violations
  }
}
