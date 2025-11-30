# Event Replay Procedures

EventBridge Archive provides 90-day event retention for replay capability, enabling production debugging without data loss.

## Overview

| Property | Value |
|----------|-------|
| Event Bus | `MediaDownloaderEvents` |
| Archive Name | `MediaDownloaderEventsArchive` |
| Retention | 90 days |
| Region | us-west-2 |

## Event Types Archived

| Event Type | Source | Description |
|------------|--------|-------------|
| `FileWebhookReceived` | `media-downloader` | Feedly webhook processed |
| `FileDownloadInitiated` | `step-functions.file-coordinator` | Download started |
| `FileUploaded` | `media-downloader` | S3 upload completed |
| `NotificationQueued` | `media-downloader` | Push notification queued |
| `FileDownloadFailed` | `step-functions.file-coordinator` | Download error |
| `FileCoordinatorError` | `step-functions.file-coordinator` | Orchestration failure |

## Common Replay Scenarios

### 1. Replay Failed Downloads (Last 24 Hours)

Use when investigating why downloads failed:

```bash
aws events start-replay \
  --replay-name "failed-downloads-$(date +%Y%m%d)" \
  --event-source-arn arn:aws:events:us-west-2:ACCOUNT_ID:event-bus/MediaDownloaderEvents \
  --destination arn:aws:events:us-west-2:ACCOUNT_ID:event-bus/MediaDownloaderEvents \
  --event-start-time "$(date -u -v-24H +%Y-%m-%dT%H:%M:%SZ)" \
  --event-end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --event-pattern '{"detail-type":["FileDownloadFailed"]}'
```

### 2. Replay Specific File Events

Debug all events for a specific video:

```bash
aws events start-replay \
  --replay-name "file-ABC123-replay" \
  --event-source-arn arn:aws:events:us-west-2:ACCOUNT_ID:event-bus/MediaDownloaderEvents \
  --destination arn:aws:events:us-west-2:ACCOUNT_ID:event-bus/MediaDownloaderEvents \
  --event-start-time "2025-01-01T00:00:00Z" \
  --event-end-time "2025-01-02T00:00:00Z" \
  --event-pattern '{"detail":{"fileId":["ABC123"]}}'
```

### 3. Replay Webhook Events for Testing

Replay webhooks to test notification flow:

```bash
aws events start-replay \
  --replay-name "webhook-test-$(date +%Y%m%d%H%M%S)" \
  --event-source-arn arn:aws:events:us-west-2:ACCOUNT_ID:event-bus/MediaDownloaderEvents \
  --destination arn:aws:events:us-west-2:ACCOUNT_ID:event-bus/MediaDownloaderEvents \
  --event-start-time "$(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ)" \
  --event-end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --event-pattern '{"detail-type":["FileWebhookReceived"]}'
```

## Monitoring Replays

### Check Replay Status

```bash
aws events describe-replay --replay-name "replay-name"
```

### List Recent Replays

```bash
aws events list-replays --state COMPLETED --limit 10
aws events list-replays --state RUNNING --limit 5
aws events list-replays --state FAILED --limit 5
```

### Cancel Running Replay

```bash
aws events cancel-replay --replay-name "replay-name"
```

## Helper Script

A helper script is available at `scripts/replay-events.sh`:

```bash
# Replay FileDownloadFailed events from last 24 hours
./scripts/replay-events.sh FileDownloadFailed 24

# Replay FileWebhookReceived events from last 1 hour
./scripts/replay-events.sh FileWebhookReceived 1

# Replay all events from last 6 hours
./scripts/replay-events.sh "" 6
```

## Best Practices

### Do

- Use narrow time windows to minimize processing
- Filter by event type when possible
- Test replays in non-production first if available
- Monitor downstream effects during replay
- Document replay reason in the replay name

### Don't

- Replay entire archive without filters
- Replay to production without understanding downstream effects
- Ignore replay failures - investigate root cause
- Run multiple overlapping replays simultaneously

## Troubleshooting

### Replay Stuck in STARTING State

EventBridge archives can take up to 5 minutes to become queryable after events are published. Wait and retry.

### Replay Returns No Events

1. Verify time range is correct (use UTC)
2. Check event-pattern syntax
3. Confirm events were actually published during that time
4. Verify archive retention hasn't expired (90 days)

### Duplicate Processing After Replay

Replayed events are reprocessed by all targets. Ensure downstream Lambdas are idempotent or be prepared for duplicate side effects.

## Related Documentation

- [AWS EventBridge Archive Documentation](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-archive.html)
- [EventBridge Replay Documentation](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-replay-archived-event.html)
