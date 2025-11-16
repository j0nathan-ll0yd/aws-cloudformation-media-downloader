# PR Review Response Document

This document addresses each comment from PR #91 review and the actions taken in response.

## File Organization Comments

### 1. **LAMBDA_STYLE_GUIDE.md:1** - "Move this into `docs/styleGuides`"
**Action:** Will move LAMBDA_STYLE_GUIDE.md to docs/styleGuides/LAMBDA_STYLE_GUIDE.md
**Rationale:** Better organization of documentation in appropriate directory structure

### 2. **TEST_STYLE_GUIDE.md:1** - "Move this into `docs/styleGuides`"
**Action:** Will move TEST_STYLE_GUIDE.md to docs/styleGuides/TEST_STYLE_GUIDE.md
**Rationale:** Consistent with documentation organization

### 3. **response.json:1** - "Remove this file from the PR"
**Action:** Will remove response.json from the repository
**Rationale:** Temporary file that shouldn't be committed

### 4. **README.md:3** - "Don't update the project description"
**Action:** Will revert README.md changes
**Rationale:** Project description should remain stable

## AWS SDK Usage Pattern Comments

### 5. **src/lambdas/StartFileUpload/src/index.ts:10** - "We shouldn't be using the S3Client directly"
**Action:** Move S3Client usage to lib/vendor/AWS/S3.ts wrapper
**Pattern Update:** AWS SDK clients should NEVER be imported directly in Lambda functions
**Style Guide Update:** Add to LAMBDA_STYLE_GUIDE.md - all AWS operations must use vendor wrappers

### 6. **src/lambdas/StartFileUpload/src/index.ts:11** - "Same as above for CloudWatch"
**Action:** Already using putMetric wrapper from lib/vendor/AWS/CloudWatch
**Fix:** Remove StandardUnit import from Lambda, use wrapper
**Style Guide Update:** No AWS SDK imports in Lambda functions, only vendor wrappers

### 7. **src/lib/vendor/YouTube.ts:5** - "These methods should only be used in wrappers"
**Action:** YouTube.ts IS the wrapper, so AWS SDK usage here is correct
**No change needed:** Vendor libraries are the correct place for AWS SDK usage

### 8. **src/util/shared.ts:14** - "Create Lambda wrapper in src/lib/vendor/Lambda"
**Action:** Create new lib/vendor/AWS/Lambda.ts wrapper for Lambda client operations
**Pattern:** Move initiateFileDownload to use the new Lambda wrapper
**Style Guide Update:** Add pattern for Lambda invocation through vendor wrapper

## Type Safety Comments

### 9. **src/lambdas/FileCoordinator/test/index.test.ts:12** - "Wouldn't we know what the Promise returns?"
**Action:** Change from `jest.fn<() => Promise<unknown>>()` to `jest.fn<() => Promise<{StatusCode: number}>>()`
**Pattern:** Use specific types when known, not `unknown`
**Style Guide Update:** Add to TEST_STYLE_GUIDE.md - use specific mock types

### 10. **src/lambdas/StartFileUpload/test/index.test.ts:14** - "Don't we know what this returns?"
**Action:** Change fetchVideoInfoMock type to match actual return type
**Fix:** `jest.fn<() => Promise<VideoInfo>>()`

### 11. **src/lambdas/StartFileUpload/test/index.test.ts:15** - "Don't we know what this returns?"
**Action:** Change chooseVideoFormatMock type to match actual return type
**Fix:** `jest.fn<() => VideoFormat>()`

### 12. **src/lambdas/StartFileUpload/src/index.ts:20** - "Couldn't you omit Promise<any>?"
**Action:** Test if omitting the return type works with the Lambda runtime
**Alternative:** Use a specific return type interface if possible

### 13. **src/lib/vendor/YouTube.ts:26** - "Move interfaces to src/types directory"
**Action:** Move VideoInfo and VideoFormat interfaces to src/types/youtube.ts
**Pattern:** All shared types belong in the types directory
**Style Guide Update:** Add to LAMBDA_STYLE_GUIDE.md - interfaces in types directory

## Code Cleanup Comments

### 14. **src/util/shared.ts:8** - "Delete commented lines"
**Action:** Remove commented out Step Functions code
**Pattern:** No commented out code blocks
**Style Guide Update:** Add prohibition on commented code blocks

### 15. **src/util/shared.ts:155** - "Delete commented lines"
**Action:** Remove commented out Step Functions code
**Pattern:** Use version control, not comments

### 16. **src/util/transformers.ts:10** - "Delete commented lines"
**Action:** Remove commented out code
**Pattern:** Clean code only

### 17. **src/util/transformers.ts:129** - "Delete commented lines"
**Action:** Remove commented out code
**Pattern:** No legacy code in comments

## Test Improvements

### 18. **src/lib/vendor/YouTube.test.ts:60** - "Do we need to mock logDebug and logError?"
**Action:** Remove mocks for logging functions, let them run naturally
**Pattern:** Don't mock logging utilities
**Style Guide Update:** Add to TEST_STYLE_GUIDE.md - never mock logging functions

### 19. **src/lib/vendor/YouTube.test.ts:274** - "Move JSON to test fixture"
**Action:** Create fixtures/videoInfo.json and reuse across tests
**Pattern:** Large test data belongs in fixtures
**Style Guide Update:** Add fixture pattern for large test objects

## Template System Comment

### 20. **src/util/github-helpers.ts:54** - "Move Markdown to files with templating"
**Action:** Create templates directory with markdown templates
**Implementation:** Use simple string interpolation or mustache-like templating
**Pattern:** Separate presentation from logic

## Summary of Style Guide Updates Needed

### LAMBDA_STYLE_GUIDE.md Updates:
1. No AWS SDK imports - only vendor wrappers
2. All interfaces/types in src/types directory
3. No commented out code blocks
4. Vendor wrappers are the only place for AWS SDK usage

### TEST_STYLE_GUIDE.md Updates:
1. Use specific types for mocks, not `unknown`
2. Never mock logging functions
3. Large test data in fixtures, not inline
4. Mock return types should match actual function signatures

### New Patterns to Document:
1. Documentation goes in docs/ directory
2. Style guides in docs/styleGuides/
3. Templates for generated content
4. Vendor wrapper pattern for all AWS services