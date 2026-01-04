## User Deletion Failed

A user deletion operation failed and requires manual investigation.

**Triggered By**:
- **User ID**: ${userId}
- **Request ID**: ${requestId}
- **Error Type**: ${errorName}
- **Error Message**: ${errorMessage}
- **Timestamp**: ${timestamp}

---

## Affected Devices

**Device Count**: ${deviceCount}

```json
${devicesJson}
```

---

## Required Action

1. **Investigate DynamoDB State**:
   ```bash
   aws dynamodb scan \
     --table-name Users \
     --filter-expression "userId = :userId" \
     --expression-attribute-values '{":userId":{"S":"${userId}"}}' \
     --region us-west-2
   ```

2. **Check S3 Bucket for User Files**:
   ```bash
   aws s3 ls s3://\${BUCKET_NAME}/${userId}/ --recursive
   ```

3. **Verify SNS Subscriptions**:
   ```bash
   aws sns list-subscriptions --region us-west-2 | grep ${userId}
   ```

4. **Manual Cleanup** (if needed):
   - Remove DynamoDB entries
   - Delete S3 objects
   - Unsubscribe SNS endpoints
   - Remove device registrations

---

## Stack Trace

```
${errorStack}
```

---

## Context

**Request ID**: ${requestId}

This deletion was likely triggered by:
- User account closure request
- Data retention policy
- Manual cleanup operation

**Lambda Function**: DeleteUser
**DynamoDB Table**: Users, Devices
**S3 Bucket**: User-specific media files

---

This issue was automatically created by the user management system. Deletion failures typically indicate:
- Concurrent modification conflicts
- Permission issues
- Orphaned resources
- DynamoDB conditional check failures

---

## Deduplication

**Fingerprint**: `${fingerprint}`
**Components**: ${fingerprintSummary}

> This fingerprint is used to prevent duplicate issues. If this error recurs,
> a comment will be added to this issue instead of creating a new one.
