# Conditional Functionality Implementation Plan

## Executive Summary

This plan outlines the implementation of conditional functionality across all external service dependencies in the AWS Media Downloader project. The goal is to allow the project to function without requiring full configuration of all external services, following the "convention over configuration" philosophy.

## Background

The project currently has multiple external dependencies that fail hard when not configured, preventing the application from running in minimal configurations. This plan addresses making these dependencies conditional, allowing graceful fallback when services are not configured.

## Scope

### In Scope
- Apple Push Notification Service (APNS) conditionality
- GitHub issue creation conditionality
- YouTube cookie validation
- Documentation of all conditional features

### Out of Scope
- Sign In With Apple (SIWA) conditionality - Deferred to separate issue pending alternative authentication implementation
- Core security features (platform encryption key) - Must remain required

## Current State Analysis

### Features Requiring Conditionality

| Feature | Current State | Impact When Missing |
|---------|--------------|-------------------|
| **PruneDevices Lambda** | Hard fails without APNS secrets | Daily scheduled job fails completely |
| **GitHub Issue Creation** | Always attempts, logs on failure | Error noise in CloudWatch logs |
| **YouTube Cookies** | No pre-validation | Downloads fail with 403 errors |

### Already Conditional Features
- **X-Ray Tracing** - Uses `ENABLE_XRAY` environment variable
- **CloudWatch Metrics** - Graceful error handling
- **APNS in RegisterDevice/UserSubscribe** - Uses `verifyPlatformConfiguration()`

## Implementation Details

### Step 1: Create Configuration Verification Helpers

**File**: `src/util/lambda-helpers.ts`

Add two new verification functions following the existing pattern:

```typescript
/**
 * Verifies GitHub configuration is available for issue creation
 * @returns true if GitHub token is configured
 */
export function verifyGithubConfiguration(): boolean {
  const githubToken = process.env.GithubPersonalToken
  if (!githubToken) {
    logInfo('GitHub issue creation disabled - no token configured')
    return false
  }
  return true
}

/**
 * Verifies YouTube cookie file is available for downloads
 * @returns true if cookie file exists
 */
export function verifyCookieConfiguration(): boolean {
  const cookiePath = '/opt/cookies/youtube-cookies.txt'
  if (!fs.existsSync(cookiePath)) {
    logInfo('YouTube cookie authentication disabled - no cookie file found')
    return false
  }
  return true
}
```

### Step 2: Update GitHub Issue Creation

**File**: `src/util/github-helpers.ts`

Modify all three issue creation functions:

1. `createFailedUserDeletionIssue()`
2. `createVideoDownloadFailureIssue()`
3. `createCookieExpirationIssue()`

Pattern for each function:
```typescript
export async function createVideoDownloadFailureIssue(...) {
  if (!verifyGithubConfiguration()) {
    logDebug('Skipping GitHub issue creation - not configured')
    return null
  }
  // ... existing implementation
}
```

### Step 3: Fix PruneDevices Lambda

**File**: `src/lambdas/PruneDevices/src/index.ts`

Add conditional check before APNS operations:

```typescript
export const handler = withXRay(async (event, context) => {
  // ... existing user/device fetching logic

  // Check APNS configuration before health checks
  if (!verifyPlatformConfiguration()) {
    logInfo('Skipping device health checks - APNS not configured')
    // Continue with pruning logic but skip notifications
  } else {
    // Existing health check notification code
    for (const device of devices) {
      await dispatchHealthCheckNotificationToDeviceToken(...)
    }
  }

  // ... rest of pruning logic
})
```

### Step 4: Add Cookie Pre-validation

**File**: `src/lib/vendor/YouTube.ts`

Add validation before attempting to copy cookies:

```typescript
async function setupCookies(): Promise<void> {
  const sourcePath = '/opt/cookies/youtube-cookies.txt'
  const destPath = '/tmp/youtube-cookies.txt'

  if (!fs.existsSync(sourcePath)) {
    throw new Error('YouTube authentication not configured - cookie file missing')
  }

  await fs.promises.copyFile(sourcePath, destPath)
}
```

### Step 5: Update Tests

Mock the new verification functions in affected test files:

**Files to update**:
- `src/lambdas/PruneDevices/test/index.test.ts`
- `src/lambdas/StartFileUpload/test/index.test.ts`
- `src/lambdas/UserDelete/test/index.test.ts`

Add mocks:
```typescript
jest.unstable_mockModule('./../../../util/lambda-helpers', () => ({
  ...existingMocks,
  verifyGithubConfiguration: jest.fn().mockReturnValue(true),
  verifyCookieConfiguration: jest.fn().mockReturnValue(true)
}))
```

### Step 6: Create Documentation

**File**: `docs/CONDITIONAL_FEATURES.md`

Document all conditional features, their requirements, and behavior when disabled.

## Testing Strategy

### Unit Tests
- Test with configuration present (existing behavior)
- Test with configuration absent (graceful fallback)
- Verify error messages are informative

### Integration Tests
1. **Minimal Configuration Test**
   - Only required secrets (platform key)
   - Verify core functionality works
   - Confirm optional features skip gracefully

2. **Feature Toggle Tests**
   - Enable/disable each feature individually
   - Verify no cascading failures

3. **Full Configuration Test**
   - All features enabled
   - Verify backwards compatibility

### Manual Testing Checklist
- [ ] Deploy with no GitHub token - verify lambdas continue
- [ ] Deploy with no APNS config - verify PruneDevices doesn't fail
- [ ] Deploy with no YouTube cookies - verify clear error message
- [ ] Deploy with full config - verify all features work

## Rollout Plan

### Phase 1: Non-Breaking Changes
1. Add verification helper functions
2. Update GitHub issue creation (already has error handling)
3. Deploy and monitor

### Phase 2: Breaking Change Fixes
1. Update PruneDevices Lambda
2. Add cookie validation
3. Comprehensive testing
4. Deploy with monitoring

### Phase 3: Documentation
1. Create CONDITIONAL_FEATURES.md
2. Update README with configuration options
3. Update deployment guides

## Success Criteria

1. **No Hard Failures**: Application runs with minimal configuration
2. **Clear Feedback**: Informative log messages when features disabled
3. **Backwards Compatible**: Existing deployments unaffected
4. **Improved Onboarding**: New users can start with minimal setup

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing deployments | Extensive testing, gradual rollout |
| Silent failures | Clear logging when features disabled |
| Configuration confusion | Comprehensive documentation |
| Missing critical errors | Ensure error logging still occurs via CloudWatch |

## Future Considerations

### Potential Enhancements
1. **Configuration Dashboard**: Lambda to check which features are enabled
2. **Dynamic Feature Flags**: Runtime enable/disable without redeploy
3. **Configuration Validation**: Startup checks for partial configurations
4. **Metrics on Feature Usage**: Track which optional features are commonly used

### Related Plans
- **Alternative Authentication Implementation** (see `docs/plans/implement-alternative-authentication.md`)
- **End-to-end Testing Strategy** (referenced in TODO.md)

## Conclusion

This implementation will significantly improve the developer experience by allowing the project to run with minimal configuration while maintaining full functionality for production deployments. The pattern established here can be extended to future external dependencies as the project grows.