/**
 * @fixture invalid
 * @rule electrodb-mocking
 * @severity CRITICAL
 * @description Manual entity mock without createElectroDBEntityMock helper
 * @expectedViolations 1
 * @simulatedPath src/lambdas/Test/test/index.test.ts
 */
import {beforeAll, describe, test} from '@jest/globals'
import {Users} from '#entities/Users'

jest.unstable_mockModule('#entities/Users', () => ({Users: {get: jest.fn(), create: jest.fn()}}))
