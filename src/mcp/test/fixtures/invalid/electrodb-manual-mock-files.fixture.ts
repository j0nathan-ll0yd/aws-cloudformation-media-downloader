/**
 * @fixture invalid
 * @rule electrodb-mocking
 * @severity CRITICAL
 * @description Manual Files entity mock with jest.mock
 * @expectedViolations 1
 * @simulatedPath src/lambdas/Test/test/index.test.ts
 */
import {beforeAll, describe, test} from '@jest/globals'
import {Files} from '#entities/Files'

jest.mock('#entities/Files', () => ({Files: {get: jest.fn(), put: jest.fn()}}))
