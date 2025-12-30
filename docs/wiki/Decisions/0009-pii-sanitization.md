# ADR-0009: Automatic PII Sanitization

## Status
Accepted

## Date
2025-12-22

## Context

CloudWatch logs may inadvertently contain PII (Personally Identifiable Information):
- Request bodies with email addresses
- User names in error messages
- Tokens in debug output

Risks:
- GDPR/privacy compliance violations
- Credential exposure in logs
- Security audit failures

Previous approach required developers to manually sanitize each log call, which was error-prone and inconsistent.

## Decision

Implement defense-in-depth automatic PII sanitization in all logging functions.

### Architecture
```typescript
// All log functions automatically sanitize
logInfo('User action', userData)  // PII automatically redacted
logDebug('Request body', body)    // Sensitive fields masked
logError('Failed', error, context) // All data sanitized
```

### Sanitization Patterns
Case-insensitive redaction for:
- `email` → `[REDACTED]`
- `password` → `[REDACTED]`
- `token` → `[REDACTED]`
- `apiKey` / `api_key` → `[REDACTED]`
- `secret` → `[REDACTED]`
- `name` (first/last) → `[REDACTED]`
- `phone` → `[REDACTED]`
- `ssn` / `socialSecurity` → `[REDACTED]`

### Recursive Handling
Works on nested objects and arrays:
```typescript
sanitizeData({
  user: {
    email: 'user@example.com',  // → [REDACTED]
    profile: {
      firstName: 'John'         // → [REDACTED]
    }
  }
})
```

### Implementation
Single unified `sanitizeData()` utility called automatically by all logging functions:
- `logInfo()`, `logDebug()`, `logError()` - all use sanitization
- Zero configuration required for developers
- Cannot accidentally bypass

## Consequences

### Positive
- **Defense in depth**: PII cannot reach logs, even if developer forgets
- **Zero effort**: Works automatically with existing log calls
- **Consistent**: Same sanitization across all Lambda functions
- **Compliance**: Reduces GDPR/privacy risk

### Negative
- Slight performance overhead (recursive object traversal)
- May over-sanitize in some edge cases
- Debug information reduced in logs

## Enforcement

- Built into logging utilities - cannot bypass
- Code review: Verify new sensitive field patterns are added
- Security audit: Verify no PII reaches CloudWatch

## Related

- [PII Protection](../TypeScript/PII-Protection.md) - Implementation guide
- [CloudWatch Logging](../AWS/CloudWatch-Logging.md) - Logging patterns
