import * as sinon from 'sinon'
import * as SNS from '../../../lib/vendor/AWS/SNS'
import chai from 'chai'
import {getFixture} from '../../../util/mocha-setup'
import {fileUploadWebhook} from '../src'
const expect = chai.expect
const localFixture = getFixture.bind(null, __dirname)

describe('#fileUploadWebhook', () => {
  const event = localFixture('Event.json')
  let publishSnsEventStub
  beforeEach(() => {
    publishSnsEventStub = sinon.stub(SNS, 'publishSnsEvent')
  })
  afterEach(() => {
    publishSnsEventStub.restore()
  })
  it('should publish the event to the topic', async () => {
    publishSnsEventStub.returns(localFixture('publishSnsEvent-200-OK.json'))
    const output = await fileUploadWebhook(event)
    expect(output).to.have.all.keys('messageId')
  })
  it('should handle an invalid parameter', async () => {
    publishSnsEventStub.rejects('Error')
    expect(fileUploadWebhook(event)).to.be.rejectedWith(Error)
  })
})
