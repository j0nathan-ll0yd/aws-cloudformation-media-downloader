import {getFixture} from '../../../util/mocha-setup'
import chai from 'chai'
import {handler} from '../src'
const expect = chai.expect
const localFixture = getFixture.bind(null, __dirname)

describe('#CloudfrontMiddleware', () => {
  it('should handle a valid request (with API key)', async () => {
    const event = localFixture('APIGatewayEvent-200-OK.json')
    const output = await handler(event)
    expect(output.headers).to.have.property('x-api-key')
  })
  it('should handle a request without an API key', async () => {
    const event = localFixture('APIGatewayEvent-403-Forbidden.json')
    const output = await handler(event)
    expect(output.headers).to.not.have.property('x-api-key')
  })
})
