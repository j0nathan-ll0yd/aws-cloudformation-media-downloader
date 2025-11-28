# Working with AI Assistants

## Quick Reference
- **When to use**: All interactions with AI coding assistants
- **Enforcement**: Recommended - improves collaboration effectiveness
- **Impact if violated**: LOW - Less effective AI assistance

## The Rules

1. **Provide Complete Context** - Include relevant code, errors, and desired outcomes
2. **Be Specific About Constraints** - State conventions, patterns, and restrictions explicitly
3. **Request Incremental Changes** - Break large tasks into smaller, verifiable steps
4. **Review and Iterate** - Check AI output, provide feedback, refine results

## Effective Prompting Patterns

### ✅ Correct - Specific with Context

```
Add error handling to the ProcessFile Lambda function.

Context:
- File: src/lambdas/ProcessFile/src/index.ts
- This is an API Gateway Lambda (must return responses, not throw)
- We use the withXRay decorator for all handlers
- Error logging uses logError from util/lambda-helpers

Requirements:
- Wrap main logic in try/catch
- Log errors with file ID and trace ID
- Return 500 status with generic error message
- Follow existing error handling pattern from DownloadVideo Lambda
```

### ✅ Correct - Explicit Constraints

```
Create a new Lambda function called RegisterDevice.

Constraints:
- Use TypeScript with strict types
- Follow Lambda Function Patterns wiki guide
- Use vendor wrappers for AWS SDK (ZERO tolerance)
- Mock ALL transitive dependencies in tests
- Use PascalCase for function name
- Include X-Ray tracing with withXRay decorator

Structure:
src/lambdas/RegisterDevice/
├── src/index.ts
└── test/index.test.ts

Follow existing Lambda patterns (see ProcessFile, DownloadVideo).
```

### ❌ Incorrect - Vague Request

```
Add error handling to my Lambda.
```

Problems: Which Lambda? What type of error handling? What patterns to follow?

### ❌ Incorrect - Too Large

```
Create the entire media download system including all Lambdas, DynamoDB schema,
S3 buckets, API Gateway, testing, documentation, and deployment scripts.
```

Problems: Too many components at once, hard to review, difficult to debug.

## Providing Context

### Share Relevant Code

```
I need to refactor the download logic in DownloadVideo Lambda.

Current implementation:
[paste src/lambdas/DownloadVideo/src/index.ts]

Related utilities:
[paste relevant util functions]

Issue: Download times out for large videos (>500MB)

Goal: Implement streaming download with progress tracking
```

### Share Error Messages

```
Tests are failing with this error:

```
TypeError: Cannot read property 'send' of undefined
  at headObject (lib/vendor/AWS/S3.ts:15:25)
```

Test file: [paste test code]
Handler: [paste handler code]

I think it's a mocking issue but not sure what's missing.
```

## Iterative Refinement

### Step 1: Initial Request

```
Create a Lambda function to process video files from S3.
```

### Step 2: AI Response Review

```
The AI created the function but:
1. ❌ Used direct AWS SDK import (violates SDK-Encapsulation-Policy)
2. ✅ Used correct error handling
3. ❌ Missing X-Ray tracing
4. ✅ Tests included

Feedback:
Please fix issues #1 and #3:
- Replace AWS SDK imports with vendor wrappers (see lib/vendor/AWS/S3.ts)
- Add withXRay decorator (see existing Lambdas for pattern)
```

### Step 3: Verification

```
Perfect! The code now:
✅ Uses vendor wrappers
✅ Has X-Ray tracing
✅ Follows all patterns

Let's proceed to Step 2: Add business logic.
```

## Common Scenarios

### Adding a New Feature

```
Task: Add retry logic to S3 uploads

Context: File lib/vendor/AWS/S3.ts
Current: createS3Upload() creates Upload instance
Issue: Uploads fail on network issues with no retry

Requirements:
1. Add retry logic (max 3 attempts)
2. Use exponential backoff (1s, 2s, 4s)
3. Log retry attempts with logWarn
4. Throw on final failure

Constraints:
- Don't change function signature
- Don't add new dependencies
- Keep lazy initialization pattern
```

### Fixing a Bug

```
Bug: ProcessFile Lambda returns 502 instead of 500 on errors

Current code: [paste handler]

Expected: Errors should return {statusCode: 500, body: {error: message}}
NOT throw (causes 502)

Please:
1. Identify where error is being thrown
2. Add proper error handling
3. Ensure we follow API Gateway pattern (return response, never throw)
```

## Zero-Tolerance Rules

Before making changes, always:
1. Read applicable wiki guide (docs/wiki/)
2. Check existing similar code
3. Follow established patterns
4. Ask if unsure

**Zero-tolerance violations**:
- AWS SDK Encapsulation (NEVER import @aws-sdk/* directly)
- No AI attribution in commits
- Git as source of truth (no commented-out code explanations)

## Related Patterns

- [Convention Capture System](Convention-Capture-System.md) - Detecting emerging conventions
- [AI Tool Context Files](AI-Tool-Context-Files.md) - AGENTS.md structure

---

*Provide complete context, be specific about constraints, request incremental changes, and iterate based on review. AI assistants work best with clear, specific instructions and relevant examples.*
