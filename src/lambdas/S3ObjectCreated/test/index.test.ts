import * as sinon from 'sinon'
import * as DynamoDB from '../../../lib/vendor/AWS/DynamoDB'
import * as chai from 'chai'
import * as SQS from '../../../lib/vendor/AWS/SQS'
import {getFixture} from '../../../util/mocha-setup'
import {handler} from '../src/index'
import {S3Event} from 'aws-lambda'
const expect = chai.expect
import path from 'path'
import {fileURLToPath} from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const localFixture = getFixture.bind(null, __dirname)

describe('#S3ObjectCreated', () => {
  const event = localFixture('Event.json') as S3Event
  let scanStub: sinon.SinonStub
  let sendMessageStub: sinon.SinonStub
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
    const output = await handler(event)
    // tslint:disable-next-line:no-unused-expression
    expect(output).to.be.undefined
  })
  it('should throw an error if the file does not exist', async () => {
    scanStub.onCall(0).returns({Count: 0})
    expect(handler(event)).to.be.rejectedWith(Error)
  })
})
