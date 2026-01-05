# PII Protection

## Quick Reference
- **When to use**: Any time you log structured data
- **Enforcement**: Automatic in all logging functions (`logInfo`, `logDebug`, `logError`)
- **Impact if violated**: High - PII leakage in CloudWatch logs

## The Rule

**Never log Personally Identifiable Information (PII) or credentials in plaintext.**

All logging functions (`logInfo`, `logDebug`, `logError`) automatically sanitize data through the `sanitizeData()` utility. Test fixture generation also uses this same utility for consistent PII protection.

## Architecture

### Unified Security Utility

```typescript
// src/util/security.ts
export function sanitizeData(data: unknown): unknown
```

This centralized function:
- Recursively processes objects and arrays
- Redacts sensitive fields using case-insensitive pattern matching
- Returns sanitized copy (original data unchanged)

### Integration Points

1. **Runtime Debug Logging** (`src/lib/system/logging.ts`)
   ```typescript
   export function logDebug(message: string, data?: string | object): void {
     // Automatically sanitizes objects
     logger.debug(message, {data: sanitizeData(data)})
   }
   ```

2. **Test Fixture Generation** (`src/lib/lambda/middleware/api.ts`)
   ```typescript
   export function logIncomingFixture(event: unknown): void {
     console.log(JSON.stringify({
       __FIXTURE_MARKER__: 'INCOMING',
       data: sanitizeData(event)
     }))
   }
   ```

## Protected Patterns

The following fields are **automatically redacted** (case-insensitive):

| Pattern | Examples |
|---------|----------|
| `authorization` | Authorization, AUTHORIZATION |
| `token` | token, Token, accessToken, refreshToken |
| `password` | password, Password |
| `apiKey` | apiKey, ApiKey, API_KEY |
| `secret` | secret, Secret, privateKey |
| `email` | email, Email, userEmail |
| `phoneNumber` | phoneNumber, phone |
| `ssn` | ssn, SSN |
| `creditCard` | creditCard, CreditCard |
| `certificate` | certificate, Certificate |
| `deviceToken` | deviceToken, appleDeviceIdentifier |
| `name` | name, Name, firstName, lastName |

## Examples

### ✅ Automatic Protection (All Logging Functions)

```typescript
import {logInfo, logDebug, logError} from '#lib/system/logging'

// PII is automatically sanitized in ALL logging functions
logInfo('User data', {
  userId: 'user-123',           // ✓ Safe (not PII)
  email: 'user@example.com',    // ✓ Redacted automatically
  token: 'secret-token-123',    // ✓ Redacted automatically
  name: 'John Doe'              // ✓ Redacted automatically
})

// Output in CloudWatch:
// {
//   "userId": "user-123",
//   "email": "[REDACTED]",
//   "token": "[REDACTED]",
//   "name": "[REDACTED]"
// }
```

### ✅ Manual Sanitization

```typescript
import {sanitizeData} from '#util/security'

// Use sanitizeData() directly when needed
const userData = {
  email: 'user@example.com',
  password: 'secret123'
}

const safe = sanitizeData(userData)
// safe = { email: '[REDACTED]', password: '[REDACTED]' }
```

### ✅ All Logging Functions Sanitize

```typescript
// All logging functions now automatically sanitize PII
logInfo('User data', {
  email: 'user@example.com',    // ✓ Redacted
  password: 'secret123'         // ✓ Redacted
})

logDebug('Debug data', {
  email: 'user@example.com',    // ✓ Redacted
  token: 'secret-token'         // ✓ Redacted
})

logError('Error context', {
  email: 'user@example.com',    // ✓ Redacted
  apiKey: 'secret-key'          // ✓ Redacted
})
```

## Nested Data Handling

Sanitization works recursively:

```typescript
logDebug('Complex structure', {
  user: {
    name: 'John Doe',
    email: 'john@example.com',  // ✓ Redacted
    settings: {
      token: 'secret-token'     // ✓ Redacted (nested)
    }
  },
  items: [
    {id: '1', password: 'pass1'}, // ✓ Redacted (in array)
    {id: '2', password: 'pass2'}  // ✓ Redacted (in array)
  ]
})
```

## LOG_LEVEL Configuration

| Environment | LOG_LEVEL | Debug Logs | Risk |
|-------------|-----------|------------|------|
| Production | `INFO` | Disabled | Low (no debug logs) |
| Staging | `DEBUG` | Enabled | **Protected** (sanitized) |
| Local Dev | `DEBUG` | Enabled | **Protected** (sanitized) |

**Critical**: Even with `LOG_LEVEL=DEBUG`, PII is now automatically sanitized.

## Testing

All PII patterns are tested in `src/util/test/security.test.ts`:

```typescript
describe('sanitizeData', () => {
  it('should redact all PII patterns', () => {
    const data = {
      email: 'user@example.com',
      password: 'secret',
      token: 'abc123'
    }
    
    const result = sanitizeData(data)
    
    expect(result.email).toBe('[REDACTED]')
    expect(result.password).toBe('[REDACTED]')
    expect(result.token).toBe('[REDACTED]')
  })
})
```

## Adding New Patterns

To protect additional fields, update `src/util/security.ts`:

```typescript
const sensitivePatterns = [
  /^authorization$/i,
  /^token$/i,
  /^newSensitiveField$/i  // Add new pattern here
]
```

Then add test coverage in `src/util/test/security.test.ts`.

## Related Patterns

- [Lambda Function Patterns](Lambda-Function-Patterns.md) - Using logDebug in handlers
- [Fixture Extraction](../Testing/Fixture-Extraction.md) - How fixtures use sanitizeData
- [AWS Lambda Environment Variables](../AWS/Lambda-Environment-Variables.md) - LOG_LEVEL configuration

## Migration Notes

### Before (Vulnerable)

```typescript
// ❌ PII leaked in logs
logInfo('event <=', event)   // Authorization headers exposed!
logDebug('Drizzle query', {model, data})  // emails, names exposed!
```

### After (Protected)

```typescript
// ✅ PII automatically redacted in ALL logging functions
logInfo('event <=', event)   // Authorization: [REDACTED]
logDebug('Drizzle query', {model, data})  // email, name: [REDACTED]
```

## Security Considerations

1. **LOG_LEVEL in Production**: Keep at `INFO` to disable debug logs entirely
2. **CloudWatch Retention**: Configure appropriate retention policies for logs
3. **IAM Permissions**: Restrict CloudWatch Logs access using least privilege
4. **Audit Trail**: Use CloudTrail to monitor who accesses CloudWatch Logs

## Performance Impact

- **Negligible**: Sanitization only runs when `LOG_LEVEL=DEBUG`
- **Production**: No overhead when debug logging is disabled
- **Testing**: Adds ~1-2ms per sanitization call

---

*Remember: Defense in depth. Even though sanitization is automatic, prefer logging only the minimum data necessary for debugging.*
