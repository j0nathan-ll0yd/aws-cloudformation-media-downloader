# Implementation Plan: Self-Healing Workflows for Scheduled Videos

## Overview

Transform the system from brittle fail-fast behavior to resilient self-healing workflows that intelligently handle scheduled videos, livestreams, and transient failures.

**GitHub Issue**: [#3 - Better handle videos with a scheduled video public time](https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/issues/3)

**Goal**: When YouTube RSS publishes a scheduled video URL before publication, the system should detect this, schedule a retry at the correct time, and automatically download when the video becomes available - with zero user intervention.

---

## Current State Analysis

### Files Entity (`src/entities/Files.ts`)
- **Status values**: `PendingMetadata`, `PendingDownload`, `Downloaded`, `Failed`
- **Index**: `byStatus` GSI sorts by `status` + `availableAt`
- **Missing**: No retry fields, no scheduled status

### StartFileUpload Lambda (`src/lambdas/StartFileUpload/src/index.ts`)
- Fetches video info via `fetchVideoInfo()`
- Handles `CookieExpirationError` specifically
- All other errors result in `Failed` status
- Creates GitHub issues for ALL failures (noise problem)

### FileCoordinator Lambda (`src/lambdas/FileCoordinator/src/index.ts`)
- Runs every 4 minutes (currently disabled)
- Queries `PendingDownload` files where `availableAt <= now` and `url` doesn't exist
- **Missing**: Does not query for scheduled files ready for retry

### YtDlpVideoInfo Type (`src/types/youtube.ts`)
- **Missing**: `release_timestamp`, `is_live`, `live_status` fields that yt-dlp provides for scheduled content

---

## Implementation Phases

### Phase 1: Error Classification Utility

**Files to create:**
- `src/util/video-error-classifier.ts` - Error classification logic

**Changes:**

```typescript
// src/util/video-error-classifier.ts

export type VideoErrorCategory =
  | 'scheduled'           // Scheduled video, retry at release_timestamp
  | 'livestream_upcoming' // Livestream not started, retry when starts
  | 'premiere'            // Premiere scheduled, retry at premiere time
  | 'transient'           // Network/temporary error, exponential backoff
  | 'cookie_expired'      // Cookie needs refresh, requires manual intervention
  | 'permanent'           // Deleted, geo-blocked, private - no retry

export interface VideoErrorClassification {
  category: VideoErrorCategory
  retryable: boolean
  retryAfter?: number      // Unix timestamp for retry (undefined = no retry)
  maxRetries?: number      // Override default max retries for this category
  reason: string           // Human-readable reason
}

export function classifyVideoError(
  error: Error,
  videoInfo?: Partial<ExtendedYtDlpVideoInfo>
): VideoErrorClassification

export function calculateExponentialBackoff(
  retryCount: number,
  baseDelaySeconds?: number,
  maxDelaySeconds?: number
): number
```

**Classification Logic:**

| Condition | Category | Retry Strategy |
|-----------|----------|----------------|
| `videoInfo.release_timestamp > now` | `scheduled` | Retry at `release_timestamp + 300` (5 min buffer) |
| `videoInfo.is_live === false && live_status === 'upcoming'` | `livestream_upcoming` | Retry at `release_timestamp` or exponential backoff |
| `error instanceof CookieExpirationError` | `cookie_expired` | No automatic retry, create GitHub issue |
| Network error patterns (timeout, ECONNRESET) | `transient` | Exponential backoff (15min, 30min, 1hr, 2hr, 4hr) |
| "Video unavailable" without release_timestamp | `permanent` | No retry, create GitHub issue |
| "Private video", "Deleted video", "Geo-blocked" | `permanent` | No retry, create GitHub issue |

**Test coverage:**
- Unit tests for each error category
- Edge cases: release_timestamp in past, missing videoInfo, malformed errors

---

### Phase 2: Schema Updates

**Files to modify:**
- `src/types/enums.ts` - Add `Scheduled` status
- `src/entities/Files.ts` - Add retry metadata fields
- `src/types/youtube.ts` - Extend with scheduling fields

#### 2.1 FileStatus Enum Update

```typescript
// src/types/enums.ts
export enum FileStatus {
  PendingMetadata = 'PendingMetadata',
  PendingDownload = 'PendingDownload',
  Scheduled = 'Scheduled',      // NEW: Waiting for availability
  Downloaded = 'Downloaded',
  Failed = 'Failed'
}
```

#### 2.2 Files Entity Schema Update

```typescript
// src/entities/Files.ts - New attributes
attributes: {
  // ... existing attributes ...

  // Retry metadata (NEW)
  retryAfter: {type: 'number', required: false},           // Unix timestamp for next retry
  retryCount: {type: 'number', required: false, default: 0}, // Number of retry attempts
  maxRetries: {type: 'number', required: false, default: 5}, // Max retries before permanent failure
  lastError: {type: 'string', required: false},            // Last error message for debugging
  scheduledPublishTime: {type: 'number', required: false}, // Original publish time from YouTube
  errorCategory: {type: 'string', required: false}         // Error classification category
}
```

**Index consideration:** The existing `byStatus` index already sorts by `availableAt`. For scheduled files, we'll set `availableAt` to the retry time, allowing FileCoordinator to query efficiently:
- `status = 'Scheduled' AND availableAt <= now` - Files ready for retry

#### 2.3 YtDlpVideoInfo Type Extension

```typescript
// src/types/youtube.ts
export interface YtDlpVideoInfo {
  // ... existing fields ...

  // Scheduling fields (yt-dlp provides these for scheduled content)
  release_timestamp?: number    // Unix timestamp when video becomes available
  is_live?: boolean            // Whether this is a livestream
  live_status?: 'is_live' | 'is_upcoming' | 'was_live' | 'not_live'
  premiere_timestamp?: number   // Premiere scheduled time (if applicable)
  availability?: 'public' | 'unlisted' | 'private' | 'needs_auth' | 'subscriber_only'
}
```

---

### Phase 3: StartFileUpload Intelligent Error Handling

**Files to modify:**
- `src/lambdas/StartFileUpload/src/index.ts` - Integrate error classifier

**Changes:**

1. **Attempt metadata fetch even on failure** - Use `--skip-download` flag to get video info without downloading
2. **Apply error classification** to determine retry strategy
3. **Update file with retry metadata** instead of immediately failing
4. **Only create GitHub issues for permanent failures** - Eliminates noise

**Updated Error Handling Flow:**

```typescript
// src/lambdas/StartFileUpload/src/index.ts - Error handler

try {
  // ... existing download logic ...
} catch (error) {
  assertIsError(error)

  // Attempt to fetch metadata even after failure (may have release_timestamp)
  let videoInfo: Partial<ExtendedYtDlpVideoInfo> | undefined
  try {
    videoInfo = await fetchVideoInfoSafe(fileUrl) // New function with --skip-download
  } catch {
    // Ignore - we tried our best to get scheduling info
  }

  // Classify the error
  const classification = classifyVideoError(error, videoInfo)

  // Get existing file for retry count
  const {data: existingFile} = await Files.get({fileId}).go()
  const retryCount = (existingFile?.retryCount ?? 0) + 1
  const maxRetries = classification.maxRetries ?? existingFile?.maxRetries ?? 5

  if (classification.retryable && classification.retryAfter && retryCount <= maxRetries) {
    // Schedule retry
    await Files.update({fileId})
      .set({
        status: FileStatus.Scheduled,
        retryAfter: classification.retryAfter,
        availableAt: classification.retryAfter, // For GSI query efficiency
        retryCount,
        lastError: classification.reason,
        scheduledPublishTime: videoInfo?.release_timestamp,
        errorCategory: classification.category
      })
      .go()

    await putMetrics([
      {name: 'ScheduledVideoDetected', value: 1, unit: 'Count'},
      {name: 'RetryScheduled', value: 1, unit: 'Count', dimensions: [{Name: 'Category', Value: classification.category}]}
    ])

    logInfo(`Scheduled retry for ${fileId}`, {
      retryAfter: new Date(classification.retryAfter * 1000).toISOString(),
      reason: classification.reason,
      retryCount
    })

    // NO GitHub issue for scheduled retries
    return response(200, {fileId, status: 'scheduled', retryAfter: classification.retryAfter})
  }

  // Max retries exceeded OR permanent failure
  await Files.update({fileId})
    .set({
      status: FileStatus.Failed,
      lastError: classification.reason,
      retryCount,
      errorCategory: classification.category
    })
    .go()

  await putMetrics([{name: 'LambdaExecutionFailure', value: 1, unit: 'Count'}])

  // Only create GitHub issues for permanent failures
  if (classification.category === 'permanent' || classification.category === 'cookie_expired') {
    if (error instanceof CookieExpirationError) {
      await createCookieExpirationIssue(fileId, fileUrl, error)
    } else {
      await createVideoDownloadFailureIssue(fileId, fileUrl, error, classification.reason)
    }
  }

  return errorResponse(error)
}
```

**New utility function:**

```typescript
// src/lib/vendor/YouTube.ts

/**
 * Fetch video info without attempting download
 * Used to get release_timestamp for unavailable videos
 */
export async function fetchVideoInfoSafe(uri: string): Promise<YtDlpVideoInfo | undefined> {
  try {
    // Use --skip-download to only get metadata
    const ytDlp = new YTDlpWrap(getRequiredEnv('YtdlpBinaryPath'))
    const info = await ytDlp.getVideoInfo([uri, '--skip-download', '--ignore-errors', ...commonFlags])
    return info as YtDlpVideoInfo
  } catch {
    return undefined
  }
}
```

---

### Phase 4: FileCoordinator Updates

**Files to modify:**
- `src/lambdas/FileCoordinator/src/index.ts` - Query scheduled files

**Changes:**

Update `getFileIdsToBeDownloaded()` to include both `PendingDownload` AND `Scheduled` files ready for retry:

```typescript
// src/lambdas/FileCoordinator/src/index.ts

async function getFileIdsToBeDownloaded(): Promise<string[]> {
  const now = Math.floor(Date.now() / 1000)

  // Query 1: Pending downloads
  const {data: pendingFiles} = await Files.query
    .byStatus({status: FileStatus.PendingDownload})
    .where(({availableAt}, {lte}) => lte(availableAt, now))
    .where(({url}, {notExists}) => notExists(url))
    .go()

  // Query 2: Scheduled files ready for retry
  const {data: scheduledFiles} = await Files.query
    .byStatus({status: FileStatus.Scheduled})
    .where(({availableAt}, {lte}) => lte(availableAt, now))
    .go()

  if (!pendingFiles || !scheduledFiles) {
    throw new UnexpectedError(providerFailureErrorMessage)
  }

  const allFileIds = [
    ...pendingFiles.map(f => f.fileId),
    ...scheduledFiles.map(f => f.fileId)
  ]

  logInfo(`Files to process: ${allFileIds.length}`, {
    pending: pendingFiles.length,
    scheduled: scheduledFiles.length
  })

  return allFileIds
}
```

**Concurrency consideration:** Add rate limiting for scheduled retries to avoid overwhelming yt-dlp:

```typescript
// Process in batches of 5 with 10-second delays between batches
const BATCH_SIZE = 5
const BATCH_DELAY_MS = 10000

for (let i = 0; i < allFileIds.length; i += BATCH_SIZE) {
  const batch = allFileIds.slice(i, i + BATCH_SIZE)
  await Promise.all(batch.map(fileId => initiateFileDownload(fileId)))

  if (i + BATCH_SIZE < allFileIds.length) {
    await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS))
  }
}
```

---

### Phase 5: Infrastructure & Monitoring

**Files to modify:**
- `terraform/file_coordinator.tf` - Enable scheduling, update IAM
- `terraform/main.tf` - No changes needed (GSI already exists)

#### 5.1 CloudWatch Metrics

New metrics to track:
- `ScheduledVideoDetected` - Count of detected scheduled videos
- `RetryScheduled` - Count of scheduled retries (with Category dimension)
- `RetrySuccess` - Count of successful retries
- `RetryExhausted` - Count of files that exceeded max retries

#### 5.2 CloudWatch Alarms (Optional)

```hcl
# terraform/cloudwatch_alarms.tf

resource "aws_cloudwatch_metric_alarm" "RetryQueueBacklog" {
  alarm_name          = "MediaDownloader-RetryQueueBacklog"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "ScheduledVideoDetected"
  namespace           = "MediaDownloader"
  period              = 3600
  statistic           = "Sum"
  threshold           = 100
  alarm_description   = "High number of scheduled videos in retry queue"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}
```

#### 5.3 Enable FileCoordinator Schedule

```hcl
# terraform/file_coordinator.tf - Change from DISABLED to ENABLED
resource "aws_cloudwatch_event_rule" "FileCoordinator" {
  name                = "FileCoordinator"
  schedule_expression = "rate(4 minutes)"
  state               = "ENABLED"  # Changed from DISABLED
}
```

---

### Phase 6: Testing Strategy

#### 6.1 Unit Tests

**Error Classifier Tests** (`src/util/video-error-classifier.test.ts`):
- Test each error category detection
- Test exponential backoff calculations
- Test edge cases (past timestamps, missing fields)

**StartFileUpload Tests** (`src/lambdas/StartFileUpload/test/index.test.ts`):
- Test scheduled video detection flow
- Test retry count increment and max retry behavior
- Test GitHub issue creation only for permanent failures
- Mock ElectroDB using `createElectroDBEntityMock`

**FileCoordinator Tests** (`src/lambdas/FileCoordinator/test/index.test.ts`):
- Test combined query for pending + scheduled files
- Test batch processing with delays
- Verify correct invocation of StartFileUpload

#### 6.2 Integration Tests (LocalStack)

**Scheduled Video Flow**:
1. Create file with `status: Scheduled`, `availableAt: past`
2. Run FileCoordinator
3. Verify StartFileUpload invoked
4. Mock successful download
5. Verify status changes to `Downloaded`

**Retry Exhaustion Flow**:
1. Create file with `retryCount: 5`, `maxRetries: 5`
2. Trigger retry
3. Verify status changes to `Failed`
4. Verify GitHub issue creation (mocked)

---

## Success Criteria

### User Experience
- [ ] 100% success rate for scheduled videos (eventually download when available)
- [ ] Zero manual intervention required for scheduled content
- [ ] iOS app shows "Scheduled for [date]" instead of "Failed"
- [ ] Zero support tickets for scheduled video "failures"

### Operational Excellence
- [ ] Zero GitHub issues for scheduled videos (noise eliminated)
- [ ] 100% actionable GitHub issues (only permanent failures)
- [ ] Average retry latency <= 1 hour after video becomes available
- [ ] Retry success rate >= 95%

### System Health
- [ ] CloudWatch metrics track scheduled video detection rate
- [ ] CloudWatch alarms alert on retry exhaustion
- [ ] Retry queue size monitored

---

## File Change Summary

### New Files
| File | Purpose |
|------|---------|
| `src/util/video-error-classifier.ts` | Error classification logic |
| `src/util/video-error-classifier.test.ts` | Unit tests |

### Modified Files
| File | Changes |
|------|---------|
| `src/types/enums.ts` | Add `Scheduled` to FileStatus |
| `src/types/youtube.ts` | Add scheduling fields to YtDlpVideoInfo |
| `src/entities/Files.ts` | Add retry metadata attributes |
| `src/lambdas/StartFileUpload/src/index.ts` | Integrate error classifier |
| `src/lambdas/StartFileUpload/test/index.test.ts` | Update tests |
| `src/lambdas/FileCoordinator/src/index.ts` | Query scheduled files |
| `src/lambdas/FileCoordinator/test/index.test.ts` | Update tests |
| `src/lib/vendor/YouTube.ts` | Add `fetchVideoInfoSafe()` |
| `terraform/file_coordinator.tf` | Enable schedule |

---

## Risk Mitigation

### Risk: yt-dlp doesn't return release_timestamp for some scheduled videos
**Mitigation**: Fall back to exponential backoff if `release_timestamp` unavailable. Use increasing delays: 15min -> 30min -> 1hr -> 2hr -> 4hr.

### Risk: Overwhelming YouTube with retries
**Mitigation**: Batch processing with delays, max 5 concurrent downloads, rate limiting in FileCoordinator.

### Risk: Retry queue grows unbounded
**Mitigation**: Max retries limit (default 5), CloudWatch alarm on queue size, retry exhaustion handling.

### Risk: DynamoDB hot partition for `status=Scheduled`
**Mitigation**: The existing GSI design handles this well. If needed, add a date-based partition suffix.

---

## Implementation Order

1. **Phase 1**: Error classifier (standalone, testable) - 4 hours
2. **Phase 2**: Schema updates (minimal risk) - 2 hours
3. **Phase 3**: StartFileUpload integration - 4 hours
4. **Phase 4**: FileCoordinator updates - 2 hours
5. **Phase 5**: Infrastructure & monitoring - 2 hours
6. **Phase 6**: Integration testing - 4 hours

**Total estimated effort**: 18 hours

---

## Appendix: Error Message Patterns

### Scheduled Video Patterns (from yt-dlp)
- "Video unavailable" + `release_timestamp` present
- "Premieres in X hours"
- "Scheduled for [date]"

### Permanent Failure Patterns
- "Video unavailable" (without release_timestamp)
- "This video is private"
- "This video has been removed"
- "This video is no longer available"
- "The uploader has not made this video available"
- "This video contains content from [X], who has blocked it"

### Transient Error Patterns
- "HTTP Error 429: Too Many Requests"
- "Connection reset by peer"
- "ECONNRESET"
- "ETIMEDOUT"
- "Network is unreachable"
