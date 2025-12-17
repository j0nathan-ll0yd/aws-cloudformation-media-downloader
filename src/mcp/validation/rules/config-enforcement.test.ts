/**
 * Unit tests for config-enforcement rule
 * CRITICAL: Detects configuration drift that weakens enforcement
 */

import {beforeAll, describe, expect, test} from '@jest/globals'
import {Project} from 'ts-morph'

let configEnforcementRule: typeof import('./config-enforcement').configEnforcementRule

const project = new Project({skipFileDependencyResolution: true, skipAddingFilesFromTsConfig: true})

beforeAll(async () => {
  const module = await import('./config-enforcement')
  configEnforcementRule = module.configEnforcementRule
})

describe('config-enforcement rule', () => {
  describe('rule metadata', () => {
    test('should have correct name', () => {
      expect(configEnforcementRule.name).toBe('config-enforcement')
    })

    test('should have CRITICAL severity', () => {
      expect(configEnforcementRule.severity).toBe('CRITICAL')
    })

    test('should apply to config files', () => {
      expect(configEnforcementRule.appliesTo).toContain('eslint.config.mjs')
      expect(configEnforcementRule.appliesTo).toContain('tsconfig.json')
      expect(configEnforcementRule.appliesTo).toContain('dprint.json')
    })
  })

  describe('ESLint config validation', () => {
    test('should detect argsIgnorePattern with underscore', () => {
      const sourceFile = project.createSourceFile('eslint.config.mjs', `export default [{
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_'}]
  }
}]`, {overwrite: true})

      const violations = configEnforcementRule.validate(sourceFile, 'eslint.config.mjs')

      expect(violations.length).toBeGreaterThan(0)
      expect(violations[0].message).toContain('argsIgnorePattern')
      expect(violations[0].severity).toBe('CRITICAL')
    })

    test('should detect varsIgnorePattern with underscore', () => {
      const sourceFile = project.createSourceFile('eslint2.config.mjs', `export default [{
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', {varsIgnorePattern: '^_'}]
  }
}]`, {overwrite: true})

      const violations = configEnforcementRule.validate(sourceFile, 'eslint.config.mjs')

      expect(violations.length).toBeGreaterThan(0)
      expect(violations[0].message).toContain('varsIgnorePattern')
    })

    test('should detect unauthorized ignores', () => {
      const sourceFile = project.createSourceFile('eslint3.config.mjs', `export default [{
  ignores: ['**/node_modules', '**/secret-backdoor']
}]`, {overwrite: true})

      const violations = configEnforcementRule.validate(sourceFile, 'eslint.config.mjs')

      const unauthorizedIgnore = violations.find((v) => v.message.includes('secret-backdoor'))
      expect(unauthorizedIgnore).toBeDefined()
      expect(unauthorizedIgnore?.severity).toBe('HIGH')
    })

    test('should allow valid ignores', () => {
      const sourceFile = project.createSourceFile('eslint4.config.mjs', `export default [{
  ignores: ['**/node_modules', '**/dist', '**/build']
}]`, {overwrite: true})

      const violations = configEnforcementRule.validate(sourceFile, 'eslint.config.mjs')

      const unauthorizedIgnore = violations.find((v) => v.message.includes('Unauthorized'))
      expect(unauthorizedIgnore).toBeUndefined()
    })

    test('should allow valid config without underscore patterns', () => {
      const sourceFile = project.createSourceFile('eslint5.config.mjs', `export default [{
  rules: {
    'quotes': [2, 'single'],
    'semi': [2, 'never']
  }
}]`, {overwrite: true})

      const violations = configEnforcementRule.validate(sourceFile, 'eslint.config.mjs')

      expect(violations).toHaveLength(0)
    })
  })

  describe('TSConfig validation', () => {
    test('should detect disabled strict setting', () => {
      const sourceFile = project.createSourceFile('tsconfig.json', JSON.stringify({compilerOptions: {strict: false}}), {overwrite: true})

      const violations = configEnforcementRule.validate(sourceFile, 'tsconfig.json')

      expect(violations.length).toBeGreaterThan(0)
      expect(violations[0].message).toContain('strict')
      expect(violations[0].severity).toBe('CRITICAL')
    })

    test('should detect disabled noUnusedLocals', () => {
      const sourceFile = project.createSourceFile('tsconfig2.json', JSON.stringify({compilerOptions: {noUnusedLocals: false}}), {overwrite: true})

      const violations = configEnforcementRule.validate(sourceFile, 'tsconfig.json')

      expect(violations.length).toBeGreaterThan(0)
      expect(violations[0].message).toContain('noUnusedLocals')
    })

    test('should detect disabled noUnusedParameters', () => {
      const sourceFile = project.createSourceFile('tsconfig3.json', JSON.stringify({compilerOptions: {noUnusedParameters: false}}), {overwrite: true})

      const violations = configEnforcementRule.validate(sourceFile, 'tsconfig.json')

      expect(violations.length).toBeGreaterThan(0)
      expect(violations[0].message).toContain('noUnusedParameters')
    })

    test('should allow valid strict config', () => {
      const sourceFile = project.createSourceFile('tsconfig4.json',
        JSON.stringify({compilerOptions: {strict: true, noUnusedLocals: true, noUnusedParameters: true}}), {overwrite: true})

      const violations = configEnforcementRule.validate(sourceFile, 'tsconfig.json')

      expect(violations).toHaveLength(0)
    })

    test('should allow config without explicit strict settings', () => {
      const sourceFile = project.createSourceFile('tsconfig5.json', JSON.stringify({compilerOptions: {target: 'ES2022'}}), {overwrite: true})

      const violations = configEnforcementRule.validate(sourceFile, 'tsconfig.json')

      expect(violations).toHaveLength(0)
    })
  })

  describe('dprint config validation', () => {
    test('should detect excessive line width', () => {
      const sourceFile = project.createSourceFile('dprint.json', JSON.stringify({lineWidth: 300}), {overwrite: true})

      const violations = configEnforcementRule.validate(sourceFile, 'dprint.json')

      expect(violations.length).toBeGreaterThan(0)
      expect(violations[0].message).toContain('300')
      expect(violations[0].severity).toBe('MEDIUM')
    })

    test('should detect tab usage', () => {
      const sourceFile = project.createSourceFile('dprint2.json', JSON.stringify({useTabs: true}), {overwrite: true})

      const violations = configEnforcementRule.validate(sourceFile, 'dprint.json')

      expect(violations.length).toBeGreaterThan(0)
      expect(violations[0].message).toContain('Tab')
    })

    test('should allow valid dprint config', () => {
      const sourceFile = project.createSourceFile('dprint3.json', JSON.stringify({lineWidth: 157, useTabs: false, indentWidth: 2}), {overwrite: true})

      const violations = configEnforcementRule.validate(sourceFile, 'dprint.json')

      expect(violations).toHaveLength(0)
    })

    test('should allow line width at boundary', () => {
      const sourceFile = project.createSourceFile('dprint4.json', JSON.stringify({lineWidth: 200}), {overwrite: true})

      const violations = configEnforcementRule.validate(sourceFile, 'dprint.json')

      expect(violations).toHaveLength(0)
    })
  })

  describe('provides helpful suggestions', () => {
    test('should suggest object destructuring for underscore pattern', () => {
      const sourceFile = project.createSourceFile('eslint-suggestion.config.mjs', `export default [{
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_'}]
  }
}]`, {overwrite: true})

      const violations = configEnforcementRule.validate(sourceFile, 'eslint.config.mjs')

      expect(violations[0].suggestion).toContain('object destructuring')
    })

    test('should suggest enabling strict settings', () => {
      const sourceFile = project.createSourceFile('tsconfig-suggestion.json', JSON.stringify({compilerOptions: {strict: false}}), {overwrite: true})

      const violations = configEnforcementRule.validate(sourceFile, 'tsconfig.json')

      expect(violations[0].suggestion).toContain('true')
    })
  })
})
