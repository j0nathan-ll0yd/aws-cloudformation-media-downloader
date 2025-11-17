## Video Download Failure

A video download operation failed and requires investigation.

**File Details**:
- **File ID**: ${fileId}
- **Video URL**: ${fileUrl}
- **Error Type**: ${error.constructor.name}
- **Error Message**: ${error.message}
- **Timestamp**: ${new Date().toISOString()}

---

${errorDetails ? `## Additional Details

\`\`\`
${errorDetails}
\`\`\`

---

` : ''}## Stack Trace

\`\`\`
${error.stack || 'No stack trace available'}
\`\`\`

---

## Debugging Steps

### 1. Check File Status in DynamoDB
\`\`\`bash
aws dynamodb get-item \\
  --table-name \${DYNAMODB_TABLE_FILES} \\
  --key '{"fileId":{"S":"${fileId}"}}' \\
  --region us-west-2
\`\`\`

### 2. Verify Video Accessibility
\`\`\`bash
# Test if yt-dlp can access the video
yt-dlp --simulate "${fileUrl}"
\`\`\`

### 3. Check Lambda Logs
\`\`\`bash
aws logs tail /aws/lambda/StartFileUpload \\
  --region us-west-2 \\
  --since 1h \\
  --filter-pattern "${fileId}"
\`\`\`

### 4. Inspect S3 Bucket
\`\`\`bash
aws s3 ls s3://\${BUCKET_NAME}/ --recursive | grep "${fileId}"
\`\`\`

---

## Common Failure Causes

| Error Pattern | Likely Cause | Solution |
|--------------|--------------|----------|
| **403 Forbidden** | Cookie expiration or bot detection | Refresh YouTube cookies |
| **404 Not Found** | Video deleted or made private | Remove from queue |
| **Network timeout** | Large file or slow connection | Retry or increase timeout |
| **Stream error** | HLS/DASH fragmentation issue | Check /tmp disk space |
| **S3 upload error** | Multipart upload failure | Check S3 permissions |

---

## Manual Recovery

If the video is still accessible, trigger a manual retry:

\`\`\`bash
aws lambda invoke \\
  --function-name FileCoordinator \\
  --region us-west-2 \\
  --payload '{"fileId":"${fileId}"}' \\
  /dev/null
\`\`\`

---

## Related Resources

- **Lambda Function**: StartFileUpload
- **S3 Bucket**: Media storage bucket
- **DynamoDB Table**: Files table (status: Failed)
- **CloudWatch Metrics**: VideoDownloadFailure

**Documentation**: See \`docs/YT-DLP-MIGRATION-STRATEGY.md\` for architecture details.

---

This issue was automatically created by the video download monitoring system.
