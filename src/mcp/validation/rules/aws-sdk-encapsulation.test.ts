/**
 * Unit tests for aws-sdk-encapsulation rule
 * CRITICAL: No direct AWS SDK imports outside lib/vendor/AWS/
 */

import {beforeAll, describe, expect, test} from '@jest/globals'
import {Project} from 'ts-morph'

// Module loaded via dynamic import
let awsSdkEncapsulationRule: typeof import('./aws-sdk-encapsulation').awsSdkEncapsulationRule

// Create ts-morph project for in-memory source files
const project = new Project({skipFileDependencyResolution: true, skipAddingFilesFromTsConfig: true})

beforeAll(async () => {
  const module = await import('./aws-sdk-encapsulation')
  awsSdkEncapsulationRule = module.awsSdkEncapsulationRule
})

describe('aws-sdk-encapsulation rule', () => {
  describe('rule metadata', () => {
    test('should have correct name', () => {
      expect(awsSdkEncapsulationRule.name).toBe('aws-sdk-encapsulation')
    })

    test('should have CRITICAL severity', () => {
      expect(awsSdkEncapsulationRule.severity).toBe('CRITICAL')
    })

    test('should apply to src/**/*.ts files', () => {
      expect(awsSdkEncapsulationRule.appliesTo).toContain('src/**/*.ts')
    })

    test('should exclude vendor files', () => {
      expect(awsSdkEncapsulationRule.excludes).toContain('src/lib/vendor/AWS/**/*.ts')
    })
  })

  describe('detects direct AWS SDK imports', () => {
    test('should detect @aws-sdk/client-dynamodb import', () => {
      const sourceFile = project.createSourceFile('test-dynamodb.ts', 'import {DynamoDBClient} from \'@aws-sdk/client-dynamodb\'', {overwrite: true})

      const violations = awsSdkEncapsulationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(1)
      expect(violations[0].severity).toBe('CRITICAL')
      expect(violations[0].message).toContain('@aws-sdk/client-dynamodb')
    })

    test('should detect @aws-sdk/client-s3 import', () => {
      const sourceFile = project.createSourceFile('test-s3.ts', 'import {S3Client, PutObjectCommand} from \'@aws-sdk/client-s3\'', {overwrite: true})

      const violations = awsSdkEncapsulationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(1)
      expect(violations[0].message).toContain('@aws-sdk/client-s3')
    })

    test('should detect @aws-sdk/lib-dynamodb import', () => {
      const sourceFile = project.createSourceFile('test-lib.ts', 'import {DynamoDBDocumentClient} from \'@aws-sdk/lib-dynamodb\'', {overwrite: true})

      const violations = awsSdkEncapsulationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(1)
      expect(violations[0].message).toContain('@aws-sdk/lib-dynamodb')
    })

    test('should detect @aws-sdk/client-sns import', () => {
      const sourceFile = project.createSourceFile('test-sns.ts', 'import {SNSClient} from \'@aws-sdk/client-sns\'', {overwrite: true})

      const violations = awsSdkEncapsulationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(1)
    })

    test('should detect @aws-sdk/client-lambda import', () => {
      const sourceFile = project.createSourceFile('test-lambda.ts', 'import {LambdaClient} from \'@aws-sdk/client-lambda\'', {overwrite: true})

      const violations = awsSdkEncapsulationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(1)
    })

    test('should detect multiple AWS SDK imports', () => {
      const sourceFile = project.createSourceFile('test-multiple.ts', `import {DynamoDBClient} from '@aws-sdk/client-dynamodb'
import {S3Client} from '@aws-sdk/client-s3'
import {SNSClient} from '@aws-sdk/client-sns'`, {overwrite: true})

      const violations = awsSdkEncapsulationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(3)
    })
  })

  describe('detects dynamic AWS SDK imports', () => {
    test('should detect dynamic import of AWS SDK', () => {
      const sourceFile = project.createSourceFile('test-dynamic.ts', 'const sdk = await import(\'@aws-sdk/client-dynamodb\')', {overwrite: true})

      const violations = awsSdkEncapsulationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(1)
      expect(violations[0].message).toContain('Dynamic AWS SDK import forbidden')
    })
  })

  describe('allows valid patterns', () => {
    test('should allow vendor wrapper imports', () => {
      const sourceFile = project.createSourceFile('test-vendor.ts', `import {queryItems} from '#lib/vendor/AWS/DynamoDB'
import {uploadToS3} from '#lib/vendor/AWS/S3'`, {overwrite: true})

      const violations = awsSdkEncapsulationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow other package imports', () => {
      const sourceFile = project.createSourceFile('test-other.ts', `import {v4 as uuidv4} from 'uuid'
import {APIGatewayProxyEvent} from 'aws-lambda'`, {overwrite: true})

      const violations = awsSdkEncapsulationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow entity imports', () => {
      const sourceFile = project.createSourceFile('test-entities.ts', `import {Files} from '#entities/Files'
import {Users} from '#entities/Users'`, {overwrite: true})

      const violations = awsSdkEncapsulationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(0)
    })
  })

  describe('skips vendor files', () => {
    test('should skip files in lib/vendor/AWS/', () => {
      const sourceFile = project.createSourceFile('test-vendor-internal.ts', 'import {DynamoDBClient} from \'@aws-sdk/client-dynamodb\'', {overwrite: true})

      const violations = awsSdkEncapsulationRule.validate(sourceFile, 'src/lib/vendor/AWS/DynamoDB.ts')

      expect(violations).toHaveLength(0)
    })

    test('should skip files in lib/vendor/', () => {
      const sourceFile = project.createSourceFile('test-vendor-root.ts', 'import {S3Client} from \'@aws-sdk/client-s3\'', {overwrite: true})

      const violations = awsSdkEncapsulationRule.validate(sourceFile, 'src/lib/vendor/AWS/S3.ts')

      expect(violations).toHaveLength(0)
    })
  })

  describe('provides helpful suggestions', () => {
    test('should suggest DynamoDB vendor wrapper', () => {
      const sourceFile = project.createSourceFile('test-suggestion-dynamodb.ts', 'import {DynamoDBClient} from \'@aws-sdk/client-dynamodb\'', {
        overwrite: true
      })

      const violations = awsSdkEncapsulationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations[0].suggestion).toContain('lib/vendor/AWS/DynamoDB')
    })

    test('should suggest S3 vendor wrapper', () => {
      const sourceFile = project.createSourceFile('test-suggestion-s3.ts', 'import {S3Client} from \'@aws-sdk/client-s3\'', {overwrite: true})

      const violations = awsSdkEncapsulationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations[0].suggestion).toContain('lib/vendor/AWS/S3')
    })
  })

  describe('includes code context', () => {
    test('should include code snippet in violation', () => {
      const sourceFile = project.createSourceFile('test-snippet.ts', 'import {DynamoDBClient} from \'@aws-sdk/client-dynamodb\'', {overwrite: true})

      const violations = awsSdkEncapsulationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations[0].codeSnippet).toBeDefined()
      expect(violations[0].codeSnippet).toContain('@aws-sdk/client-dynamodb')
    })
  })
})
