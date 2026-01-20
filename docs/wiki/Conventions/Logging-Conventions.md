# Logging Conventions

## Quick Reference
- **When to use**: All Lambda handlers, vendor wrappers, system libraries
- **Enforcement**: MCP validation rule `logging-conventions`
- **Impact if violated**: MEDIUM - Inconsistent observability

## Log Message Patterns

### 1. Function Entry/Exit (DEBUG)

Use arrow notation for function tracing:

```typescript
logDebug('functionName <=', inputData)   // Entry (arrow pointing in)
logDebug('functionName =>', outputData)  // Exit (arrow pointing out)
```

**Rules:**
- Use camelCase function names (not plain English)
- `<=` for entry, `=>` for exit
- Include relevant input/output data as second parameter

**Examples:**
```typescript
// Good
logDebug('getUserById <=', {userId})
logDebug('getUserById =>', user)

// Bad
logDebug('Getting user by ID', {userId})  // Plain English
logDebug('getUserById ==', user)          // Wrong separator
```

### 2. Business Events (INFO)

Use action phrases for significant events:

```typescript
logInfo('Sending notification to device', {deviceId, userId})
logInfo('Processing download request', {fileId, correlationId})
```

**Rules:**
- Start with present participle (verb + -ing) or present tense verb
- Describe WHAT is happening, not the function name
- Include structured context data

**Examples:**
```typescript
// Good
logInfo('Sending push notification', {deviceId, type: 'download_ready'})
logInfo('File upload completed', {fileId, size, duration})

// Bad
logInfo('sendNotification', {deviceId})  // Function name, not event description
logInfo('notification:send', {deviceId}) // Machine format, not readable
```

### 3. Request/Response Flow (INFO/DEBUG)

For API handler entry/exit:

```typescript
logInfo('request <=', getRequestSummary(event))  // INFO: Always log
logDebug('response =>', responseData)            // DEBUG: Detailed output
```

### 4. Error Logging (ERROR)

Use descriptive failure messages:

```typescript
logError('Failed to process message', {messageId, error: message})
logError('Database query failed', {query, error, duration})
```

### 5. Phase/Progress Logging (INFO)

For multi-step operations:

```typescript
logInfo('Phase 1: Downloading to temp file', {url})
logInfo('Phase 1 complete: Download finished', {size})
logInfo('Phase 2: Streaming to S3', {bucket, key})
logInfo('Phase 2 complete: S3 upload finished', {duration})
```

## Anti-Patterns

| Pattern | Problem | Fix |
|---------|---------|-----|
| `response ==` | Inconsistent with `<=`/`=>` | Use `response =>` |
| `func.nested.path <=` | Dotted paths confusing | Use `nestedPath <=` |
| `doThing`, `doOtherThing` | Plain verbs without context | Use `doThing <=` or action phrase |
| Mixed case in messages | Inconsistent | Use consistent casing |

## Fixture Markers

Fixture logging uses a special format for automated extraction:

```typescript
// These patterns are intentional and should NOT be changed
logger.info('fixture:incoming', {...})
logger.info('fixture:outgoing', {...})
```

These markers are used by the fixture extraction system and are excluded from the arrow notation convention.

## Related Documentation

- [CloudWatch Logging](../AWS/CloudWatch-Logging.md) - Infrastructure and queries
- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) - Handler middleware
