/**
 * @fixture invalid
 * @rule electrodb-mocking
 * @severity CRITICAL
 * @description Multiple manual entity mocks (forbidden)
 * @expectedViolations 3
 * @simulatedPath src/lambdas/Test/test/index.test.ts
 */
jest.unstable_mockModule('#entities/Users', () => ({
	Users: {get: jest.fn()}
}))

jest.unstable_mockModule('#entities/Files', () => ({
	Files: {query: jest.fn()}
}))

jest.unstable_mockModule('#entities/Devices', () => ({
	Devices: {scan: jest.fn()}
}))
