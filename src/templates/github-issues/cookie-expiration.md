## YouTube Cookie Expiration

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
pnpm run update-cookies
\`\`\`

This will:
1. Extract cookies from Chrome browser
2. Filter to YouTube/Google domains only
3. Copy filtered cookies to Lambda layer directory

### Step 2: Build and Deploy
\`\`\`bash
pnpm run build
pnpm run deploy
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

This issue was automatically created by the cookie monitoring system.
