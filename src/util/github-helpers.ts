import {Octokit} from '@octokit/rest'
import {logDebug, logError, logInfo} from './lambda-helpers'
import {Device} from '../types/main'

// Constrainted to only reading/writing issues
const personalAccessToken = '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'
const owner = 'j0nathan-ll0yd'
const repo = 'aws-cloudformation-media-downloader'
const octokit = new Octokit({
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
      logError(message)
    }
  }
})

export async function createFailedUserDeletionIssue(userId: string, devices: Device[], error: Error, requestId: string) {
  // TODO: Add expiration time (2 weeks) and markdown formatting
  const title = ''
  const body = `userId: ${userId}, devices: ${devices.join(', ')}, error: ${error.message}, requestId: ${requestId}`
  const params = {
    owner,
    repo,
    title,
    body
  }
  logDebug('createFailedUserDeletionIssue =>', params)
  const response = await octokit.rest.issues.create(params)
  logDebug('createFailedUserDeletionIssue <=', response)
}
