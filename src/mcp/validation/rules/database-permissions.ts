/**
 * Database Permissions Rule
 * HIGH: Lambda handlers that import entity queries must have `@RequiresDatabase` decorator
 *
 * This rule ensures that database access requirements are explicitly declared.
 */

import type {SourceFile} from 'ts-morph'
import {SyntaxKind} from 'ts-morph'
import {createViolation} from '../types'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'database-permissions'
const SEVERITY = 'HIGH' as const

/**
 * Query function to table mapping
 * Maps imported query functions to the tables they access
 */
const QUERY_TABLE_MAP: Record<string, string> = {
  // User queries
  getUser: 'users',
  getUserByEmail: 'users',
  createUser: 'users',
  updateUser: 'users',
  deleteUser: 'users',
  // File queries
  getFile: 'files',
  getFiles: 'files',
  getFilesByKey: 'files',
  createFile: 'files',
  updateFile: 'files',
  deleteFile: 'files',
  // FileDownload queries
  getFileDownload: 'file_downloads',
  createFileDownload: 'file_downloads',
  updateFileDownload: 'file_downloads',
  deleteFileDownload: 'file_downloads',
  // Device queries
  getDevice: 'devices',
  getAllDevices: 'devices',
  getDevicesBatch: 'devices',
  upsertDevice: 'devices',
  deleteDevice: 'devices',
  // Session queries
  getSession: 'sessions',
  createSession: 'sessions',
  deleteSession: 'sessions',
  // Account queries
  getAccountByProvider: 'accounts',
  createAccount: 'accounts',
  // VerificationToken queries
  getVerificationToken: 'verification_tokens',
  createVerificationToken: 'verification_tokens',
  deleteVerificationToken: 'verification_tokens',
  // UserFiles (junction table)
  getUserFilesByUserId: 'user_files',
  getUserFilesByFileId: 'user_files',
  getFilesForUser: 'user_files',
  createUserFile: 'user_files',
  deleteUserFile: 'user_files',
  deleteUserFilesByUserId: 'user_files',
  deleteUserFilesByFileId: 'user_files',
  // UserDevices (junction table)
  getUserDevicesByUserId: 'user_devices',
  getUserDevicesByDeviceId: 'user_devices',
  upsertUserDevice: 'user_devices',
  deleteUserDevice: 'user_devices',
  deleteUserDevicesByUserId: 'user_devices',
  deleteUserDevicesByDeviceId: 'user_devices'
}

/**
 * Extract imported query function names from entity import
 */
function getImportedQueryFunctions(sourceFile: SourceFile): string[] {
  const imports = sourceFile.getImportDeclarations()
  const queryFunctions: string[] = []

  for (const importDecl of imports) {
    const moduleSpecifier = importDecl.getModuleSpecifierValue()
    if (moduleSpecifier === '#entities/queries' || moduleSpecifier.startsWith('#entities/queries/')) {
      // Get named imports
      const namedImports = importDecl.getNamedImports()
      for (const named of namedImports) {
        queryFunctions.push(named.getName())
      }
    }
  }

  return queryFunctions
}

/**
 * Check if a class has the `@RequiresDatabase` decorator
 */
function hasRequiresDatabaseDecorator(sourceFile: SourceFile): boolean {
  const classes = sourceFile.getClasses()
  for (const classDecl of classes) {
    const decorator = classDecl.getDecorator('RequiresDatabase')
    if (decorator) {
      return true
    }
  }
  return false
}

/**
 * Extract declared tables from `@RequiresDatabase` decorator
 */
function getDeclaredTables(sourceFile: SourceFile): Set<string> {
  const tables = new Set<string>()
  const classes = sourceFile.getClasses()

  for (const classDecl of classes) {
    const decorator = classDecl.getDecorator('RequiresDatabase')
    if (!decorator) {
      continue
    }

    // Parse decorator arguments
    const args = decorator.getArguments()
    if (args.length === 0) {
      continue
    }

    const objLiteral = args[0].asKind(SyntaxKind.ObjectLiteralExpression)
    if (!objLiteral) {
      continue
    }

    for (const prop of objLiteral.getProperties()) {
      if (prop.isKind(SyntaxKind.PropertyAssignment)) {
        const name = prop.getName()
        if (name === 'tables') {
          const arrayLiteral = prop.getInitializer()?.asKind(SyntaxKind.ArrayLiteralExpression)
          if (arrayLiteral) {
            for (const element of arrayLiteral.getElements()) {
              const tableObj = element.asKind(SyntaxKind.ObjectLiteralExpression)
              if (tableObj) {
                for (const tableProp of tableObj.getProperties()) {
                  if (tableProp.isKind(SyntaxKind.PropertyAssignment)) {
                    if (tableProp.getName() === 'table') {
                      const initText = tableProp.getInitializer()?.getText() || ''
                      // Extract table name from DatabaseTable.Users format
                      const match = initText.match(/DatabaseTable\.(\w+)/)
                      if (match) {
                        // Convert PascalCase to snake_case
                        const tableName = match[1].replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
                        tables.add(tableName)
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return tables
}

export const databasePermissionsRule: ValidationRule = {
  name: RULE_NAME,
  description: 'Lambda handlers that import entity queries must have @RequiresDatabase decorator with appropriate table permissions.',
  severity: SEVERITY,
  appliesTo: ['src/lambdas/*/src/index.ts'],
  excludes: [],

  validate(sourceFile: SourceFile, _filePath: string): Violation[] {
    void _filePath
    const violations: Violation[] = []

    // Get imported query functions
    const importedQueries = getImportedQueryFunctions(sourceFile)

    // If no query functions imported, no validation needed
    if (importedQueries.length === 0) {
      return violations
    }

    // Check if @RequiresDatabase decorator exists
    if (!hasRequiresDatabaseDecorator(sourceFile)) {
      // Find the import line for better error location
      const imports = sourceFile.getImportDeclarations()
      const entityImport = imports.find((i) => i.getModuleSpecifierValue().includes('#entities/queries'))
      const line = entityImport ? entityImport.getStartLineNumber() : 1

      violations.push(
        createViolation(RULE_NAME, SEVERITY, line, 'Lambda handler imports entity queries but is missing @RequiresDatabase decorator', {
          suggestion: 'Add @RequiresDatabase decorator to the handler class with appropriate table permissions',
          codeSnippet: `Imported queries: ${importedQueries.join(', ')}`
        })
      )
      return violations
    }

    // Get declared tables from decorator
    const declaredTables = getDeclaredTables(sourceFile)

    // Check if all imported queries have corresponding table declarations
    const tablesFromQueries = new Set<string>()
    for (const query of importedQueries) {
      const table = QUERY_TABLE_MAP[query]
      if (table) {
        tablesFromQueries.add(table)
      }
    }

    // Find undeclared tables
    const undeclaredTables: string[] = []
    for (const table of tablesFromQueries) {
      if (!declaredTables.has(table)) {
        undeclaredTables.push(table)
      }
    }

    if (undeclaredTables.length > 0) {
      const classes = sourceFile.getClasses()
      const classWithDecorator = classes.find((c) => c.getDecorator('RequiresDatabase'))
      const line = classWithDecorator ? classWithDecorator.getStartLineNumber() : 1

      violations.push(
        createViolation(RULE_NAME, SEVERITY, line, `@RequiresDatabase decorator is missing permissions for tables: ${undeclaredTables.join(', ')}`, {
          suggestion: 'Add the missing tables to the @RequiresDatabase decorator',
          codeSnippet: `Declared: [${[...declaredTables].join(', ')}], Required: [${[...tablesFromQueries].join(', ')}]`
        })
      )
    }

    return violations
  }
}
