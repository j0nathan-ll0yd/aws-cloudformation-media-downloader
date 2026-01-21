# Better Auth Architecture

## Overview

This project uses [Better Auth](https://www.better-auth.com/) for authentication, integrated with Drizzle ORM and Aurora DSQL in a serverless Lambda architecture.

## Architecture Components

### Core Stack

```
iOS App → API Gateway → Lambda → Better Auth → Drizzle Adapter → Aurora DSQL
                                                                    ↓
                                                            PostgreSQL Tables
```

### Key Technologies

- **Better Auth 1.4.3**: Modern TypeScript authentication framework
- **Drizzle ORM**: Type-safe SQL queries with PostgreSQL
- **Apple Sign In**: OAuth provider using ID token flow
- **AWS Lambda**: Serverless compute for auth endpoints
- **Aurora DSQL**: Serverless PostgreSQL-compatible database

## Better Auth Integration

### Configuration

Better Auth is configured as a singleton in `src/lib/vendor/BetterAuth/config.ts`:

```typescript
import {betterAuth} from 'better-auth'
import {drizzleAdapter} from 'better-auth/adapters/drizzle'
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import * as schema from '#lib/vendor/Drizzle/schema'

export async function getAuth(): Promise<ReturnType<typeof betterAuth>> {
  const db = await getDrizzleClient()

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verification
      }
    }),
    socialProviders: {
      apple: {
        clientId: '<from config>',
        appBundleIdentifier: '<from config>',
        enabled: true
      }
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24
    }
  })
}
```

### Database Schema

Better Auth uses four PostgreSQL tables (defined in `src/lib/vendor/Drizzle/schema.ts`):

| Table | Purpose |
|-------|---------|
| `users` | User accounts with email and profile data |
| `sessions` | Active authentication sessions |
| `accounts` | OAuth provider accounts (Apple, etc.) |
| `verification` | Email verification tokens |

### Session Flow

```
User Login
  ↓ Receive ID token from iOS
  ↓ Better Auth validates with Apple JWKS
  ↓ Create/find user in Aurora DSQL
  ↓ Create session token
  ↓ Return token to iOS app

Subsequent Requests
  ↓ iOS sends Bearer token
  ↓ API Gateway Authorizer validates
  ↓ Lambda receives userId from context
```

## Drizzle Adapter

Better Auth uses the official `better-auth/adapters/drizzle` adapter:

```typescript
import {drizzleAdapter} from 'better-auth/adapters/drizzle'

database: drizzleAdapter(db, {
  provider: 'pg',
  schema: {...}
})
```

The adapter handles:
- User creation and lookup
- Session management
- OAuth account linking
- Verification tokens

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `BETTER_AUTH_SECRET` | Secret for signing tokens |
| `APPLICATION_URL` | Base URL for OAuth callbacks |
| `SIGN_IN_WITH_APPLE_CONFIG` | Apple OAuth configuration |
| `DSQL_ENDPOINT` | Aurora DSQL connection endpoint |

## Testing

Entity queries are mocked in tests:

```typescript
vi.mock('#entities/queries', () => ({
  getUser: vi.fn(),
  createUser: vi.fn(),
  getSession: vi.fn()
}))
```

## Related Documentation

- [Entity Query Patterns](../TypeScript/Entity-Query-Patterns.md)
- [Vitest Mocking Strategy](../Testing/Vitest-Mocking-Strategy.md)
- [Vendor Encapsulation Policy](../Conventions/Vendor-Encapsulation-Policy.md)
