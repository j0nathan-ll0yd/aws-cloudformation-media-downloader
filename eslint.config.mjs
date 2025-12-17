import typescriptEslint from '@typescript-eslint/eslint-plugin'
import tsdoc from 'eslint-plugin-tsdoc'
import tsParser from '@typescript-eslint/parser'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import js from '@eslint/js'
import {FlatCompat} from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const compat = new FlatCompat({baseDirectory: __dirname, recommendedConfig: js.configs.recommended, allConfig: js.configs.all})

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
      'src/mcp/test/fixtures/**/*'
    ]
  },
  ...compat.extends('eslint:recommended', 'plugin:@typescript-eslint/eslint-recommended', 'plugin:@typescript-eslint/recommended'),
  {
    plugins: {'@typescript-eslint': typescriptEslint, tsdoc},

    languageOptions: {parser: tsParser},

    rules: {
      // Code quality rules (dprint doesn't handle these)
      'new-parens': 'error',
      'no-caller': 'error',
      'no-bitwise': 'error',
      'no-cond-assign': 'error',

      // Documentation
      'tsdoc/syntax': 'warn'
      // NOTE: Formatting rules (quotes, semi, comma-dangle, max-len) removed.
      // dprint handles all formatting via dprint.json
    }
  }
]
