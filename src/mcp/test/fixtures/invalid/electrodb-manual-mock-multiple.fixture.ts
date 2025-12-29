/**
 * @fixture invalid
 * @rule entity-mocking
 * @severity HIGH
 * @description Multiple legacy entity mocks - should use #entities/queries instead
 * @expectedViolations 3
 * @simulatedPath src/lambdas/Test/test/index.test.ts
 */
import {vi} from 'vitest'

// These patterns are deprecated - mocking old entity wrappers
vi.mock('#entities/Users', () => ({Users: {get: vi.fn()}}))

vi.mock('#entities/Files', () => ({Files: {query: vi.fn()}}))

vi.mock('#entities/Devices', () => ({Devices: {scan: vi.fn()}}))
