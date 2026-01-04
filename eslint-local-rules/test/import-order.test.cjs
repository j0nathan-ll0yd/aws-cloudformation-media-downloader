/**
 * Tests for import-order ESLint rule
 */

const {RuleTester} = require('eslint')
const rule = require('../rules/import-order.cjs')

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  }
})

// Mock Lambda handler path
const lambdaFilename = '/Users/test/project/src/lambdas/TestHandler/src/index.ts'

ruleTester.run('import-order', rule, {
  valid: [
    // Correct order: entities -> vendor -> types -> utilities
    {
      code: `
        import {getUser} from '#entities/queries'
        import {uploadToS3} from '#lib/vendor/AWS/S3'
        import {FileStatus} from '#types/enums'
        import {logInfo} from '#lib/system/logging'
        import {response} from '#util/lambda-helpers'
      `,
      filename: lambdaFilename
    },
    // Single import is always valid
    {
      code: `import {getUser} from '#entities/queries'`,
      filename: lambdaFilename
    },
    // Non-Lambda files should be ignored
    {
      code: `
        import {response} from '#util/lambda-helpers'
        import {getUser} from '#entities/queries'
      `,
      filename: '/Users/test/project/src/lib/helper.ts'
    },
    // Entities before vendor is correct
    {
      code: `
        import {getUser} from '#entities/queries'
        import {uploadToS3} from '#lib/vendor/AWS/S3'
      `,
      filename: lambdaFilename
    },
    // Types before utilities is correct
    {
      code: `
        import {FileStatus} from '#types/enums'
        import {logInfo} from '#lib/system/logging'
      `,
      filename: lambdaFilename
    },
    // Multiple utilities in a row is fine
    {
      code: `
        import {logInfo} from '#lib/system/logging'
        import {withPowertools} from '#lib/lambda/middleware/powertools'
        import {response} from '#util/lambda-helpers'
      `,
      filename: lambdaFilename
    }
  ],
  invalid: [
    // Wrong order: utilities before types
    {
      code: `
        import {logInfo} from '#lib/system/logging'
        import {FileStatus} from '#types/enums'
      `,
      filename: lambdaFilename,
      errors: [{messageId: 'wrongOrder'}]
    },
    // Wrong order: utilities before vendor
    {
      code: `
        import {response} from '#util/lambda-helpers'
        import {uploadToS3} from '#lib/vendor/AWS/S3'
      `,
      filename: lambdaFilename,
      errors: [{messageId: 'wrongOrder'}]
    },
    // Wrong order: utilities before entities
    {
      code: `
        import {logInfo} from '#lib/system/logging'
        import {getUser} from '#entities/queries'
      `,
      filename: lambdaFilename,
      errors: [{messageId: 'wrongOrder'}]
    }
  ]
})

console.log('import-order rule tests passed')
