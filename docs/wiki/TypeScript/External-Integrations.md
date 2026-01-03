# External Integrations

This document covers the external service integrations in the project.

## Overview

The project integrates with several external services:

```
src/lib/
├── vendor/
│   └── YouTube.ts          # YouTube/yt-dlp wrapper
└── integrations/
    └── github/
        ├── issue-service.ts    # Automated GitHub issue creation
        └── templates.ts        # Issue template rendering
```

---

## YouTube Integration

The YouTube vendor wrapper (`src/lib/vendor/YouTube.ts`) handles video downloading using yt-dlp.

### Configuration

```typescript
const YTDLP_CONFIG = {
  COOKIES_SOURCE: '/opt/cookies/youtube-cookies.txt',  // Read-only Lambda layer
  COOKIES_DEST: '/tmp/youtube-cookies.txt',            // Writable temp path
  EXTRACTOR_ARGS: 'youtube:player_client=default',     // Bot detection bypass
  FORMAT_SELECTOR: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
  MERGE_FORMAT: 'mp4',
  CONCURRENT_FRAGMENTS: '4'
}
```

### Video Info Fetching

```typescript
import {fetchVideoInfo} from '#lib/vendor/YouTube'

const result = await fetchVideoInfo('https://youtube.com/watch?v=dQw4w9WgXcQ')

if (result.success) {
  console.log(result.info.title)
  console.log(result.info.duration)
  console.log(result.info.formats)
} else {
  console.error(result.error)
  if (result.isCookieError) {
    // Handle cookie expiration - notify operator
  }
}
```

### Video Download to S3

```typescript
import {downloadVideoToS3} from '#lib/vendor/YouTube'

const result = await downloadVideoToS3(
  'https://youtube.com/watch?v=dQw4w9WgXcQ',
  'my-bucket',
  'videos/dQw4w9WgXcQ.mp4'
)

console.log(`Uploaded ${result.fileSize} bytes to ${result.s3Url}`)
console.log(`Download took ${result.duration} seconds`)
```

### Cookie Authentication

YouTube requires cookie authentication to work around bot detection:

1. Cookies stored in Lambda layer at `/opt/cookies/youtube-cookies.txt`
2. Copied to `/tmp/` at runtime (yt-dlp needs write access)
3. When cookies expire, `CookieExpirationError` is thrown
4. Error triggers automated GitHub issue for operator intervention

### Cookie Expiration Detection

```typescript
import {isCookieExpirationError} from '#lib/vendor/YouTube'

try {
  await downloadVideoToS3(url, bucket, key)
} catch (error) {
  if (error instanceof CookieExpirationError || isCookieExpirationError(error.message)) {
    // Cookies expired - create GitHub issue for manual refresh
    await createCookieExpirationIssue(fileId, fileUrl, error)
  }
}
```

### Utility Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `fetchVideoInfo(url)` | Get video metadata | `FetchVideoInfoResult` |
| `downloadVideoToS3(url, bucket, key)` | Download video to S3 | `{fileSize, s3Url, duration}` |
| `getVideoID(url)` | Extract video ID from URL | `string` |
| `isCookieExpirationError(message)` | Check for cookie/bot errors | `boolean` |

### CloudWatch Metrics

The download function publishes metrics via Powertools:

| Metric | Unit | Description |
|--------|------|-------------|
| `VideoDownloadSuccess` | Count | Successful downloads |
| `VideoDownloadFailure` | Count | Failed downloads |
| `VideoDownloadDuration` | Seconds | Download duration |
| `VideoDownloadSize` | Bytes | File size |
| `VideoThroughput` | Count | MB/s throughput |

---

## GitHub Integration

The GitHub integration (`src/lib/integrations/github/`) provides automated issue creation for operational alerts.

### Issue Service

```typescript
import {
  createFailedUserDeletionIssue,
  createVideoDownloadFailureIssue,
  createCookieExpirationIssue
} from '#lib/integrations/github/issue-service'
```

### User Deletion Failure

Creates an issue when user deletion fails, for manual cleanup:

```typescript
await createFailedUserDeletionIssue(
  userId,           // User ID that failed
  devices,          // Array of user devices
  error,            // The error that occurred
  requestId         // Lambda request ID for tracing
)
// Labels: bug, user-management, automated, requires-manual-fix
```

### Video Download Failure

Creates an issue when a video download fails permanently:

```typescript
await createVideoDownloadFailureIssue(
  fileId,           // File ID
  fileUrl,          // YouTube URL
  error,            // The error
  errorDetails?     // Optional additional context
)
// Labels: bug, video-download, automated
```

### Cookie Expiration Alert

Creates a priority issue when YouTube cookies expire:

```typescript
await createCookieExpirationIssue(
  fileId,           // File that triggered detection
  fileUrl,          // YouTube URL
  error             // The error
)
// Labels: cookie-expiration, requires-manual-fix, automated, priority
```

### Template Rendering

Issue bodies are rendered from Markdown templates:

```typescript
import {renderGithubIssueTemplate} from '#lib/integrations/github/templates'

const body = renderGithubIssueTemplate('video-download-failure', {
  fileId,
  fileUrl,
  errorMessage: error.message,
  errorName: error.constructor.name,
  errorStack: error.stack ?? 'No stack trace available',
  timestamp: new Date().toISOString()
})
```

Templates are located at `src/templates/github-issues/*.md` and use `${variableName}` syntax.

### Configuration

| Environment Variable | Description |
|---------------------|-------------|
| `GITHUB_PERSONAL_TOKEN` | GitHub personal access token (issues scope) |

### Error Handling

Issue creation is non-blocking - if GitHub API fails:
- Error is logged
- Function returns `null`
- Lambda continues normally

```typescript
const result = await createCookieExpirationIssue(fileId, url, error)
if (!result) {
  // GitHub issue creation failed, but Lambda continues
  logError('Failed to create GitHub issue')
}
```

---

## Testing Patterns

### Mocking YouTube Wrapper

```typescript
import {vi, describe, test, expect} from 'vitest'

vi.mock('#lib/vendor/YouTube', () => ({
  fetchVideoInfo: vi.fn(),
  downloadVideoToS3: vi.fn(),
  getVideoID: vi.fn(),
  isCookieExpirationError: vi.fn()
}))

import {fetchVideoInfo, downloadVideoToS3} from '#lib/vendor/YouTube'

beforeEach(() => {
  vi.mocked(fetchVideoInfo).mockResolvedValue({
    success: true,
    info: {id: 'dQw4w9WgXcQ', title: 'Test Video', duration: 212}
  })

  vi.mocked(downloadVideoToS3).mockResolvedValue({
    fileSize: 1024000,
    s3Url: 's3://bucket/key',
    duration: 45
  })
})
```

### Mocking GitHub Integration

```typescript
vi.mock('#lib/integrations/github/issue-service', () => ({
  createFailedUserDeletionIssue: vi.fn(),
  createVideoDownloadFailureIssue: vi.fn(),
  createCookieExpirationIssue: vi.fn()
}))

import {createCookieExpirationIssue} from '#lib/integrations/github/issue-service'

test('creates issue on cookie expiration', async () => {
  vi.mocked(createCookieExpirationIssue).mockResolvedValue({
    data: {number: 123, html_url: 'https://github.com/.../issues/123'}
  })

  // Test code...

  expect(createCookieExpirationIssue).toHaveBeenCalledWith(
    'file-id',
    'https://youtube.com/...',
    expect.any(Error)
  )
})
```

---

## Best Practices

1. **Use vendor wrappers** - Never import external libraries directly in Lambda handlers
2. **Handle cookie expiration** - Always check for `CookieExpirationError` in video downloads
3. **Non-blocking issue creation** - GitHub issue failures should not fail Lambdas
4. **Template security** - Use explicit variable replacement, not dynamic evaluation
5. **Lazy environment access** - Call `getRequiredEnv()` inside functions, not at module level

---

## Related Documentation

- [Vendor Encapsulation Policy](../Conventions/Vendor-Encapsulation-Policy.md) - Import rules
- [Lambda Function Patterns](Lambda-Function-Patterns.md) - Handler patterns
- [System Library](System-Library.md) - Error types and logging
- [Vitest Mocking Strategy](../Testing/Vitest-Mocking-Strategy.md) - Test patterns
