/**
 * Comment Conventions Rule
 * HIGH: Validates JSDoc, file headers, and inline comment patterns
 *
 * This rule enforces the conventions documented in docs/wiki/Conventions/Code-Comments.md:
 * - Lambda handler files must have file headers
 * - Exported functions must have JSDoc
 * - @example tags should be short (3 lines max) or use @see/@link instead
 * - Interfaces and type aliases should have JSDoc
 * - @param tags must use hyphen format (TSDoc standard)
 *
 * @see docs/wiki/Conventions/Code-Comments.md
 */

import type {SourceFile} from 'ts-morph'
import {SyntaxKind} from 'ts-morph'
import {createViolation} from '../types'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'comment-conventions'
const SEVERITY = 'HIGH' as const

/** Maximum lines for @example content before suggesting @see/@link */
const MAX_EXAMPLE_LINES = 5

export const commentConventionsRule: ValidationRule = {
  name: RULE_NAME,
  description: 'Validates JSDoc presence, file headers, and comment patterns per Code-Comments.md conventions',
  severity: SEVERITY,
  appliesTo: [
    'src/lambdas/**/src/index.ts',
    'src/lib/**/*.ts',
    'src/entities/*.ts',
    'src/types/*.ts',
    'src/util/*.ts'
  ],
  excludes: ['**/*.test.ts', '**/node_modules/**', 'src/mcp/**/*.ts', '**/api-schema/**', '**/*.fixture.ts'],

  validate(sourceFile: SourceFile, filePath: string): Violation[] {
    const violations: Violation[] = []

    // Check 1: Lambda handler files must have file headers
    if (filePath.includes('src/lambdas/') && filePath.endsWith('/src/index.ts')) {
      violations.push(...validateLambdaFileHeader(sourceFile, filePath))
    }

    // Check 2: Exported functions must have JSDoc
    violations.push(...validateExportedFunctionsJSDoc(sourceFile))

    // Check 3: @example tags should not be too long
    violations.push(...validateExampleLength(sourceFile))

    // Check 4: Interfaces and type aliases should have JSDoc (for type files)
    if (filePath.includes('src/types/')) {
      violations.push(...validateTypeDocumentation(sourceFile))
    }

    // Check 5: @param tags must use hyphen format
    violations.push(...validateParamHyphenFormat(sourceFile))

    return violations
  }
}

/**
 * Validate Lambda handler files have proper file headers
 */
function validateLambdaFileHeader(sourceFile: SourceFile, filePath: string): Violation[] {
  const violations: Violation[] = []
  const text = sourceFile.getFullText()

  // Check if file starts with a JSDoc comment
  const trimmedText = text.trimStart()
  if (!trimmedText.startsWith('/**')) {
    // Extract Lambda name from path
    const lambdaMatch = filePath.match(/src\/lambdas\/([^/]+)\//)
    const lambdaName = lambdaMatch ? lambdaMatch[1] : 'Unknown'

    // Use MEDIUM for gradual adoption (matching ESLint JSDoc rules at 'warn' level)
    violations.push(
      createViolation(RULE_NAME, 'MEDIUM', 1, `Lambda handler missing file header`, {
        suggestion:
          `Add file header at top of file:\n/**\n * ${lambdaName} Lambda\n *\n * [Description]\n *\n * Trigger: [API Gateway | S3 Event | CloudWatch Schedule | Lambda Invoke]\n * Input: [Event description]\n * Output: [Response description]\n */`
      })
    )
  } else {
    // Verify header has required sections
    const headerMatch = text.match(/^\/\*\*[\s\S]*?\*\//)
    if (headerMatch) {
      const header = headerMatch[0]
      if (!header.includes('Trigger:') && !header.includes('Lambda')) {
        violations.push(
          createViolation(RULE_NAME, 'MEDIUM', 1, `Lambda file header missing Trigger/Input/Output sections`, {
            suggestion: 'File header should include: Trigger, Input, and Output sections'
          })
        )
      }
    }
  }

  return violations
}

/**
 * Validate exported functions have JSDoc
 */
function validateExportedFunctionsJSDoc(sourceFile: SourceFile): Violation[] {
  const violations: Violation[] = []

  // Check exported function declarations
  for (const fn of sourceFile.getFunctions()) {
    if (fn.isExported() && !fn.getJsDocs().length) {
      violations.push(
        createViolation(RULE_NAME, 'MEDIUM', fn.getStartLineNumber(), `Exported function '${fn.getName() || 'anonymous'}' missing JSDoc`, {
          suggestion: 'Add JSDoc with @param and @returns tags'
        })
      )
    }
  }

  // Check exported variable declarations that are functions (arrow functions, etc.)
  for (const statement of sourceFile.getStatements()) {
    if (statement.getKind() === SyntaxKind.VariableStatement) {
      const varStatement = statement.asKind(SyntaxKind.VariableStatement)
      if (!varStatement) {
        continue
      }

      // Check if exported
      const isExported = varStatement.getModifiers().some((m) => m.getKind() === SyntaxKind.ExportKeyword)
      if (!isExported) {
        continue
      }

      // Check if any declaration is a function/arrow function
      for (const decl of varStatement.getDeclarations()) {
        const initializer = decl.getInitializer()
        if (!initializer) {
          continue
        }

        const kind = initializer.getKind()
        if (kind === SyntaxKind.ArrowFunction || kind === SyntaxKind.FunctionExpression) {
          // Check for JSDoc
          const jsDocs = varStatement.getJsDocs()
          if (jsDocs.length === 0) {
            violations.push(
              createViolation(RULE_NAME, 'MEDIUM', varStatement.getStartLineNumber(), `Exported function '${decl.getName()}' missing JSDoc`, {
                suggestion: 'Add JSDoc with @param and @returns tags'
              })
            )
          }
        }
      }
    }
  }

  return violations
}

/**
 * Validate @example tags are not too long
 */
function validateExampleLength(sourceFile: SourceFile): Violation[] {
  const violations: Violation[] = []

  // Find all JSDoc comments
  const jsDocs = sourceFile.getDescendantsOfKind(SyntaxKind.JSDoc)

  for (const jsDoc of jsDocs) {
    const tags = jsDoc.getTags()

    for (const tag of tags) {
      if (tag.getTagName() === 'example') {
        const tagText = tag.getText()
        const lineCount = tagText.split('\n').length

        if (lineCount > MAX_EXAMPLE_LINES) {
          violations.push(
            createViolation(RULE_NAME, 'MEDIUM', tag.getStartLineNumber(), `@example tag too long (${lineCount} lines, max ${MAX_EXAMPLE_LINES})`, {
              suggestion: 'Move detailed examples to wiki and use @see {@link https://github.com/.../wiki/PageName | Page Title} instead'
            })
          )
        }
      }
    }
  }

  return violations
}

/**
 * Validate type definitions have JSDoc (for type files)
 */
function validateTypeDocumentation(sourceFile: SourceFile): Violation[] {
  const violations: Violation[] = []

  // Check interfaces
  for (const iface of sourceFile.getInterfaces()) {
    if (iface.isExported() && !iface.getJsDocs().length) {
      violations.push(
        createViolation(RULE_NAME, 'MEDIUM', iface.getStartLineNumber(), `Exported interface '${iface.getName()}' missing JSDoc`, {
          suggestion: 'Add JSDoc describing the interface purpose and usage'
        })
      )
    }
  }

  // Check type aliases
  for (const typeAlias of sourceFile.getTypeAliases()) {
    if (typeAlias.isExported() && !typeAlias.getJsDocs().length) {
      violations.push(
        createViolation(RULE_NAME, 'LOW', typeAlias.getStartLineNumber(), `Exported type alias '${typeAlias.getName()}' missing JSDoc`, {
          suggestion: 'Add JSDoc describing the type purpose'
        })
      )
    }
  }

  return violations
}

/**
 * Validate @param tags use hyphen format (TSDoc standard)
 */
function validateParamHyphenFormat(sourceFile: SourceFile): Violation[] {
  const violations: Violation[] = []

  const jsDocs = sourceFile.getDescendantsOfKind(SyntaxKind.JSDoc)

  for (const jsDoc of jsDocs) {
    const tags = jsDoc.getTags()

    for (const tag of tags) {
      if (tag.getTagName() === 'param') {
        const tagText = tag.getText()

        // Check for @param name description (no hyphen)
        // Should be @param name - description
        const paramMatch = tagText.match(/@param\s+(\w+)\s+([^-])/)
        if (paramMatch && paramMatch[2] && !paramMatch[2].match(/^\s*$/)) {
          // Has description without hyphen
          const paramName = paramMatch[1]
          violations.push(
            createViolation(RULE_NAME, 'LOW', tag.getStartLineNumber(), `@param '${paramName}' missing hyphen before description`, {
              suggestion: `Use TSDoc format: @param ${paramName} - Description here`,
              codeSnippet: tagText.trim()
            })
          )
        }
      }
    }
  }

  return violations
}
