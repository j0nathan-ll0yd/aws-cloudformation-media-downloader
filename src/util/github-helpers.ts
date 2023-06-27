import {Octokit} from '@octokit/rest'
import {logDebug, logError, logInfo} from './lambda-helpers'
import {Device} from '../types/main'
import {getGithubPersonalToken} from './secretsmanager-helpers'

const owner = 'j0nathan-ll0yd'
const repo = 'aws-cloudformation-media-downloader'

async function getOctokitInstance() {
  // Constrainted to only reading/writing issues
  const personalAccessToken = await getGithubPersonalToken()
  return new Octokit({
    auth: personalAccessToken,
    userAgent: `${repo}-production`,
    timeZone: 'America/Los_Angeles',
    log: {
      debug: (message) => {
        logDebug(message)
      },
      info: (message) => {
        logInfo(message)
      },
      warn: (message) => {
        logDebug(message)
      },
      error: (message) => {
        /* istanbul ignore next */
        logError(message)
      }
    }
  })
}

export async function createFailedUserDeletionIssue(userId: string, devices: Device[], error: Error, requestId: string) {
  // TODO: Add expiration time (2 weeks) and markdown formatting
  const title = `UserDelete Failed for UserId: ${userId}`
  const body = `userId: ${userId}, devices: ${devices.join(', ')}, error: ${error.message}, requestId: ${requestId}`
  const params = {
    owner,
    repo,
    title,
    body
  }
  const octokit = await getOctokitInstance()
  logDebug('createFailedUserDeletionIssue =>', params)
  const response = await octokit.rest.issues.create(params)
  logDebug('createFailedUserDeletionIssue <=', response)
  return response
}
