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

export async function createVideoDownloadFailureIssue(fileId: string, fileUrl: string, error: Error, errorDetails?: string) {
  const title = `Video Download Failed: ${fileId}`
  const body = `## Video Download Failure

**File ID**: ${fileId}
**URL**: ${fileUrl}
**Error Type**: ${error.constructor.name}
**Error Message**: ${error.message}

${errorDetails ? `### Additional Details\n\`\`\`\n${errorDetails}\n\`\`\`` : ''}

### Stack Trace
\`\`\`
${error.stack || 'No stack trace available'}
\`\`\`

**Timestamp**: ${new Date().toISOString()}

---
This issue was automatically created by the video download monitoring system.`

  const params = {
    owner,
    repo,
    title,
    body,
    labels: ['bug', 'video-download', 'automated']
  }

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
  const body = `## YouTube Cookie Expiration

YouTube has detected the cookies as expired or is blocking requests with bot detection.

**Triggered By**:
- **File ID**: ${fileId}
- **Video URL**: ${fileUrl}
- **Error Message**: ${error.message}
- **Timestamp**: ${new Date().toISOString()}

---

## Required Action: Refresh YouTube Cookies

### Step 1: Extract New Cookies
\`\`\`bash
# Ensure you're logged into YouTube in Chrome
# Then run the cookie update script
npm run update-cookies
\`\`\`

This will:
1. Extract cookies from Chrome browser
2. Filter to YouTube/Google domains only
3. Copy filtered cookies to Lambda layer directory

### Step 2: Build and Deploy
\`\`\`bash
npm run build
npm run deploy
\`\`\`

### Step 3: Verify Fix
\`\`\`bash
# Trigger a test download
/opt/homebrew/bin/aws lambda invoke \\
  --function-name FileCoordinator \\
  --region us-west-2 \\
  --payload '{}' \\
  /dev/null

# Monitor logs for authentication success
/opt/homebrew/bin/aws logs tail /aws/lambda/StartFileUpload \\
  --region us-west-2 \\
  --follow \\
  --format short
\`\`\`

---

## Background

YouTube cookies typically last 30-60 days. This error indicates:
- Cookies have expired naturally
- YouTube has invalidated the session
- Bot detection triggered (datacenter IP + stale cookies)

**Cookie Location**: \`layers/yt-dlp/cookies/youtube-cookies.txt\` (18KB, filtered)

**Documentation**: See \`docs/YT-DLP-MIGRATION-STRATEGY.md\` Phase 2 for details.

---

## Stack Trace
\`\`\`
${error.stack || 'No stack trace available'}
\`\`\`

---
This issue was automatically created by the cookie monitoring system.`

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
    logInfo('Created GitHub issue for cookie expiration', {issueNumber: response.data.number, issueUrl: response.data.html_url})
    return response
  } catch (githubError) {
    // Don't fail the Lambda if GitHub issue creation fails
    logError('Failed to create GitHub issue for cookie expiration', githubError)
    return null
  }
}
