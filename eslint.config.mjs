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
      quotes: [2, 'single', {avoidEscape: true}],

      'max-len': ['error', {code: 250, ignoreUrls: true}],

      'new-parens': 2,
      'no-caller': 2,
      'no-bitwise': 2,
      'no-string-throw': 0,
      'no-cond-assign': 2,
      'no-consecutive-blank-lines': 0,
      'no-console': [0, 'log', 'error', 'warn', 'info'],
      semi: [2, 'never'],
      eofline: 0,
      'comma-dangle': ['error', 'never'],
      'tsdoc/syntax': 'warn',
      // Allow underscore-prefixed params to indicate intentionally unused (common pattern for wrapper handlers)
      '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_', varsIgnorePattern: '^_'}]
    }
  }
]
