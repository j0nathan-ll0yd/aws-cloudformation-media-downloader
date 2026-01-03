# Better Auth Architecture

## Overview

This project uses [Better Auth](https://www.better-auth.com/) for authentication, integrated with ElectroDB and DynamoDB in a serverless Lambda architecture. This represents the first production ElectroDB adapter for Better Auth.

## Architecture Components

### Core Stack

```
iOS App → API Gateway → Lambda → Better Auth → ElectroDB Adapter → DynamoDB
                                                                    ↓
                                                            Single Table Design
```

### Key Technologies

- **Better Auth 1.4.3**: Modern TypeScript authentication framework
- **ElectroDB**: Type-safe DynamoDB ORM with single-table design
- **Apple Sign In**: OAuth provider using ID token flow
- **AWS Lambda**: Serverless compute for auth endpoints
- **DynamoDB**: NoSQL database with optimized GSIs

## Better Auth Integration

### Configuration

Better Auth is configured as a singleton in `src/lib/vendor/BetterAuth/config.ts`:

```typescript
import {betterAuth} from 'better-auth'
import {createElectroDBAdapter} from './electrodb-adapter'
import {fixtureLoggingHooks} from '../../better-auth/fixture-hooks'

export const auth = betterAuth({
  database: createElectroDBAdapter(),
  baseURL: process.env.APPLICATION_URL,
  socialProviders: {
    apple: {
      clientId: '<from config>',
      appBundleIdentifier: '<from config>',
      disableIdTokenSignin: false
    }
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24
  },
  hooks: fixtureLoggingHooks
})
```

### Key Features

1. **ID Token Authentication**: Direct ID token verification (eliminates 200-500ms token exchange)
2. **Session Management**: 30-day sessions with automatic refresh
3. **Mobile-First**: Token-based auth instead of cookies
4. **Fixture Logging**: Production debugging via CloudWatch
5. **Type Safety**: Full TypeScript support throughout stack

## Database Schema

### Entities

Better Auth uses four ElectroDB entities in the single-table design:

#### Users Entity

Stores user account data and identity provider information.

```typescript
{
  userId: string        // Primary key
  email: string         // Indexed via gsi3 (byEmail)
  emailVerified: boolean
  firstName: string
  lastName: string
  identityProviders: {  // OAuth provider data
    userId: string
    email: string
    emailVerified: boolean
    isPrivateEmail: boolean
    accessToken: string
    refreshToken: string
    tokenType: string
    expiresAt: number
  }
}
```

**Indexes**:
- Primary: `userId`
- byEmail (gsi3): `email` → Fast email lookups

#### Sessions Entity

Manages active user sessions with device tracking.

```typescript
{
  sessionId: string     // Primary key
  userId: string        // Indexed via gsi1 (byUser)
  deviceId: string      // Indexed via gsi2 (byDevice)
  expiresAt: number
  token: string         // Hashed session token
  ipAddress: string
  userAgent: string
  createdAt: number
  updatedAt: number
}
```

**Indexes**:
- Primary: `sessionId`
- byUser (gsi1): `userId` + `expiresAt` → All sessions for a user
- byDevice (gsi2): `deviceId` + `createdAt` → All sessions for a device

#### Accounts Entity

Links users to OAuth providers (Apple, Google, etc.).

```typescript
{
  accountId: string         // Primary key
  userId: string            // Indexed via gsi1 (byUser)
  providerId: string        // 'apple', 'google', etc.
  providerAccountId: string // User ID from provider
  accessToken: string
  refreshToken: string
  expiresAt: number
  scope: string
  tokenType: string
  idToken: string           // OIDC ID token
  createdAt: number
  updatedAt: number
}
```

**Indexes**:
- Primary: `accountId`
- byUser (gsi1): `userId` + `providerId` → All accounts for a user
- byProvider (gsi2): `providerId` + `providerAccountId` → Reverse lookup

#### VerificationTokens Entity

Temporary tokens for email verification flows.

```typescript
{
  token: string         // Primary key
  identifier: string    // Email or user ID
  expiresAt: number
}
```

**Indexes**:
- Primary: `token`
- byIdentifier (gsi1): `identifier` → Find tokens by email

### GSI Sharing Strategy

DynamoDB has 5 GSIs that are shared across all entities:

| GSI | ElectroDB Name | Primary Use | Also Used By |
|-----|---------------|-------------|--------------|
| gsi1 | UserCollection | Query by userId | Sessions, Accounts, VerificationTokens |
| gsi2 | FileCollection | Query by fileId | Sessions (by device), Accounts (by provider) |
| gsi3 | DeviceCollection | Query by deviceId | Users (by email) |
| gsi4 | StatusIndex | Query files by status | Files entity |
| gsi5 | KeyIndex | Query files by key | Files entity |

**Key Insight**: Multiple entities share GSIs by using different partition key prefixes (ElectroDB adds entity type prefixes automatically).

## Authentication Flows

### New User Registration

```
iOS App
  ↓ Sign in with Apple → ID Token
  ↓ POST /registerUser {idToken, firstName, lastName}
RegisterUser Lambda
  ↓ auth.api.signInSocial({idToken, provider: 'apple'})
Better Auth
  ↓ Verify ID token with Apple's JWKS
  ↓ Create user via ElectroDB adapter
ElectroDB Adapter
  ↓ transformUserFromAuth()
  ↓ Users.create()
DynamoDB
  ↓ Store user + account + session
  ← Return session token
iOS App
  ← Save token for authenticated requests
```

### Existing User Login

```
iOS App
  ↓ Sign in with Apple → ID Token
  ↓ POST /login {idToken}
LoginUser Lambda
  ↓ auth.api.signInSocial({idToken, provider: 'apple'})
Better Auth
  ↓ Verify ID token
  ↓ Lookup user by provider account ID
ElectroDB Adapter
  ↓ Accounts.query.byProvider()
  ↓ Create new session
DynamoDB
  ↓ Store session
  ← Return session token
iOS App
  ← Save token for authenticated requests
```

### Authenticated Request

```
iOS App
  ↓ GET /listFiles (Authorization: Bearer <token>)
API Gateway
  ↓ Invoke ApiGatewayAuthorizer Lambda
ApiGatewayAuthorizer
  ↓ auth.api.getSession({headers})
Better Auth
  ↓ Validate session token
ElectroDB Adapter
  ↓ Sessions.get({sessionId})
  ↓ Users.get({userId})
DynamoDB
  ← Return session + user
  ← Generate IAM policy (Allow/Deny)
API Gateway
  ↓ Forward request to ListFiles Lambda
  ← Return response
iOS App
  ← Receive data
```

## Lambda Integration

### Auth Lambdas

| Lambda | Endpoint | Better Auth API | Purpose |
|--------|----------|----------------|---------|
| RegisterUser | POST /registerUser | signInSocial() | Create new user account |
| LoginUser | POST /login | signInSocial() | Authenticate existing user |
| RefreshToken | POST /refreshToken | getSession() | Refresh expired session |
| ApiGatewayAuthorizer | ALL /* | getSession() | Validate session tokens |

### Environment Variables

Required environment variables for Better Auth:

- `APPLICATION_URL`: Base URL for OAuth callbacks (e.g., `https://api.example.com`)
- `SIGN_IN_WITH_APPLE_CONFIG`: JSON with `{client_id, bundle_id}`
- `DYNAMODB_TABLE_NAME`: Name of DynamoDB table

### Error Handling

Better Auth operations are wrapped in try-catch blocks:

```typescript
try {
  const result = await auth.api.signInSocial({...})
  return response(context, 200, result)
} catch (error) {
  logError('Better Auth operation failed', {error})
  return response(context, 401, {message: 'Authentication failed'})
}
```

## ElectroDB Adapter

### Design Pattern

The adapter implements bidirectional transformers between Better Auth and ElectroDB:

```typescript
// Better Auth → ElectroDB
transformUserFromAuth(authUser: User): ElectroUserCreate
transformSessionFromAuth(authSession: Session): ElectroSessionCreate

// ElectroDB → Better Auth
transformUserToAuth(electroUser: ElectroUserItem): User
transformSessionToAuth(electroSession: ElectroSessionItem): Session
```

### Adapter Methods

The adapter implements the Better Auth database interface:

**User Operations**:
- `createUser(data)`: Create new user account
- `getUser(userId)`: Fetch user by ID
- `getUserByEmail(email)`: Fetch user by email (uses gsi3)
- `updateUser(userId, data)`: Update user fields
- `deleteUser(userId)`: Remove user account

**Session Operations**:
- `createSession(data)`: Create new session
- `getSession(sessionId)`: Fetch session by ID
- `updateSession(sessionId, data)`: Update session
- `deleteSession(sessionId)`: Remove session

**Account Operations**:
- `createAccount(data)`: Link OAuth provider
- `getAccount(accountId)`: Fetch account by ID
- `linkAccount(userId, accountId)`: Associate account with user

**Verification Token Operations**:
- `createVerificationToken(data)`: Create email verification token
- `getVerificationToken(token)`: Fetch verification token
- `deleteVerificationToken(token)`: Remove used token

### Type Safety

All transformers maintain full type safety:

```typescript
type ElectroUserCreate = {
  userId: string
  email: string
  emailVerified: boolean
  firstName: string
  lastName: string
  identityProviders: IdentityProvidersData
}

function transformUserFromAuth(authUser: Partial<User>): ElectroUserCreate {
  const {firstName, lastName} = splitFullName(authUser.name)
  return {
    userId: authUser.id || uuidv4(),
    email: authUser.email!,
    emailVerified: authUser.emailVerified ?? false,
    firstName,
    lastName,
    identityProviders: {...}
  }
}
```

## Fixture Logging

### Hook Integration

Better Auth hooks enable production debugging:

```typescript
import {fixtureLoggingHooks} from '../../better-auth/fixture-hooks'

export const auth = betterAuth({
  // ... config ...
  hooks: fixtureLoggingHooks
})
```

### How It Works

1. **Before Hook**: Logs incoming requests with fixture markers
2. **After Hook**: Logs outgoing responses with fixture markers
3. **CloudWatch**: Stores logs with `__FIXTURE_MARKER__` tag
4. **Extraction**: `bin/extract-fixtures.sh` pulls fixtures from CloudWatch
5. **Processing**: `bin/process-fixtures.js` deduplicates and formats
6. **Testing**: Fixtures used in integration tests

### Fixture Naming

Better Auth fixtures follow PascalCase naming:

- `/auth/sign-in` → `BetterAuthSignIn`
- `/auth/sign-up` → `BetterAuthSignUp`
- `/auth/refresh-token` → `BetterAuthRefreshToken`

## Testing Strategy

### Unit Testing

Better Auth components are mocked using helpers:

```typescript
import {createBetterAuthMock} from '../../../test/helpers/better-auth-mock'

jest.mock('../../lib/vendor/BetterAuth/config', () => ({
  auth: createBetterAuthMock()
}))
```

ElectroDB entities are mocked consistently:

```typescript
import {createElectroDBEntityMock} from '../../../test/helpers/electrodb-mock'

jest.mock('../../entities/Users', () => ({
  Users: createElectroDBEntityMock()
}))
```

### Integration Testing

LocalStack tests validate full Better Auth flows:

1. Create user with Apple ID token
2. Create session
3. Validate session token
4. Query sessions by user
5. Delete session

See [Vitest Mocking Strategy](../Testing/Vitest-Mocking-Strategy.md) for detailed entity mocking examples.

## Performance Considerations

### Query Optimization

1. **Email Lookup**: Uses gsi3 index instead of table scan (10-100x faster)
2. **Session Queries**: Uses gsi1 to fetch all user sessions efficiently
3. **Provider Lookup**: Uses gsi2 to find accounts by provider ID

### Cold Start Optimization

Better Auth singleton is initialized once per Lambda container:

```typescript
// At top of Lambda handler
import {auth} from '../../lib/vendor/BetterAuth/config'

// Lambda stays warm, auth instance reused
export const handler = async (event, context) => {
  const result = await auth.api.getSession(...)
  return response(context, 200, result)
}
```

### Connection Pooling

ElectroDB shares a single DynamoDB DocumentClient across all entities, reducing connection overhead.

## Security Features

### ID Token Verification

Better Auth verifies Apple ID tokens using:

1. Fetches Apple's public JWKS
2. Validates token signature (RS256)
3. Checks token expiration
4. Validates audience claim (bundle ID)
5. Validates issuer claim (Apple)

### Session Token Security

- Tokens are hashed before storage
- Session expiration enforced server-side
- IP address and user agent logged for audit
- Session invalidation supported

### Environment Variable Safety

Per project conventions, required environment variables are accessed without fallbacks:

```typescript
// ✓ Correct - fails fast if missing
const config = JSON.parse(process.env.SIGN_IN_WITH_APPLE_CONFIG)

// ✗ Wrong - silent failures hide configuration errors
try {
  const config = JSON.parse(process.env.SIGN_IN_WITH_APPLE_CONFIG)
} catch {
  return fallbackConfig
}
```

## Migration from JWT

The project migrated from custom JWT authentication to Better Auth:

- **Before**: Manual JWT signing/verification with JOSE
- **After**: Better Auth session-based authentication
- **Benefits**:
  - Session management built-in
  - OAuth provider support
  - Type-safe database operations
  - Better mobile app experience
  - Reduced latency (ID token flow)

See `docs/wiki/iOS/Apple-Sign-In-ID-Token-Migration.md` for iOS migration details.

## Troubleshooting

### "Invalid ID token" Error

Check that iOS app is sending `identityToken` not `authorizationCode`:

```swift
// ✓ Correct
let idToken = String(data: credential.identityToken!, encoding: .utf8)

// ✗ Wrong
let code = String(data: credential.authorizationCode!, encoding: .utf8)
```

### Session Not Found

Verify session hasn't expired:

```typescript
const session = await auth.api.getSession({headers})
if (!session || session.expiresAt < Date.now()) {
  return response(context, 401, {message: 'Session expired'})
}
```

### Email Lookup Slow

Ensure email GSI is created:

```bash
aws dynamodb describe-table --table-name MediaDownloader \
  | jq '.Table.GlobalSecondaryIndexes[] | select(.IndexName == "DeviceCollection")'
```

## References

- [Better Auth Documentation](https://www.better-auth.com/docs)
- [ElectroDB Documentation](https://electrodb.dev/)
- [Apple Sign In Documentation](https://developer.apple.com/sign-in-with-apple/)
- [iOS ID Token Migration](../iOS/Apple-Sign-In-ID-Token-Migration.md)
- [ElectroDB Adapter Design](ElectroDB-Adapter-Design.md)
- [Vitest Mocking Strategy](../Testing/Vitest-Mocking-Strategy.md)
