## User Deletion Failed

A user deletion operation failed and requires manual investigation.

**Triggered By**:
- **User ID**: ${userId}
- **Request ID**: ${requestId}
- **Error Type**: ${error.constructor.name}
- **Error Message**: ${error.message}
- **Timestamp**: ${new Date().toISOString()}

---

## Affected Devices

${devices.length > 0 ? `This user had **${devices.length}** registered device(s):

${devices.map((device, index) => `### Device ${index + 1}
- **Device Token**: \`${device.deviceToken}\`
- **Platform**: ${device.platform || 'Unknown'}
- **Last Updated**: ${device.updatedAt || 'Unknown'}
`).join('\n')}` : 'No devices were registered for this user.'}

---

## Required Action

1. **Investigate DynamoDB State**:
   \`\`\`bash
   aws dynamodb scan \\
     --table-name Users \\
     --filter-expression "userId = :userId" \\
     --expression-attribute-values '{":userId":{"S":"${userId}"}}' \\
     --region us-west-2
   \`\`\`

2. **Check S3 Bucket for User Files**:
   \`\`\`bash
   aws s3 ls s3://\${BUCKET_NAME}/${userId}/ --recursive
   \`\`\`

3. **Verify SNS Subscriptions**:
   \`\`\`bash
   aws sns list-subscriptions --region us-west-2 | grep ${userId}
   \`\`\`

4. **Manual Cleanup** (if needed):
   - Remove DynamoDB entries
   - Delete S3 objects
   - Unsubscribe SNS endpoints
   - Remove device registrations

---

## Stack Trace

\`\`\`
${error.stack || 'No stack trace available'}
\`\`\`

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
