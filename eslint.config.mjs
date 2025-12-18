import typescriptEslint from '@typescript-eslint/eslint-plugin'
import tsdoc from 'eslint-plugin-tsdoc'
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
      'eslint-local-rules/**/*'
    ]
  },
  ...compat.extends('eslint:recommended', 'plugin:@typescript-eslint/eslint-recommended', 'plugin:@typescript-eslint/recommended'),
  {
    plugins: {'@typescript-eslint': typescriptEslint, tsdoc, 'local-rules': localRules},

    languageOptions: {parser: tsParser},

    rules: {
      // Code quality rules (dprint doesn't handle these)
      'new-parens': 'error',
      'no-caller': 'error',
      'no-bitwise': 'error',
      'no-cond-assign': 'error',

      // Documentation
      'tsdoc/syntax': 'warn',
      // NOTE: Formatting rules (quotes, semi, comma-dangle, max-len) removed.
      // dprint handles all formatting via dprint.json

      // Project-specific rules (mirrors MCP validation for in-editor feedback)
      // Phase 1: CRITICAL
      'local-rules/no-direct-aws-sdk-import': 'error',
      'local-rules/cascade-delete-order': 'warn',
      'local-rules/use-electrodb-mock-helper': 'error',
      // Phase 2: HIGH
      'local-rules/response-helpers': 'warn',
      'local-rules/env-validation': 'error'
    }
  }
]
