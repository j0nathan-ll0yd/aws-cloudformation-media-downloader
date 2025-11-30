import {Octokit} from '@octokit/rest'
import {
  logDebug,
  logError,
  logInfo
} from './lambda-helpers'
import {Device} from '../types/main'
import {renderGithubIssueTemplate} from './template-helpers'

const owner = 'j0nathan-ll0yd'
const repo = 'aws-cloudformation-media-downloader'

async function getOctokitInstance() {
  // Constrained to only reading/writing issues
  return new Octokit({
    auth: process.env.GithubPersonalToken,
    baseUrl: 'https://api.github.com',
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
        /* c8 ignore next */
        logError(message)
      }
    }
  })
}

export async function createFailedUserDeletionIssue(
  userId: string,
  devices: Device[],
  error: Error,
  requestId: string
) {
  const title = `User Deletion Failed: ${userId}`
  const body = renderGithubIssueTemplate('user-deletion-failure', { userId, devices, error, requestId })

  const params = { owner, repo, title, body, labels: ['bug', 'user-management', 'automated', 'requires-manual-fix'] }

  try {
    const octokit = await getOctokitInstance()
    logDebug('createFailedUserDeletionIssue =>', params)
    const response = await octokit.rest.issues.create(params)
    logDebug('createFailedUserDeletionIssue <=', response)
    return response
  } catch (githubError) {
    // Don't fail the Lambda if GitHub issue creation fails
    logError('Failed to create GitHub issue for user deletion failure', githubError)
    return null
  }
}

export async function createVideoDownloadFailureIssue(
  fileId: string,
  fileUrl: string,
  error: Error,
  errorDetails?: string
) {
  const title = `Video Download Failed: ${fileId}`
  const body = renderGithubIssueTemplate('video-download-failure', { fileId, fileUrl, error, errorDetails })

  const params = { owner, repo, title, body, labels: ['bug', 'video-download', 'automated'] }

  try {
    const octokit = await getOctokitInstance()
    logDebug('createVideoDownloadFailureIssue =>', params)
    const response = await octokit.rest.issues.create(params)
    logDebug('createVideoDownloadFailureIssue <=', response)
    return response
  } catch (githubError) {
    // Don't fail the Lambda if GitHub issue creation fails
    logError('Failed to create GitHub issue for video download failure', githubError)
    return null
  }
}

export async function createCookieExpirationIssue(fileId: string, fileUrl: string, error: Error) {
  const title = '🍪 YouTube Cookie Expiration Detected'
  const body = renderGithubIssueTemplate('cookie-expiration', { fileId, fileUrl, error })

  const params = {
    owner,
    repo,
    title,
    body,
    labels: ['cookie-expiration', 'requires-manual-fix', 'automated', 'priority']
  }

  try {
    const octokit = await getOctokitInstance()
    logDebug('createCookieExpirationIssue =>', params)
    const response = await octokit.rest.issues.create(params)
    logInfo('Created GitHub issue for cookie expiration', {
      issueNumber: response.data.number,
      issueUrl: response.data.html_url
    })
    return response
  } catch (githubError) {
    // Don't fail the Lambda if GitHub issue creation fails
    logError('Failed to create GitHub issue for cookie expiration', githubError)
    return null
  }
}
