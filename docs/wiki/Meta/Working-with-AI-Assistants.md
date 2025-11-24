# Working with AI Assistants

## Quick Reference
- **When to use**: All interactions with AI coding assistants (Claude, Copilot, etc.)
- **Enforcement**: Recommended - improves AI collaboration effectiveness
- **Impact if violated**: LOW - Less effective AI assistance, more iterations needed

## Overview

AI coding assistants are most effective when given clear context, specific instructions, and incremental tasks. Follow patterns that help AI understand your codebase and produce high-quality, on-target code.

## The Rules

### 1. Provide Complete Context

Always include relevant code, error messages, and desired outcomes.

### 2. Be Specific About Constraints

State conventions, patterns, and restrictions explicitly.

### 3. Request Incremental Changes

Break large tasks into smaller, verifiable steps.

### 4. Review and Iterate

Check AI output, provide feedback, refine results.

## Effective Prompting Patterns

### ✅ Correct - Specific with Context

```
I need to add error handling to the ProcessFile Lambda function.

Context:
- File: src/lambdas/ProcessFile/src/index.ts
- This is an API Gateway Lambda (must return responses, not throw)
- We use the withXRay decorator for all handlers
- Error logging uses logError from util/lambda-helpers

Requirements:
- Wrap main logic in try/catch
- Log errors with file ID and trace ID
- Return 500 status with generic error message
- Follow existing error handling pattern (see DownloadVideo Lambda)

Example from DownloadVideo:
[paste existing code]
```

### ✅ Correct - Explicit Constraints

```
Create a new Lambda function called RegisterDevice.

Constraints:
- Use TypeScript with strict types
- Follow Lambda Function Patterns (docs/wiki/TypeScript/Lambda-Function-Patterns.md)
- Use vendor wrappers for AWS SDK (ZERO tolerance, see SDK-Encapsulation-Policy.md)
- Mock ALL transitive dependencies in tests (see Jest-ESM-Mocking-Strategy.md)
- Use PascalCase for function name (RegisterDevice)
- Include X-Ray tracing with withXRay decorator

Structure:
src/lambdas/RegisterDevice/
├── src/index.ts
└── test/index.test.ts

OpenTofu:
terraform/LambdaRegisterDevice.tf

Follow existing Lambda patterns (see ProcessFile, DownloadVideo).
```

### ✅ Correct - Incremental Task

```
Step 1: Create the Lambda handler structure (no business logic yet)
- Create files in src/lambdas/RegisterDevice/
- Set up basic handler with withXRay decorator
- Add input validation constraints
- Return 200 with placeholder response

We'll add the actual device registration logic in Step 2.
```

### ❌ Incorrect - Vague Request

```
Add error handling to my Lambda.
```

Problems:
- Which Lambda?
- What type of error handling?
- What are the requirements?
- What patterns to follow?

### ❌ Incorrect - No Constraints

```
Create a new Lambda function for processing files.
```

Problems:
- No naming convention guidance
- No architecture patterns specified
- No testing requirements
- No infrastructure guidance

### ❌ Incorrect - Too Large

```
Create the entire media download system including:
- All Lambda functions
- DynamoDB schema
- S3 bucket configuration
- API Gateway setup
- Testing infrastructure
- Documentation
- Deployment scripts
```

Problems:
- Too many components at once
- Hard to review
- Difficult to debug issues
- No incremental feedback

## Providing Context

### Share Relevant Code

```
I need to refactor the download logic in DownloadVideo Lambda.

Current implementation:
[paste src/lambdas/DownloadVideo/src/index.ts]

Related utilities:
[paste relevant util functions]

Issue:
Download times out for large videos (>500MB)

Goal:
Implement streaming download with progress tracking
```

### Share Error Messages

```
Tests are failing with this error:

```
TypeError: Cannot read property 'send' of undefined
  at headObject (lib/vendor/AWS/S3.ts:15:25)
  at handler (src/lambdas/GetFile/src/index.ts:20:18)
```

Test file:
[paste test code]

Handler:
[paste handler code]

I think it's a mocking issue but not sure what's missing.
```

### Share Convention Documents

```
Add type definitions for the new User entity.

Follow our type definition patterns:
[paste or link to Type-Definitions.md]

Existing entity types:
[paste Files.ts types for reference]
```

## Iterative Refinement

### Initial Request

```
Create a Lambda function to process video files from S3.
```

### AI Response Review

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

### AI Refinement

AI produces updated code addressing feedback.

### Final Verification

```
Perfect! The code now:
✅ Uses vendor wrappers
✅ Has X-Ray tracing
✅ Follows all our patterns

Let's proceed to Step 2: Add business logic.
```

## Common Scenarios

### Adding a New Feature

```
Task: Add retry logic to S3 uploads

Context:
- File: lib/vendor/AWS/S3.ts
- Current: createS3Upload() creates Upload instance
- Issue: Uploads fail on network issues with no retry

Requirements:
1. Add retry logic (max 3 attempts)
2. Use exponential backoff (1s, 2s, 4s)
3. Log retry attempts with logWarn
4. Throw on final failure

Pattern to follow:
[paste similar retry logic from elsewhere if exists]

Constraints:
- Don't change function signature
- Don't add new dependencies
- Keep lazy initialization pattern
```

### Fixing a Bug

```
Bug: ProcessFile Lambda returns 502 instead of 500 on errors

Current code:
[paste relevant handler code]

Expected behavior:
- Errors should return {statusCode: 500, body: {error: message}}
- NOT throw (causes 502)

Root cause:
I think we're missing a try/catch somewhere

Please:
1. Identify where error is being thrown
2. Add proper error handling
3. Ensure we follow API Gateway pattern (return response, never throw)
```

### Refactoring Code

```
Refactor: Extract S3 upload logic from DownloadVideo Lambda

Current code:
[paste DownloadVideo handler with upload logic inline]

Goal:
Move S3 upload to reusable function in util/storage.ts

Requirements:
- Create util/storage.ts with uploadFile(bucket, key, stream) function
- Use existing createS3Upload from vendor wrapper
- Add proper error handling and logging
- Update DownloadVideo to use new function
- Add tests for util/storage.ts

Keep it incremental - just the extraction first, no other changes.
```

### Writing Tests

```
Add tests for the new uploadFile function in util/storage.ts

Function code:
[paste function]

Test requirements:
- Mock ALL transitive dependencies (S3 vendor wrapper)
- Test successful upload
- Test upload failure
- Test retry logic
- Follow Jest ESM mocking pattern (see Testing wiki)

Use existing test files as reference:
[paste similar test file]
```

## AI-Specific Patterns

### For Claude

```
Use the Convention Capture System:
- Flag new patterns you notice
- Suggest documentation updates
- Point out inconsistencies with existing patterns

Reference: docs/CONVENTION-CAPTURE-GUIDE.md
```

### For GitHub Copilot

```
Context files:
- AGENTS.md - primary reference
- CLAUDE.md - references AGENTS.md  
- GEMINI.md - references AGENTS.md

All context in AGENTS.md - single source of truth
```

### For All AI Assistants

```
Before making changes:
1. Read applicable wiki guide (docs/wiki/)
2. Check existing similar code
3. Follow established patterns
4. Ask if unsure

Zero-tolerance rules:
- AWS SDK Encapsulation (NEVER import @aws-sdk/* directly)
- No AI attribution in commits
- Git as source of truth (no commented-out code explanations)
```

## Rationale

### Clear Context Benefits

1. **Accurate Output** - AI understands requirements
2. **Fewer Iterations** - Gets it right first time
3. **Pattern Consistency** - Follows existing conventions
4. **Reduced Errors** - Knows constraints and gotchas

### Incremental Tasks Benefits

1. **Easier Review** - Small changes easy to verify
2. **Faster Feedback** - Catch issues early
3. **Better Results** - Each step builds on verified foundation
4. **Less Rework** - Don't redo large changes

## Related Patterns

- [Convention Capture System](Convention-Capture-System.md) - Detecting emerging conventions
- [Documentation Patterns](Documentation-Patterns.md) - How documentation is organized
- [AI Tool Context Files](AI-Tool-Context-Files.md) - AGENTS.md structure

---

*Provide complete context, be specific about constraints, request incremental changes, and iterate based on review. AI assistants work best with clear, specific instructions and relevant examples.*
