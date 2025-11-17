import {describe, expect, test, jest} from '@jest/globals'
import {Device} from '../types/main'

class MockOctokit {
  public rest: object
  constructor() {
    this.rest = {
      issues: {
        create: jest.fn().mockReturnValue({status: 201, data: {id: 1234}})
      }
    }
  }
}

jest.unstable_mockModule('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => {
    return new MockOctokit()
  })
}))

const {createFailedUserDeletionIssue} = await import('./github-helpers')

describe('#Util:GithubHelper', () => {
  test('should createFailedUserDeletionIssue', async () => {
    process.env.GithubPersonalToken = 'GithubPersonalToken'
    const userId = '1234'
    const device: Device = {deviceId: '', name: '', systemName: '', systemVersion: '', token: '', endpointArn: 'fakeArn'}
    const error: Error = new Error('test error')
    const requestId = '1234'
    const response = await createFailedUserDeletionIssue(userId, [device], error, requestId)
    expect(response).not.toBeNull()
    expect(response?.status).toEqual(201)
    expect(response?.data.id).toEqual(1234)
  })
})
