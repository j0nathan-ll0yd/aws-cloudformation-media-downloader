import * as sinon from 'sinon'
import * as DynamoDB from '../../../lib/vendor/AWS/DynamoDB'
import chai from 'chai'
import * as SQS from '../../../lib/vendor/AWS/SQS'
import { getFixture } from '../../../util/mocha-setup'
import { fileUploadWebhook } from '../src'
const expect = chai.expect
const localFixture = getFixture.bind(null, __dirname)

describe('#fileUploadWebhook', () => {
  const event = localFixture('Event.json')
  let scanStub
  let sendMessageStub
  beforeEach(() => {
    scanStub = sinon.stub(DynamoDB, 'scan')
    scanStub.onCall(0).returns(localFixture('getFileByKey-200-OK.json'))
    scanStub.onCall(1).returns(localFixture('getUsersByFileId-200-OK.json'))
    sendMessageStub = sinon.stub(SQS, 'sendMessage')
  })
  afterEach(() => {
    scanStub.restore()
    sendMessageStub.restore()
  })
  it('should dispatch push notifications for each user with the file', async () => {
    const output = await fileUploadWebhook(event)
    // tslint:disable-next-line:no-unused-expression
    expect(output).to.be.undefined
  })
  it('should throw an error if the file does not exist', async () => {
    scanStub.onCall(0).returns({ Count: 0 })
    expect(fileUploadWebhook(event)).to.be.rejectedWith(Error)
  })
})
