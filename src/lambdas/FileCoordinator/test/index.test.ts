import * as sinon from 'sinon'
import * as DynamoDB from '../../../lib/vendor/AWS/DynamoDB'
import * as StepFunctions from '../../../lib/vendor/AWS/StepFunctions'
import chai from 'chai'
import {getFixture, testContext} from '../../../util/mocha-setup'
import {handler} from '../src'
const expect = chai.expect
const localFixture = getFixture.bind(null, __dirname)

describe('#FileCoordinator', () => {
  process.env.DynamoDBTableFiles = 'Files'
  const context = testContext
  const event = localFixture('ScheduledEvent.json')
  let scanStub
  let startExecutionStub
  beforeEach(() => {
    scanStub = sinon.stub(DynamoDB, 'scan')
    startExecutionStub = sinon.stub(StepFunctions, 'startExecution')
  })
  afterEach(() => {
    scanStub.restore()
    startExecutionStub.restore()
  })
  it('should handle scheduled event (with no events)', async () => {
    scanStub.returns(localFixture('scan-204-NoContent.json'))
    startExecutionStub.returns(localFixture('startExecution-200-OK.json'))
    const output = await handler(event, context)
    expect(output.statusCode).to.equal(200)
    expect(startExecutionStub.callCount).to.equal(0)
  })
  it('should handle scheduled event (with 1 event)', async () => {
    scanStub.returns(localFixture('scan-200-OK.json'))
    startExecutionStub.returns(localFixture('startExecution-200-OK.json'))
    const output = await handler(event, context)
    expect(output.statusCode).to.equal(200)
    expect(startExecutionStub.callCount).to.equal(1)
  })
})
