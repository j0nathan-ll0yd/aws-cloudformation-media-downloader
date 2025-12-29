/**
 * @fixture invalid
 * @rule entity-mocking
 * @severity HIGH
 * @description Legacy entity mock - should use #entities/queries instead
 * @expectedViolations 1
 * @simulatedPath src/lambdas/Test/test/index.test.ts
 */
import {vi} from 'vitest'

// This pattern is deprecated - mocking old entity wrappers
vi.mock('#entities/Files', () => ({Files: {get: vi.fn(), put: vi.fn()}}))
