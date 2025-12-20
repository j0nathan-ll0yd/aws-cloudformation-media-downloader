/**
 * @fixture valid
 * @rule electrodb-mocking
 * @description Using createElectroDBEntityMock helper (allowed)
 * @expectedViolations 0
 * @simulatedPath src/lambdas/Test/test/index.test.ts
 */
import {createElectroDBEntityMock} from '../../../../test/helpers/electrodb-mock'
import {Users} from '#entities/Users'

const UsersMock = createElectroDBEntityMock({get: jest.fn(), create: jest.fn()})

jest.unstable_mockModule('#entities/Users', () => ({Users: createElectroDBEntityMock({get: jest.fn()})}))
