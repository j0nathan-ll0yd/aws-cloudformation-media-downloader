# Scheduled Video Handling

This document describes the self-healing workflow for handling scheduled and temporarily unavailable videos.

## Overview

YouTube videos can be scheduled for future release, making them temporarily unavailable. Rather than marking these as permanent failures, the system now:

1. Detects temporal unavailability (scheduled videos, upcoming livestreams)
2. Classifies errors as retryable or permanent
3. Schedules automatic retries at the appropriate time
4. Eliminates false-positive GitHub issues for expected delays

## Architecture

### Error Classification

The `video-error-classifier.ts` utility categorizes download errors into:

- **scheduled**: Video has a future `release_timestamp` 
- **livestream_upcoming**: Livestream not yet started
- **transient**: Network errors, temporary issues
- **permanent**: Geo-blocks, deleted videos, privacy restrictions

### Retry Strategy

| Error Type | Retry Timing | Max Retries | GitHub Issue |
|-----------|--------------|-------------|--------------|
| Scheduled video | release_timestamp + 5 min | 5 | No |
| Upcoming livestream | release_timestamp or exponential backoff | 5 | No |
| Transient network | Exponential backoff (5min → 1hr) | 5 | No |
| Max retries exceeded | N/A | N/A | Yes |
| Permanent failure | N/A | N/A | Yes |

### Database Schema

Files entity includes retry metadata:

```typescript
{
  status: 'Scheduled' | 'PendingDownload' | 'Downloaded' | 'Failed',
  retryAfter: number,        // Unix timestamp for next retry
  retryCount: number,        // Current attempt counter
  maxRetries: number,        // Retry limit (default: 5)
  lastError: string,         // Human-readable error reason
  scheduledPublishTime: number  // Original release_timestamp
}
```

### Lambda Changes

**StartFileUpload**: Enhanced error handling
- Attempts metadata extraction on failure
- Classifies error using video info
- Updates DynamoDB with retry schedule or permanent failure
- Only creates GitHub issues for permanent failures

**FileCoordinator**: Queries both file types
- Fetches PendingDownload files (ready to download)
- Fetches Scheduled files (retryAfter <= now)
- Invokes StartFileUpload for all eligible files

## User Experience

### Before
1. Scheduled video URL arrives from Feedly
2. Download attempt fails → Status: "Failed"
3. GitHub issue created (noise)
4. User sees "Failed" forever
5. Video never downloaded

### After
1. Scheduled video URL arrives from Feedly
2. Download attempt detects scheduling
3. Status: "Scheduled" with retryAfter timestamp
4. No GitHub issue (expected delay)
5. FileCoordinator automatically retries after release time
6. Download succeeds → Status: "Downloaded"
7. User gets push notification

## Monitoring

CloudWatch metrics track retry behavior:

- `VideoScheduledForRetry`: Retryable errors detected
- `MaxRetriesExceeded`: Files that failed after max retries
- `LambdaExecutionFailure`: All failures (with ErrorType dimension)

## Implementation Notes

### GSI Query Strategy

The StatusIndex GSI sorts by `availableAt`, not `retryAfter`. For Scheduled files:
- Query retrieves all Scheduled files via GSI
- Filter expression applies `retryAfter <= now` check
- This is efficient for moderate volumes (< 1000 scheduled files)

### Cookie Expiration Handling

Cookie expiration errors bypass the retry logic:
- Treated as permanent failures (require manual intervention)
- GitHub issue created immediately
- Separate metric: `CookieAuthenticationFailure`

### Metadata Extraction

When download fails, StartFileUpload attempts to fetch video metadata:
- Uses `--skip-download` flag (metadata only)
- Provides `release_timestamp` for scheduling
- Gracefully handles metadata fetch failures

## Testing

### Unit Tests
- `video-error-classifier.test.ts`: Error classification logic
- `StartFileUpload/test/index.test.ts`: Retry scheduling
- `FileCoordinator/test/index.test.ts`: Scheduled file queries

### Integration Testing
Test with real scheduled videos:
1. Create scheduled video on test YouTube channel
2. Trigger Feedly webhook
3. Verify Status: "Scheduled" in DynamoDB
4. Wait for retryAfter timestamp
5. Verify FileCoordinator triggers retry
6. Verify download succeeds

## Future Enhancements

Potential improvements:
- Premiere video detection (similar to livestreams)
- Private → Public transitions (exponential backoff)
- Geo-restriction changes (VPN rotation)
- Cookie refresh automation (detect + update)
