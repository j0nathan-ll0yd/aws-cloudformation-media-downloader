import typescriptEslint from '@typescript-eslint/eslint-plugin'
import drizzle from 'eslint-plugin-drizzle'
import tsdoc from 'eslint-plugin-tsdoc'
import jsdoc from 'eslint-plugin-jsdoc'
import tsParser from '@typescript-eslint/parser'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import js from '@eslint/js'
import {FlatCompat} from '@eslint/eslintrc'
import {createRequire} from 'node:module'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const compat = new FlatCompat({baseDirectory: __dirname, recommendedConfig: js.configs.recommended, allConfig: js.configs.all})

// Load local ESLint rules plugin (CommonJS module)
const require = createRequire(import.meta.url)
const localRules = require('./eslint-local-rules/index.cjs')

export default [
  {
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/docs',
      '**/secure',
      '**/static',
      '**/temp',
      '**/terraform',
      '**/coverage',
      '**/coverage-reports',
      '**/build',
      '**/bin',
      '**/.github',
      '**/.idea',
      '**/.webpackCache',
      'src/types/terraform.d.ts',
      'src/types/infrastructure.d.ts',
      'eslint.config.mjs',
      '.dependency-cruiser.cjs',
      'src/mcp/test/fixtures/**/*',
      '**/*.fixture.ts',
      'eslint-local-rules/**/*'
    ]
  },
  ...compat.extends('eslint:recommended', 'plugin:@typescript-eslint/eslint-recommended', 'plugin:@typescript-eslint/recommended'),
  {
    plugins: {'@typescript-eslint': typescriptEslint, drizzle, tsdoc, jsdoc, 'local-rules': localRules},

    languageOptions: {parser: tsParser},

    rules: {
      // Code quality rules (dprint doesn't handle these)
      'new-parens': 'error',
      'no-caller': 'error',
      'no-bitwise': 'error',
      'no-cond-assign': 'error',

      // Documentation - TSDoc syntax validation
      'tsdoc/syntax': 'warn',

      // Documentation - JSDoc enforcement
      // TypeScript provides type information, so we only require a brief description block
      // for exported functions. No @param/@returns tags required - types are the docs.
      'jsdoc/require-jsdoc': ['warn', {
        publicOnly: true,
        require: {FunctionDeclaration: true, MethodDefinition: false, ArrowFunctionExpression: false},
        contexts: ['ExportNamedDeclaration > FunctionDeclaration', 'ExportDefaultDeclaration > FunctionDeclaration'],
        enableFixer: false
      }],
      // Turned off: TypeScript types serve as documentation
      'jsdoc/require-param': 'off',
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/require-returns-description': 'off',
      // If you DO write JSDoc, enforce consistency
      'jsdoc/require-hyphen-before-param-description': ['warn', 'always'],
      'jsdoc/check-param-names': ['warn', {checkDestructured: false}],
      'jsdoc/no-types': 'error',
      'jsdoc/require-returns-check': 'warn',
      // NOTE: Formatting rules (quotes, semi, comma-dangle, max-len) removed.
      // dprint handles all formatting via dprint.json

      // Project-specific rules (mirrors MCP validation for in-editor feedback)
      // Phase 1: CRITICAL
      'local-rules/no-direct-aws-sdk-import': 'error',
      'local-rules/cascade-delete-order': 'warn',
      'local-rules/use-entity-mock-helper': 'error',
      'local-rules/migrations-safety': 'error',
      // Phase 2: HIGH
      'local-rules/response-helpers': 'warn',
      'local-rules/env-validation': 'error',
      'local-rules/authenticated-handler-enforcement': 'warn',
      // Phase 3: STRATEGIC
      'local-rules/enforce-powertools': 'error',
      'local-rules/strict-env-vars': 'error',
      'local-rules/no-domain-leakage': 'error',
      // Phase 4: STYLISTIC (comment conventions)
      'local-rules/spacing-conventions': 'warn',
      // Integration testing
      'local-rules/integration-test-localstack': 'error',
      // Mock patterns
      'local-rules/aws-sdk-mock-pattern': 'warn',

      // Drizzle safety rules - prevent accidental bulk operations
      'drizzle/enforce-delete-with-where': ['error', {drizzleObjectName: ['db', 'tx']}],
      'drizzle/enforce-update-with-where': ['error', {drizzleObjectName: ['db', 'tx']}]
    }
  },
  // Relaxed JSDoc requirements for scripts and tooling (self-documenting per Code-Comments.md)
  {
    files: ['scripts/**/*.ts', 'graphrag/**/*.ts', 'config/**/*.ts'],
    rules: {
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/require-param': 'off',
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/require-returns-description': 'off'
    }
  },
  // Vendor wrappers are thin SDK facades - function names and types are self-documenting
  {files: ['src/lib/vendor/**/*.ts'], ignores: ['src/lib/vendor/**/*.test.ts'], rules: {'jsdoc/require-jsdoc': 'off'}},
  // Test helpers, setup files, and Lambda tests can import AWS SDK directly for mocking purposes
  // aws-sdk-client-mock requires direct SDK access for type-safe mocking
  {files: ['test/helpers/aws-sdk-mock.ts', 'test/setup.ts', 'src/lambdas/*/test/*.test.ts'], rules: {'local-rules/no-direct-aws-sdk-import': 'off'}},
  // Lambda handlers require a JSDoc description block (purpose documentation)
  // No @param/@returns tags required - TypeScript types are sufficient
  {
    files: ['src/lambdas/*/src/index.ts'],
    rules: {
      'jsdoc/require-jsdoc': ['error', {
        publicOnly: true,
        require: {FunctionDeclaration: true, MethodDefinition: false, ArrowFunctionExpression: false},
        contexts: ['ExportNamedDeclaration > FunctionDeclaration', 'ExportDefaultDeclaration > FunctionDeclaration'],
        enableFixer: false
      }],
      // Enforce consistent import order in Lambda handlers
      'local-rules/import-order': 'warn'
    }
  }
]
