import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import fs from 'fs'
import path from 'path'
import * as sinon from 'sinon'
chai.use(chaiAsPromised)

export function getFixture(dir, file) {
  const fixturePath = path.resolve(dir, 'fixtures')
  return JSON.parse(fs.readFileSync(`${fixturePath}/${file}`, 'utf8'))
}

export const partSize = 1024 * 1024 * 5
export const fakeJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMDAxODUuNzcyMDMxNTU3MGZjNDlkOTlhMjY1ZjlhZjRiNDY4NzkuMjAzNCJ9.wtotJzwuBIEHfBZssiA18NNObn70s9hk-M_ClRMXc8M'

export const mochaHooks = {
  beforeEach() {
    this.consoleLogStub = sinon.stub(console, 'log')
    this.consoleInfoStub = sinon.stub(console, 'info')
    this.consoleDebugStub = sinon.stub(console, 'debug')
    this.consoleWarnStub = sinon.stub(console, 'warn')
    this.consoleErrorStub = sinon.stub(console, 'error')
  },
  afterEach() {
    this.consoleLogStub.restore()
    this.consoleInfoStub.restore()
    this.consoleDebugStub.restore()
    this.consoleWarnStub.restore()
    this.consoleErrorStub.restore()
  }
}
