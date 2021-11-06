import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import fs from 'fs'
import path from 'path'
chai.use(chaiAsPromised)

// eslint-disable-next-line @typescript-eslint/ban-types
export function getFixture(dir: string, file: string): object {
  const fixturePath = path.resolve(dir, 'fixtures')
  return JSON.parse(fs.readFileSync(`${fixturePath}/${file}`, 'utf8'))
}

export const partSize = 1024 * 1024 * 5
export const fakeJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMDAxODUuNzcyMDMxNTU3MGZjNDlkOTlhMjY1ZjlhZjRiNDY4NzkuMjAzNCJ9.wtotJzwuBIEHfBZssiA18NNObn70s9hk-M_ClRMXc8M'

export const mochaHooks = {
  beforeEach(): void {
  },
  afterEach(): void {
  }
}
