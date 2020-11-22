import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import * as sinon from 'sinon'
import chai from 'chai'
import {fakeJWT, getFixture} from '../../../util/mocha-setup'
import {handleLoginUser} from '../src'
const expect = chai.expect
const localFixture = getFixture.bind(null, __dirname)

describe('#handleLoginUser', () => {
  const event = localFixture('APIGatewayEvent.json')
  const context = localFixture('Context.json')
  const dependencyModule = require('../../../util/secretsmanager-helpers')
  let createAccessTokenStub
  let mock
  beforeEach(() => {
    mock = new MockAdapter(axios)
    createAccessTokenStub = sinon.stub(dependencyModule, 'createAccessToken')
      .returns(fakeJWT)
  })
  afterEach(() => {
    createAccessTokenStub.restore()
    mock.reset()
  })
  it('should successfully login a user', async () => {
    const mockResponse = localFixture('axios-200-OK.json')
    mock.onAny().reply(200, mockResponse)
    const output = await handleLoginUser(event, context)
    expect(output.statusCode).to.equal(200)
    const body = JSON.parse(output.body)
    expect(body.body.token).to.be.a('string')
  })
})
