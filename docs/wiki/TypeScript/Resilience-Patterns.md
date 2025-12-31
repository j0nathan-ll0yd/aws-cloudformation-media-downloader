# Resilience Patterns

## Quick Reference
- **When to use**: Protecting against cascading failures from external services
- **Location**: `src/lib/system/circuit-breaker.ts`
- **Related**: [Lambda Function Patterns](Lambda-Function-Patterns.md)

## Overview

Resilience patterns prevent cascading failures when external services (YouTube, APNS) are degraded. The primary pattern is the circuit breaker.

---

## CircuitBreaker

**Use for**: Protecting calls to external services that may fail or become slow.

**File**: `src/lib/system/circuit-breaker.ts`

**Signature**:
```typescript
class CircuitBreaker {
  constructor(config?: Partial<CircuitBreakerConfig>)
  async execute<T>(operation: () => Promise<T>): Promise<T>
  getState(): CircuitState  // 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  reset(): void
}
```

**Example**:
```typescript
import {CircuitBreaker, CircuitBreakerOpenError} from '#lib/system/circuit-breaker'

// Create a circuit breaker for an external service
const apiBreaker = new CircuitBreaker({
  name: 'external-api',
  failureThreshold: 3,      // Open after 3 failures
  resetTimeout: 60000,      // Try again after 1 minute
  successThreshold: 2       // Close after 2 successes in HALF_OPEN
})

// Wrap external calls
try {
  const result = await apiBreaker.execute(() => fetchFromExternalApi(id))
} catch (error) {
  if (error instanceof CircuitBreakerOpenError) {
    // Circuit is open, fail fast
    console.log(`Retry after ${error.retryAfterMs}ms`)
  }
  throw error
}
```

**Notes**:
- State is per Lambda instance (not distributed)
- Cold starts reset the circuit to CLOSED
- Metrics are published to CloudWatch for monitoring

---

## youtubeCircuitBreaker

**Use for**: YouTube/yt-dlp operations (pre-configured).

**File**: `src/lib/system/circuit-breaker.ts`

```typescript
import {youtubeCircuitBreaker} from '#lib/system/circuit-breaker'

// Use the pre-configured YouTube circuit breaker
const videoInfo = await youtubeCircuitBreaker.execute(() => fetchVideoInfo(videoId))
```

**Configuration**:
- `failureThreshold`: 3 (open after 3 failures)
- `resetTimeout`: 5 minutes (longer due to YouTube rate limits)
- `successThreshold`: 2 (close after 2 successes)

---

## Circuit Breaker States

| State | Description | Behavior |
|-------|-------------|----------|
| `CLOSED` | Normal operation | Requests pass through |
| `OPEN` | Service is failing | Requests fail fast with `CircuitBreakerOpenError` |
| `HALF_OPEN` | Testing recovery | Limited requests pass through |

```
CLOSED --[failures >= threshold]--> OPEN
OPEN --[timeout elapsed]--> HALF_OPEN
HALF_OPEN --[success >= threshold]--> CLOSED
HALF_OPEN --[any failure]--> OPEN
```

---

## Related Patterns

- [Lambda Function Patterns](Lambda-Function-Patterns.md) - Handler patterns
- [TypeScript Error Handling](TypeScript-Error-Handling.md) - Error types

---

*Use circuit breakers for all external service calls to prevent cascading failures.*
