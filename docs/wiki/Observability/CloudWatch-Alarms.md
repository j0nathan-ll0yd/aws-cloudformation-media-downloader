# CloudWatch Alarm Thresholds

## Current Thresholds (Design-time estimates)

| Alarm | Threshold | Rationale |
|-------|-----------|-----------|
| LambdaErrorsApi | 5 | Allow brief error spikes during deployment |
| LambdaErrorsBackground | 3 | Background jobs less tolerant |
| LambdaThrottles | 0 | Zero tolerance - capacity issue |
| SqsDlqMessages | 0 | Any DLQ message needs investigation |
| SqsQueueAge | 3600 s | 1 hour max before alerting |
| YouTubeAuthBotDetection | 3 | 3 failures suggest cookie rotation needed |
| YouTubeAuthCookieExpired | 2 | Quick alert for expired cookies |
| YouTubeAuthRateLimited | 5 | Allow some rate limiting before alert |
| ApiGateway5xx | 1 | Any server error is concerning |

## Post-Deployment Validation

After production deployment, validate thresholds against actual error rates:

1. Run `aws cloudwatch get-metric-statistics` for 7-day baseline
2. Compare to threshold values
3. Adjust if false positive rate > 5%
4. Document changes in this file

## Alarm Configuration Location

All alarms are defined in `terraform/cloudwatch.tf` with the following structure:
- Metric namespace and name
- Comparison operator and threshold
- Evaluation period and datapoints
- SNS topic for notifications
