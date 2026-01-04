/**
 * Unit tests for aurora-dsql-async-index rule
 * HIGH: Validates CREATE INDEX statements use ASYNC in Aurora DSQL migrations
 */

import {beforeAll, beforeEach, describe, expect, test, vi} from 'vitest'
import {Project} from 'ts-morph'

// Mock fs module
vi.mock('fs', () => ({readFileSync: vi.fn()}))

import {readFileSync} from 'fs'

// Module loaded via dynamic import
let auroraDsqlAsyncIndexRule: typeof import('./aurora-dsql-async-index').auroraDsqlAsyncIndexRule

// Create ts-morph project for dummy source file (not used for SQL files)
const project = new Project({skipFileDependencyResolution: true, skipAddingFilesFromTsConfig: true})
const dummySourceFile = project.createSourceFile('dummy.ts', '', {overwrite: true})

beforeAll(async () => {
  const module = await import('./aurora-dsql-async-index')
  auroraDsqlAsyncIndexRule = module.auroraDsqlAsyncIndexRule
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('aurora-dsql-async-index rule', () => {
  describe('rule metadata', () => {
    test('should have correct name', () => {
      expect(auroraDsqlAsyncIndexRule.name).toBe('aurora-dsql-async-index')
    })

    test('should have HIGH severity', () => {
      expect(auroraDsqlAsyncIndexRule.severity).toBe('HIGH')
    })

    test('should apply to SQL migration files', () => {
      expect(auroraDsqlAsyncIndexRule.appliesTo).toContain('migrations/*.sql')
    })
  })

  describe('CREATE INDEX detection', () => {
    test('should detect CREATE INDEX without ASYNC', () => {
      const sqlContent = `-- Migration: test
CREATE INDEX users_email_idx ON users(email);`

      vi.mocked(readFileSync).mockReturnValue(sqlContent)

      const violations = auroraDsqlAsyncIndexRule.validate(dummySourceFile, 'migrations/0001_test.sql')

      expect(violations.length).toBe(1)
      expect(violations[0].message).toContain('CREATE INDEX without ASYNC')
      expect(violations[0].severity).toBe('HIGH')
      expect(violations[0].line).toBe(2)
    })

    test('should detect CREATE UNIQUE INDEX without ASYNC', () => {
      const sqlContent = `CREATE UNIQUE INDEX users_email_unique ON users(email);`

      vi.mocked(readFileSync).mockReturnValue(sqlContent)

      const violations = auroraDsqlAsyncIndexRule.validate(dummySourceFile, 'migrations/0001_test.sql')

      expect(violations.length).toBe(1)
      expect(violations[0].message).toContain('CREATE INDEX without ASYNC')
    })

    test('should accept CREATE INDEX ASYNC', () => {
      const sqlContent = `CREATE INDEX ASYNC users_email_idx ON users(email);`

      vi.mocked(readFileSync).mockReturnValue(sqlContent)

      const violations = auroraDsqlAsyncIndexRule.validate(dummySourceFile, 'migrations/0001_test.sql')

      expect(violations.length).toBe(0)
    })

    test('should accept CREATE UNIQUE INDEX ASYNC', () => {
      const sqlContent = `CREATE UNIQUE INDEX ASYNC users_email_unique ON users(email);`

      vi.mocked(readFileSync).mockReturnValue(sqlContent)

      const violations = auroraDsqlAsyncIndexRule.validate(dummySourceFile, 'migrations/0001_test.sql')

      expect(violations.length).toBe(0)
    })

    test('should detect multiple violations', () => {
      const sqlContent = `-- Migration with multiple indexes
CREATE INDEX users_email_idx ON users(email);
CREATE INDEX ASYNC users_name_idx ON users(name);
CREATE INDEX users_status_idx ON users(status);`

      vi.mocked(readFileSync).mockReturnValue(sqlContent)

      const violations = auroraDsqlAsyncIndexRule.validate(dummySourceFile, 'migrations/0001_test.sql')

      expect(violations.length).toBe(2)
      expect(violations[0].line).toBe(2)
      expect(violations[1].line).toBe(4)
    })

    test('should skip comment lines', () => {
      const sqlContent = `-- CREATE INDEX without_async ON table(col);
CREATE INDEX ASYNC proper_idx ON users(email);`

      vi.mocked(readFileSync).mockReturnValue(sqlContent)

      const violations = auroraDsqlAsyncIndexRule.validate(dummySourceFile, 'migrations/0001_test.sql')

      expect(violations.length).toBe(0)
    })

    test('should be case insensitive', () => {
      const sqlContent = `create index users_email_idx on users(email);`

      vi.mocked(readFileSync).mockReturnValue(sqlContent)

      const violations = auroraDsqlAsyncIndexRule.validate(dummySourceFile, 'migrations/0001_test.sql')

      expect(violations.length).toBe(1)
    })

    test('should handle IF NOT EXISTS syntax', () => {
      const sqlContent = `CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);`

      vi.mocked(readFileSync).mockReturnValue(sqlContent)

      const violations = auroraDsqlAsyncIndexRule.validate(dummySourceFile, 'migrations/0001_test.sql')

      expect(violations.length).toBe(1)
    })

    test('should accept IF NOT EXISTS with ASYNC', () => {
      const sqlContent = `CREATE INDEX ASYNC IF NOT EXISTS users_email_idx ON users(email);`

      vi.mocked(readFileSync).mockReturnValue(sqlContent)

      const violations = auroraDsqlAsyncIndexRule.validate(dummySourceFile, 'migrations/0001_test.sql')

      expect(violations.length).toBe(0)
    })
  })

  describe('file handling', () => {
    test('should skip non-SQL files', () => {
      const violations = auroraDsqlAsyncIndexRule.validate(dummySourceFile, 'src/index.ts')

      expect(violations.length).toBe(0)
      expect(readFileSync).not.toHaveBeenCalled()
    })

    test('should handle file read errors gracefully', () => {
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('File not found')
      })

      const violations = auroraDsqlAsyncIndexRule.validate(dummySourceFile, 'migrations/0001_test.sql')

      expect(violations.length).toBe(0)
    })
  })

  describe('suggestion quality', () => {
    test('should provide helpful suggestion', () => {
      const sqlContent = `CREATE INDEX users_email_idx ON users(email);`

      vi.mocked(readFileSync).mockReturnValue(sqlContent)

      const violations = auroraDsqlAsyncIndexRule.validate(dummySourceFile, 'migrations/0001_test.sql')

      expect(violations[0].suggestion).toContain('CREATE INDEX ASYNC')
      expect(violations[0].suggestion).toContain('non-blocking')
    })

    test('should include code snippet', () => {
      const sqlContent = `CREATE INDEX users_email_idx ON users(email);`

      vi.mocked(readFileSync).mockReturnValue(sqlContent)

      const violations = auroraDsqlAsyncIndexRule.validate(dummySourceFile, 'migrations/0001_test.sql')

      expect(violations[0].codeSnippet).toContain('CREATE INDEX')
    })
  })
})
