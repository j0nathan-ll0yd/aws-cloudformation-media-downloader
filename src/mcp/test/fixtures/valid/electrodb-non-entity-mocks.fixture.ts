/**
 * @fixture valid
 * @rule electrodb-mocking
 * @description Non-entity mocks (allowed)
 * @expectedViolations 0
 * @simulatedPath src/lambdas/Test/test/index.test.ts
 */
import {describe, test} from '@jest/globals'

jest.unstable_mockModule('#lib/vendor/AWS/S3', () => ({uploadToS3: jest.fn()}))

jest.unstable_mockModule('#util/lambda-helpers', () => ({response: jest.fn()}))
