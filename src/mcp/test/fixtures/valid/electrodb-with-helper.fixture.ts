/**
 * @fixture valid
 * @rule entity-mocking
 * @description Using vi.fn() mocks for query functions (correct pattern)
 * @expectedViolations 0
 * @simulatedPath src/lambdas/Test/test/index.test.ts
 */
import {vi} from 'vitest'

vi.mock('#entities/queries', () => ({
  getUser: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn()
}))
