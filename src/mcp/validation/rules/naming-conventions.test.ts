/**
 * Unit tests for naming-conventions rule
 * HIGH: Validates TypeScript type names follow project conventions
 */

import {beforeAll, describe, expect, test} from 'vitest'
import {Project} from 'ts-morph'

// Module loaded via dynamic import
let namingConventionsRule: typeof import('./naming-conventions').namingConventionsRule

// Create ts-morph project for in-memory source files
const project = new Project({skipFileDependencyResolution: true, skipAddingFilesFromTsConfig: true})

beforeAll(async () => {
  const module = await import('./naming-conventions')
  namingConventionsRule = module.namingConventionsRule
})

describe('naming-conventions rule', () => {
  describe('rule metadata', () => {
    test('should have correct name', () => {
      expect(namingConventionsRule.name).toBe('naming-conventions')
    })

    test('should have HIGH severity', () => {
      expect(namingConventionsRule.severity).toBe('HIGH')
    })

    test('should apply to src/**/*.ts files', () => {
      expect(namingConventionsRule.appliesTo).toContain('src/**/*.ts')
    })

    test('should exclude test files', () => {
      expect(namingConventionsRule.excludes).toContain('src/**/*.test.ts')
    })
  })

  describe('forbidden prefixes', () => {
    test('should detect DynamoDB prefix on type aliases', () => {
      const sourceFile = project.createSourceFile('dynamodb-prefix.ts', `export type DynamoDBFile = {
  id: string
  name: string
}`, {overwrite: true})

      const violations = namingConventionsRule.validate(sourceFile, 'src/types/entities.ts')

      expect(violations.some((v) => v.message.includes("Type 'DynamoDBFile'"))).toBe(true)
      expect(violations.some((v) => v.suggestion?.includes("'File'"))).toBe(true)
    })

    test('should detect DynamoDB prefix on interfaces', () => {
      const sourceFile = project.createSourceFile('dynamodb-interface.ts', `export interface DynamoDBUser {
  userId: string
  email: string
}`, {overwrite: true})

      const violations = namingConventionsRule.validate(sourceFile, 'src/types/entities.ts')

      expect(violations.some((v) => v.message.includes("Interface 'DynamoDBUser'"))).toBe(true)
    })

    test('should detect I prefix on interfaces', () => {
      const sourceFile = project.createSourceFile('i-prefix.ts', `export interface IUser {
  userId: string
  email: string
}`, {overwrite: true})

      const violations = namingConventionsRule.validate(sourceFile, 'src/types/entities.ts')

      expect(violations.some((v) => v.message.includes("Interface 'IUser'"))).toBe(true)
      expect(violations.some((v) => v.message.includes("Don't use 'I' prefix"))).toBe(true)
    })

    test('should detect T prefix on types', () => {
      const sourceFile = project.createSourceFile('t-prefix.ts', `export type TStatus = 'active' | 'inactive'`, {overwrite: true})

      const violations = namingConventionsRule.validate(sourceFile, 'src/types/domain.ts')

      expect(violations.some((v) => v.message.includes("Type 'TStatus'"))).toBe(true)
      expect(violations.some((v) => v.message.includes("Don't use 'T' prefix"))).toBe(true)
    })

    test('should accept valid type names', () => {
      const sourceFile = project.createSourceFile('valid-types.ts', `export type User = {
  id: string
  name: string
}

export interface FileItem {
  fileId: string
  fileName: string
}

export type Status = 'active' | 'inactive'`, {overwrite: true})

      const violations = namingConventionsRule.validate(sourceFile, 'src/types/domain.ts')

      expect(violations.filter((v) => v.message.includes('DynamoDB')).length).toBe(0)
      expect(violations.filter((v) => v.message.includes("'I' prefix")).length).toBe(0)
      expect(violations.filter((v) => v.message.includes("'T' prefix")).length).toBe(0)
    })
  })

  describe('PascalCase enum validation', () => {
    test('should detect non-PascalCase enum member', () => {
      const sourceFile = project.createSourceFile('snake-enum.ts', `export enum FileStatus {
  QUEUED = 'Queued',
  downloading = 'Downloading',
  DOWNLOADED = 'Downloaded'
}`, {overwrite: true})

      const violations = namingConventionsRule.validate(sourceFile, 'src/types/enums.ts')

      expect(violations.some((v) => v.message.includes("'FileStatus.downloading' should be PascalCase"))).toBe(true)
    })

    test('should detect non-PascalCase enum value', () => {
      const sourceFile = project.createSourceFile('lowercase-value.ts', `export enum FileStatus {
  Queued = 'QUEUED_VALUE',
  Downloading = 'downloading_status'
}`, {overwrite: true})

      const violations = namingConventionsRule.validate(sourceFile, 'src/types/enums.ts')

      // Rule detects non-PascalCase values (snake_case or other non-conforming)
      expect(violations.some((v) => v.message.includes('should be PascalCase'))).toBe(true)
    })

    test('should accept PascalCase enum members and values', () => {
      const sourceFile = project.createSourceFile('pascal-enum.ts', `export enum FileStatus {
  Queued = 'Queued',
  Downloading = 'Downloading',
  Downloaded = 'Downloaded',
  Failed = 'Failed'
}`, {overwrite: true})

      const violations = namingConventionsRule.validate(sourceFile, 'src/types/enums.ts')

      expect(violations.filter((v) => v.message.includes('PascalCase')).length).toBe(0)
    })

    test('should accept enum without explicit values', () => {
      const sourceFile = project.createSourceFile('no-value-enum.ts', `export enum UserRole {
  Admin,
  User,
  Guest
}`, {overwrite: true})

      const violations = namingConventionsRule.validate(sourceFile, 'src/types/enums.ts')

      expect(violations.filter((v) => v.message.includes('PascalCase')).length).toBe(0)
    })
  })

  describe('property naming', () => {
    test('should detect snake_case property names', () => {
      const sourceFile = project.createSourceFile('snake-props.ts', `export interface UserData {
  user_id: string
  first_name: string
  lastName: string
}`, {overwrite: true})

      const violations = namingConventionsRule.validate(sourceFile, 'src/types/domain.ts')

      expect(violations.some((v) => v.message.includes("'UserData.user_id' uses snake_case"))).toBe(true)
      expect(violations.some((v) => v.message.includes("'UserData.first_name' uses snake_case"))).toBe(true)
    })

    test('should accept camelCase property names', () => {
      const sourceFile = project.createSourceFile('camel-props.ts', `export interface UserData {
  userId: string
  firstName: string
  lastName: string
}`, {overwrite: true})

      const violations = namingConventionsRule.validate(sourceFile, 'src/types/domain.ts')

      expect(violations.filter((v) => v.message.includes('snake_case')).length).toBe(0)
    })

    test('should skip snake_case validation for YouTube/yt-dlp files', () => {
      const sourceFile = project.createSourceFile('youtube-types.ts', `export interface YouTubeVideo {
  video_id: string
  upload_date: string
}`, {overwrite: true})

      const violations = namingConventionsRule.validate(sourceFile, 'src/types/youtube.ts')

      expect(violations.filter((v) => v.message.includes('snake_case')).length).toBe(0)
    })
  })

  describe('ID pattern validation', () => {
    test('should detect incorrect ID naming pattern', () => {
      const sourceFile = project.createSourceFile('wrong-id.ts', `export interface UserData {
  userid: string
  fileid: string
}`, {overwrite: true})

      const violations = namingConventionsRule.validate(sourceFile, 'src/types/domain.ts')

      expect(violations.some((v) => v.message.includes("'UserData.userid' should use *Id pattern"))).toBe(true)
    })

    test('should accept correct ID naming pattern', () => {
      const sourceFile = project.createSourceFile('correct-id.ts', `export interface UserData {
  userId: string
  fileId: string
  id: string
}`, {overwrite: true})

      const violations = namingConventionsRule.validate(sourceFile, 'src/types/domain.ts')

      expect(violations.filter((v) => v.message.includes('*Id pattern')).length).toBe(0)
    })
  })

  describe('excluded files metadata', () => {
    test('should have infrastructure.d.ts in excludes list', () => {
      // The excludes array is used by the validation runner to skip files
      // Infrastructure types are auto-generated and should be excluded
      expect(namingConventionsRule.excludes).toContain('src/types/infrastructure.d.ts')
    })

    test('should have test files in excludes list', () => {
      // Test files should be excluded from naming convention checks
      expect(namingConventionsRule.excludes).toContain('src/**/*.test.ts')
    })

    test('should have test directory in excludes list', () => {
      // Test directory should also be excluded
      expect(namingConventionsRule.excludes).toContain('test/**/*.ts')
    })
  })
})
