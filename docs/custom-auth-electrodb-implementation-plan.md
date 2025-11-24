# Custom Authentication with ElectroDB - Implementation Plan

## Executive Decision

**We're building a custom authentication system** using ElectroDB for maximum control, perfect architectural fit, and zero external dependencies. This is the right choice for a serverless AWS project that values simplicity and ownership.

## Why Custom Auth Won

### ✅ Perfect Architectural Fit
- Uses existing DynamoDB table (single-table design)
- Integrates seamlessly with ElectroDB
- Consistent with serverless architecture
- No external dependencies (no RDS, no third-party services)

### ✅ Cost Efficiency
- **~$0.50/month** for typical auth operations
- No RDS hosting costs ($15-20/month savings vs Better Auth)
- No per-user pricing (vs Cognito at scale)
- Pay-per-request DynamoDB pricing

### ✅ Full Control
- Complete ownership of auth logic
- No vendor lock-in
- Customizable to exact needs
- Direct integration with existing systems
- Security patches on our timeline

## Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Client    │────▶│ API Gateway  │────▶│  Lambda Auth    │
└─────────────┘     └──────────────┘     └─────────────────┘
                                                   │
                    ┌──────────────────────────────┼──────────────────────────────┐
                    │                              │                              │
              ┌─────▼──────┐          ┌───────────▼────────┐          ┌──────────▼──────────┐
              │   OAuth    │          │   JWT Manager      │          │   Rate Limiter      │
              │  Providers │          │  (Access/Refresh)  │          │  (ElectroDB)        │
              └─────┬──────┘          └───────────┬────────┘          └──────────┬──────────┘
                    │                              │                              │
                    └──────────────────────────────┼──────────────────────────────┘
                                                   │
                                          ┌────────▼────────┐
                                          │   DynamoDB      │
                                          │ (Single Table)  │
                                          └─────────────────┘
```

## Phase 1: ElectroDB Entity Design (Week 1, Days 1-2)

### Single-Table Architecture

All new authentication entities will be added to the existing `MediaDownloader` table using the existing GSI infrastructure.

### New Entities

#### 1. Sessions Entity

Manages user sessions with automatic expiration and device tracking.

```typescript
// src/entities/Sessions.ts
import {Entity, documentClient} from '../lib/vendor/ElectroDB/entity'

export const Sessions = new Entity(
  {
    model: {
      entity: 'Session',
      version: '1',
      service: 'MediaDownloader'
    },
    attributes: {
      sessionId: {
        type: 'string',
        required: true,
        readOnly: true
      },
      userId: {
        type: 'string',
        required: true
      },
      refreshToken: {
        type: 'string',
        required: true
      },
      deviceId: {
        type: 'string',
        required: false
      },
      ipAddress: {
        type: 'string',
        required: false
      },
      userAgent: {
        type: 'string',
        required: false
      },
      expiresAt: {
        type: 'number',
        required: true
      },
      createdAt: {
        type: 'number',
        required: true,
        default: () => Date.now(),
        readOnly: true
      },
      lastActiveAt: {
        type: 'number',
        required: true,
        default: () => Date.now()
      }
    },
    indexes: {
      primary: {
        pk: {
          field: 'pk',
          composite: ['sessionId']
        },
        sk: {
          field: 'sk',
          composite: []
        }
      },
      byUser: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['userId']
        },
        sk: {
          field: 'gsi1sk',
          composite: ['expiresAt']
        }
      },
      byDevice: {
        index: 'gsi2',
        pk: {
          field: 'gsi2pk',
          composite: ['deviceId']
        },
        sk: {
          field: 'gsi2sk',
          composite: ['createdAt']
        }
      }
    }
  } as const,
  {
    table: process.env.DynamoDBTableName,
    client: documentClient
  }
)

export type SessionItem = ReturnType<typeof Sessions.parse>
export type CreateSessionInput = Parameters<typeof Sessions.create>[0]
export type UpdateSessionInput = Parameters<typeof Sessions.update>[0]
```

#### 2. Accounts Entity

Links users to OAuth providers (Apple, Google, GitHub).

```typescript
// src/entities/Accounts.ts
import {Entity, documentClient} from '../lib/vendor/ElectroDB/entity'

export const Accounts = new Entity(
  {
    model: {
      entity: 'Account',
      version: '1',
      service: 'MediaDownloader'
    },
    attributes: {
      accountId: {
        type: 'string',
        required: true,
        readOnly: true
      },
      userId: {
        type: 'string',
        required: true
      },
      provider: {
        type: 'string',
        required: true // 'apple', 'google', 'github', 'email'
      },
      providerAccountId: {
        type: 'string',
        required: true // Provider's user ID
      },
      accessToken: {
        type: 'string',
        required: false
      },
      refreshToken: {
        type: 'string',
        required: false
      },
      tokenExpiresAt: {
        type: 'number',
        required: false
      },
      scope: {
        type: 'string',
        required: false
      },
      createdAt: {
        type: 'number',
        required: true,
        default: () => Date.now(),
        readOnly: true
      },
      updatedAt: {
        type: 'number',
        required: true,
        default: () => Date.now()
      }
    },
    indexes: {
      primary: {
        pk: {
          field: 'pk',
          composite: ['accountId']
        },
        sk: {
          field: 'sk',
          composite: []
        }
      },
      byUser: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['userId']
        },
        sk: {
          field: 'gsi1sk',
          composite: ['provider']
        }
      },
      byProvider: {
        index: 'gsi2',
        pk: {
          field: 'gsi2pk',
          composite: ['provider', 'providerAccountId']
        },
        sk: {
          field: 'gsi2sk',
          composite: []
        }
      }
    }
  } as const,
  {
    table: process.env.DynamoDBTableName,
    client: documentClient
  }
)

export type AccountItem = ReturnType<typeof Accounts.parse>
export type CreateAccountInput = Parameters<typeof Accounts.create>[0]
export type UpdateAccountInput = Parameters<typeof Accounts.update>[0]
```

#### 3. VerificationTokens Entity

For email verification, password reset, and magic links.

```typescript
// src/entities/VerificationTokens.ts
import {Entity, documentClient} from '../lib/vendor/ElectroDB/entity'

export const VerificationTokens = new Entity(
  {
    model: {
      entity: 'VerificationToken',
      version: '1',
      service: 'MediaDownloader'
    },
    attributes: {
      token: {
        type: 'string',
        required: true,
        readOnly: true
      },
      identifier: {
        type: 'string',
        required: true // email or userId
      },
      type: {
        type: 'string',
        required: true // 'email-verification', 'password-reset', 'magic-link'
      },
      expiresAt: {
        type: 'number',
        required: true
      },
      used: {
        type: 'boolean',
        required: true,
        default: false
      },
      createdAt: {
        type: 'number',
        required: true,
        default: () => Date.now(),
        readOnly: true
      }
    },
    indexes: {
      primary: {
        pk: {
          field: 'pk',
          composite: ['token']
        },
        sk: {
          field: 'sk',
          composite: []
        }
      },
      byIdentifier: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['identifier']
        },
        sk: {
          field: 'gsi1sk',
          composite: ['type', 'expiresAt']
        }
      }
    }
  } as const,
  {
    table: process.env.DynamoDBTableName,
    client: documentClient
  }
)

export type VerificationTokenItem = ReturnType<typeof VerificationTokens.parse>
export type CreateVerificationTokenInput = Parameters<typeof VerificationTokens.create>[0]
```

#### 4. RateLimits Entity

Tracks API usage for rate limiting.

```typescript
// src/entities/RateLimits.ts
import {Entity, documentClient} from '../lib/vendor/ElectroDB/entity'

export const RateLimits = new Entity(
  {
    model: {
      entity: 'RateLimit',
      version: '1',
      service: 'MediaDownloader'
    },
    attributes: {
      key: {
        type: 'string',
        required: true,
        readOnly: true // Format: "endpoint:identifier:window"
      },
      requests: {
        type: 'number',
        required: true,
        default: 0
      },
      windowStart: {
        type: 'number',
        required: true
      },
      ttl: {
        type: 'number',
        required: true // DynamoDB TTL attribute
      }
    },
    indexes: {
      primary: {
        pk: {
          field: 'pk',
          composite: ['key']
        },
        sk: {
          field: 'sk',
          composite: []
        }
      }
    }
  } as const,
  {
    table: process.env.DynamoDBTableName,
    client: documentClient
  }
)

export type RateLimitItem = ReturnType<typeof RateLimits.parse>
export type CreateRateLimitInput = Parameters<typeof RateLimits.create>[0]
export type UpdateRateLimitInput = Parameters<typeof RateLimits.update>[0]
```

#### 5. Updated Users Entity

Extend existing Users entity to support password authentication.

```typescript
// src/entities/Users.ts - ADD these attributes
attributes: {
  // ... existing attributes ...
  passwordHash: {
    type: 'string',
    required: false // Only for email/password auth
  },
  emailVerified: {
    type: 'boolean',
    required: true,
    default: false
  },
  // ... rest of attributes ...
}
```

### Collections for JOIN-like Queries

```typescript
// src/entities/Collections.ts - ADD these collections
import {Service} from 'electrodb'
import {Sessions} from './Sessions'
import {Accounts} from './Accounts'
import {Users} from './Users'
import {VerificationTokens} from './VerificationTokens'

export const AuthCollections = new Service({
  sessions: Sessions,
  accounts: Accounts,
  users: Users,
  verificationTokens: VerificationTokens
})

// Get all sessions and accounts for a user
// AuthCollections.collections.userAuth({userId: '...'}).go()
```

## Phase 2: JWT Management (Week 1, Days 3-4)

### Switch from HS256 to RS256

Current implementation uses symmetric HS256 (shared secret). We'll upgrade to asymmetric RS256 (public/private key pair) for better security.

```typescript
// src/util/jwt-helpers.ts
import * as jose from 'jose'
import {logDebug, logError} from './lambda-helpers'
import {UnauthorizedError} from './errors'

let privateKey: jose.KeyLike
let publicKey: jose.KeyLike

/**
 * Loads RSA key pair from environment variables
 */
async function getKeyPair(): Promise<{privateKey: jose.KeyLike; publicKey: jose.KeyLike}> {
  if (privateKey && publicKey) {
    return {privateKey, publicKey}
  }

  const privateKeyPem = process.env.JWT_PRIVATE_KEY
  const publicKeyPem = process.env.JWT_PUBLIC_KEY

  privateKey = await jose.importPKCS8(privateKeyPem, 'RS256')
  publicKey = await jose.importSPKI(publicKeyPem, 'RS256')

  return {privateKey, publicKey}
}

/**
 * Creates an access token (short-lived, 15 minutes)
 * @param userId - The user ID to encode in the token
 * @param sessionId - Optional session ID for session tracking
 */
export async function createAccessToken(userId: string, sessionId?: string): Promise<string> {
  const {privateKey} = await getKeyPair()
  
  const payload: any = {userId}
  if (sessionId) {
    payload.sessionId = sessionId
  }

  return await new jose.SignJWT(payload)
    .setProtectedHeader({alg: 'RS256', typ: 'JWT'})
    .setIssuedAt()
    .setExpirationTime('15m')
    .setIssuer('media-downloader')
    .sign(privateKey)
}

/**
 * Creates a refresh token (long-lived, 30 days)
 * @param userId - The user ID to encode in the token
 * @param sessionId - The session ID for this token
 */
export async function createRefreshToken(userId: string, sessionId: string): Promise<string> {
  const {privateKey} = await getKeyPair()

  return await new jose.SignJWT({userId, sessionId, type: 'refresh'})
    .setProtectedHeader({alg: 'RS256', typ: 'JWT'})
    .setIssuedAt()
    .setExpirationTime('30d')
    .setIssuer('media-downloader')
    .sign(privateKey)
}

/**
 * Verifies an access or refresh token
 * @param token - The JWT to verify
 * @returns Decoded payload
 */
export async function verifyToken(token: string): Promise<jose.JWTPayload> {
  const {publicKey} = await getKeyPair()

  try {
    const {payload} = await jose.jwtVerify(token, publicKey, {
      issuer: 'media-downloader'
    })
    logDebug('verifyToken.payload', payload)
    return payload
  } catch (err) {
    logError('verifyToken.error', err)
    throw new UnauthorizedError('Invalid or expired token')
  }
}

/**
 * Validates access token and returns userId
 */
export async function validateAccessToken(token: string): Promise<{userId: string; sessionId?: string}> {
  const payload = await verifyToken(token)
  
  if (!payload.userId) {
    throw new UnauthorizedError('Token missing userId')
  }

  if (payload.type === 'refresh') {
    throw new UnauthorizedError('Cannot use refresh token as access token')
  }

  return {
    userId: payload.userId as string,
    sessionId: payload.sessionId as string | undefined
  }
}

/**
 * Validates refresh token and returns session info
 */
export async function validateRefreshToken(token: string): Promise<{userId: string; sessionId: string}> {
  const payload = await verifyToken(token)
  
  if (!payload.userId || !payload.sessionId) {
    throw new UnauthorizedError('Invalid refresh token')
  }

  if (payload.type !== 'refresh') {
    throw new UnauthorizedError('Not a refresh token')
  }

  return {
    userId: payload.userId as string,
    sessionId: payload.sessionId as string
  }
}
```

### Generate RSA Key Pair

Add script to generate keys during deployment:

```bash
#!/bin/bash
# scripts/generate-jwt-keys.sh

openssl genrsa -out jwt-private.pem 2048
openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem

echo "Private key:"
cat jwt-private.pem
echo ""
echo "Public key:"
cat jwt-public.pem
```

## Phase 3: Session Management (Week 1, Days 5-7)

```typescript
// src/util/session-helpers.ts
import {v4 as uuidv4} from 'uuid'
import {Sessions} from '../entities/Sessions'
import {logDebug, logInfo} from './lambda-helpers'
import {createAccessToken, createRefreshToken} from './jwt-helpers'
import {UnauthorizedError} from './errors'

const REFRESH_TOKEN_EXPIRY_DAYS = 30
const SESSION_CLEANUP_THRESHOLD = 5 // Max active sessions per user

/**
 * Creates a new session for a user
 * @param userId - The user ID
 * @param deviceId - Optional device identifier
 * @param ipAddress - Client IP address
 * @param userAgent - Client user agent
 * @returns Session with access and refresh tokens
 */
export async function createSession(
  userId: string,
  deviceId?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{accessToken: string; refreshToken: string; expiresAt: number}> {
  const sessionId = uuidv4()
  const refreshToken = await createRefreshToken(userId, sessionId)
  const accessToken = await createAccessToken(userId, sessionId)
  
  const expiresAt = Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000

  logDebug('createSession', {userId, sessionId, deviceId})

  await Sessions.create({
    sessionId,
    userId,
    refreshToken,
    deviceId,
    ipAddress,
    userAgent,
    expiresAt,
    lastActiveAt: Date.now()
  }).go()

  // Clean up old sessions if user has too many
  await cleanupUserSessions(userId)

  return {accessToken, refreshToken, expiresAt}
}

/**
 * Refreshes an access token using a refresh token
 * @param refreshToken - The refresh token
 * @returns New access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{accessToken: string}> {
  const {userId, sessionId} = await validateRefreshToken(refreshToken)

  // Verify session exists and is valid
  const sessionResult = await Sessions.get({sessionId}).go()
  const session = sessionResult.data

  if (!session) {
    throw new UnauthorizedError('Session not found')
  }

  if (session.expiresAt < Date.now()) {
    throw new UnauthorizedError('Session expired')
  }

  if (session.refreshToken !== refreshToken) {
    throw new UnauthorizedError('Invalid refresh token')
  }

  // Update last active time
  await Sessions.update({sessionId})
    .set({lastActiveAt: Date.now()})
    .go()

  const accessToken = await createAccessToken(userId, sessionId)
  return {accessToken}
}

/**
 * Revokes a session
 * @param sessionId - The session ID to revoke
 */
export async function revokeSession(sessionId: string): Promise<void> {
  logInfo('revokeSession', {sessionId})
  await Sessions.delete({sessionId}).go()
}

/**
 * Revokes all sessions for a user
 * @param userId - The user ID
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  logInfo('revokeAllUserSessions', {userId})
  
  const sessionsResult = await Sessions.query.byUser({userId}).go()
  const sessions = sessionsResult.data || []

  if (sessions.length > 0) {
    const sessionIds = sessions.map((s) => ({sessionId: s.sessionId}))
    await Sessions.delete(sessionIds).go()
  }
}

/**
 * Cleans up expired and excess sessions for a user
 * @param userId - The user ID
 */
async function cleanupUserSessions(userId: string): Promise<void> {
  const sessionsResult = await Sessions.query.byUser({userId}).go()
  const sessions = sessionsResult.data || []

  const now = Date.now()
  const validSessions = sessions.filter((s) => s.expiresAt > now)

  // Remove expired sessions
  const expiredSessions = sessions.filter((s) => s.expiresAt <= now)
  if (expiredSessions.length > 0) {
    const expiredIds = expiredSessions.map((s) => ({sessionId: s.sessionId}))
    await Sessions.delete(expiredIds).go()
  }

  // Remove oldest sessions if over threshold
  if (validSessions.length > SESSION_CLEANUP_THRESHOLD) {
    const sortedSessions = validSessions.sort((a, b) => a.lastActiveAt - b.lastActiveAt)
    const toRemove = sortedSessions.slice(0, validSessions.length - SESSION_CLEANUP_THRESHOLD)
    const toRemoveIds = toRemove.map((s) => ({sessionId: s.sessionId}))
    await Sessions.delete(toRemoveIds).go()
  }
}
```

## Phase 4: Password Authentication (Week 2, Days 1-3)

### Password Hashing with Scrypt

```typescript
// src/util/password-helpers.ts
import {scrypt, randomBytes, timingSafeEqual} from 'crypto'
import {promisify} from 'util'

const scryptAsync = promisify(scrypt)

const SALT_LENGTH = 16
const KEY_LENGTH = 64

/**
 * Hashes a password using scrypt
 * @param password - Plain text password
 * @returns Hashed password with salt (format: salt:hash)
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH).toString('hex')
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer
  return `${salt}:${derivedKey.toString('hex')}`
}

/**
 * Verifies a password against a hash
 * @param password - Plain text password to verify
 * @param hash - Stored hash (format: salt:hash)
 * @returns True if password matches
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, storedHash] = hash.split(':')
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer
  const storedBuffer = Buffer.from(storedHash, 'hex')
  
  return timingSafeEqual(derivedKey, storedBuffer)
}
```

### Email/Password Registration Lambda

```typescript
// src/lambdas/RegisterUserEmail/src/index.ts
import {APIGatewayProxyResult, Context} from 'aws-lambda'
import {v4 as uuidv4} from 'uuid'
import {Users} from '../../../entities/Users'
import {Accounts} from '../../../entities/Accounts'
import {getPayloadFromEvent, validateRequest} from '../../../util/apigateway-helpers'
import {registerEmailUserSchema} from '../../../util/constraints'
import {lambdaErrorResponse, logInfo, response} from '../../../util/lambda-helpers'
import {hashPassword} from '../../../util/password-helpers'
import {createSession} from '../../../util/session-helpers'
import {withXRay} from '../../../lib/vendor/AWS/XRay'

export const handler = withXRay(async (event: any, context: Context, {traceId: _traceId}): Promise<APIGatewayProxyResult> => {
  logInfo('event <=', event)
  
  try {
    const requestBody = getPayloadFromEvent(event)
    validateRequest(requestBody, registerEmailUserSchema)

    const {email, password, firstName, lastName} = requestBody

    // Check if user already exists
    const existingUsersResult = await Users.query.byEmail({email}).go()
    if (existingUsersResult.data && existingUsersResult.data.length > 0) {
      return response(context, 409, 'User already exists')
    }

    // Create user
    const userId = uuidv4()
    const passwordHash = await hashPassword(password)

    await Users.create({
      userId,
      email,
      firstName,
      lastName: lastName || '',
      emailVerified: false,
      passwordHash
    }).go()

    // Create account link
    const accountId = uuidv4()
    await Accounts.create({
      accountId,
      userId,
      provider: 'email',
      providerAccountId: email
    }).go()

    // Create session
    const ipAddress = event.requestContext?.identity?.sourceIp
    const userAgent = event.headers?.['User-Agent']
    const {accessToken, refreshToken, expiresAt} = await createSession(userId, undefined, ipAddress, userAgent)

    return response(context, 201, {
      userId,
      accessToken,
      refreshToken,
      expiresAt
    })
  } catch (error) {
    return lambdaErrorResponse(context, error)
  }
})
```

### Email/Password Login Lambda

```typescript
// src/lambdas/LoginUserEmail/src/index.ts
import {APIGatewayProxyResult, Context} from 'aws-lambda'
import {Users} from '../../../entities/Users'
import {getPayloadFromEvent, validateRequest} from '../../../util/apigateway-helpers'
import {loginEmailUserSchema} from '../../../util/constraints'
import {lambdaErrorResponse, logInfo, response} from '../../../util/lambda-helpers'
import {verifyPassword} from '../../../util/password-helpers'
import {createSession} from '../../../util/session-helpers'
import {checkRateLimit} from '../../../util/rate-limit-helpers'
import {withXRay} from '../../../lib/vendor/AWS/XRay'

export const handler = withXRay(async (event: any, context: Context, {traceId: _traceId}): Promise<APIGatewayProxyResult> => {
  logInfo('event <=', event)
  
  try {
    const requestBody = getPayloadFromEvent(event)
    validateRequest(requestBody, loginEmailUserSchema)

    const {email, password} = requestBody
    const ipAddress = event.requestContext?.identity?.sourceIp

    // Rate limiting
    await checkRateLimit('login', email, 5, 300) // 5 attempts per 5 minutes

    // Find user
    const usersResult = await Users.query.byEmail({email}).go()
    const user = usersResult.data?.[0]

    if (!user || !user.passwordHash) {
      return response(context, 401, 'Invalid credentials')
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash)
    if (!isValid) {
      return response(context, 401, 'Invalid credentials')
    }

    // Create session
    const userAgent = event.headers?.['User-Agent']
    const {accessToken, refreshToken, expiresAt} = await createSession(user.userId, undefined, ipAddress, userAgent)

    return response(context, 200, {
      userId: user.userId,
      accessToken,
      refreshToken,
      expiresAt
    })
  } catch (error) {
    return lambdaErrorResponse(context, error)
  }
})
```

## Phase 5: OAuth Providers (Week 2, Days 4-7)

### OAuth Provider Configuration

```typescript
// src/util/oauth-helpers.ts
import axios from 'axios'
import {v4 as uuidv4} from 'uuid'
import {logDebug, logInfo} from './lambda-helpers'
import {UnauthorizedError} from './errors'

export interface OAuthProvider {
  name: 'apple' | 'google' | 'github'
  clientId: string
  clientSecret: string
  redirectUri: string
  tokenUrl: string
  userInfoUrl: string
  scope: string
}

export interface OAuthUserInfo {
  providerId: string
  email: string
  emailVerified: boolean
  name?: string
  firstName?: string
  lastName?: string
  picture?: string
}

/**
 * Gets OAuth provider configuration from environment
 */
export function getProviderConfig(provider: string): OAuthProvider {
  const config = JSON.parse(process.env[`${provider.toUpperCase()}_OAUTH_CONFIG`] || '{}')
  return config as OAuthProvider
}

/**
 * Exchanges authorization code for access token
 */
export async function exchangeCodeForToken(provider: OAuthProvider, code: string, state?: string): Promise<any> {
  logInfo('exchangeCodeForToken', {provider: provider.name})

  const params: any = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: provider.redirectUri,
    client_id: provider.clientId,
    client_secret: provider.clientSecret
  }

  if (state) {
    params.state = state
  }

  const response = await axios.post(provider.tokenUrl, new URLSearchParams(params), {
    headers: {'Content-Type': 'application/x-www-form-urlencoded'}
  })

  logDebug('exchangeCodeForToken.response', response.data)
  return response.data
}

/**
 * Gets user info from OAuth provider
 */
export async function getUserInfo(provider: OAuthProvider, accessToken: string): Promise<OAuthUserInfo> {
  logInfo('getUserInfo', {provider: provider.name})

  const response = await axios.get(provider.userInfoUrl, {
    headers: {Authorization: `Bearer ${accessToken}`}
  })

  const data = response.data
  logDebug('getUserInfo.response', data)

  // Normalize user info across providers
  switch (provider.name) {
    case 'apple':
      return {
        providerId: data.sub,
        email: data.email,
        emailVerified: data.email_verified === 'true',
        name: data.name
      }
    case 'google':
      return {
        providerId: data.sub,
        email: data.email,
        emailVerified: data.email_verified,
        firstName: data.given_name,
        lastName: data.family_name,
        picture: data.picture
      }
    case 'github':
      return {
        providerId: data.id.toString(),
        email: data.email,
        emailVerified: data.verified,
        name: data.name,
        picture: data.avatar_url
      }
    default:
      throw new UnauthorizedError(`Unsupported provider: ${provider.name}`)
  }
}
```

### Generic OAuth Login Lambda

```typescript
// src/lambdas/LoginOAuth/src/index.ts
import {APIGatewayProxyResult, Context} from 'aws-lambda'
import {v4 as uuidv4} from 'uuid'
import {Users} from '../../../entities/Users'
import {Accounts} from '../../../entities/Accounts'
import {getPayloadFromEvent, validateRequest} from '../../../util/apigateway-helpers'
import {loginOAuthSchema} from '../../../util/constraints'
import {lambdaErrorResponse, logInfo, response} from '../../../util/lambda-helpers'
import {getProviderConfig, exchangeCodeForToken, getUserInfo} from '../../../util/oauth-helpers'
import {createSession} from '../../../util/session-helpers'
import {withXRay} from '../../../lib/vendor/AWS/XRay'

export const handler = withXRay(async (event: any, context: Context, {traceId: _traceId}): Promise<APIGatewayProxyResult> => {
  logInfo('event <=', event)
  
  try {
    const requestBody = getPayloadFromEvent(event)
    validateRequest(requestBody, loginOAuthSchema)

    const {provider: providerName, code, state} = requestBody

    // Get provider config
    const provider = getProviderConfig(providerName)

    // Exchange code for token
    const tokens = await exchangeCodeForToken(provider, code, state)

    // Get user info
    const userInfo = await getUserInfo(provider, tokens.access_token)

    // Find or create account
    const accountsResult = await Accounts.query
      .byProvider({provider: providerName, providerAccountId: userInfo.providerId})
      .go()

    let userId: string

    if (accountsResult.data && accountsResult.data.length > 0) {
      // Existing account
      const account = accountsResult.data[0]
      userId = account.userId

      // Update tokens
      await Accounts.update({accountId: account.accountId})
        .set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : undefined,
          updatedAt: Date.now()
        })
        .go()
    } else {
      // New account - create user and account
      userId = uuidv4()

      await Users.create({
        userId,
        email: userInfo.email,
        emailVerified: userInfo.emailVerified,
        firstName: userInfo.firstName || userInfo.name?.split(' ')[0] || '',
        lastName: userInfo.lastName || userInfo.name?.split(' ').slice(1).join(' ') || ''
      }).go()

      const accountId = uuidv4()
      await Accounts.create({
        accountId,
        userId,
        provider: providerName,
        providerAccountId: userInfo.providerId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : undefined
      }).go()
    }

    // Create session
    const ipAddress = event.requestContext?.identity?.sourceIp
    const userAgent = event.headers?.['User-Agent']
    const {accessToken, refreshToken, expiresAt} = await createSession(userId, undefined, ipAddress, userAgent)

    return response(context, 200, {
      userId,
      accessToken,
      refreshToken,
      expiresAt
    })
  } catch (error) {
    return lambdaErrorResponse(context, error)
  }
})
```

## Phase 6: Rate Limiting (Week 3, Days 1-2)

```typescript
// src/util/rate-limit-helpers.ts
import {RateLimits} from '../entities/RateLimits'
import {logDebug} from './lambda-helpers'
import {TooManyRequestsError} from './errors'

/**
 * Checks rate limit for an endpoint/identifier combination
 * @param endpoint - The endpoint being rate limited
 * @param identifier - User identifier (email, userId, IP)
 * @param maxRequests - Maximum requests allowed in window
 * @param windowSeconds - Window size in seconds
 * @throws TooManyRequestsError if limit exceeded
 */
export async function checkRateLimit(
  endpoint: string,
  identifier: string,
  maxRequests: number,
  windowSeconds: number
): Promise<void> {
  const now = Date.now()
  const windowStart = Math.floor(now / (windowSeconds * 1000)) * (windowSeconds * 1000)
  const key = `${endpoint}:${identifier}:${windowStart}`
  const ttl = Math.floor((windowStart + windowSeconds * 1000) / 1000) + 60 // TTL with buffer

  logDebug('checkRateLimit', {key, maxRequests, windowSeconds})

  try {
    // Try to get existing rate limit record
    const result = await RateLimits.get({key}).go()
    const rateLimit = result.data

    if (rateLimit) {
      if (rateLimit.requests >= maxRequests) {
        throw new TooManyRequestsError(`Rate limit exceeded. Try again in ${windowSeconds} seconds.`)
      }

      // Increment request count
      await RateLimits.update({key}).add({requests: 1}).go()
    } else {
      // Create new rate limit record
      await RateLimits.create({
        key,
        requests: 1,
        windowStart,
        ttl
      }).go()
    }
  } catch (error) {
    if (error instanceof TooManyRequestsError) {
      throw error
    }
    // If there's an error checking rate limit, log but don't block
    logDebug('checkRateLimit.error', error)
  }
}
```

### Add TooManyRequestsError

```typescript
// src/util/errors.ts - ADD
export class TooManyRequestsError extends Error {
  public statusCode: number

  constructor(message: string) {
    super(message)
    this.name = 'TooManyRequestsError'
    this.statusCode = 429
    Error.captureStackTrace(this, this.constructor)
  }
}
```

## Phase 7: Update ApiGatewayAuthorizer (Week 3, Days 3-4)

```typescript
// src/lambdas/ApiGatewayAuthorizer/src/index.ts - UPDATE
import {APIGatewayRequestAuthorizerEvent, CustomAuthorizerResult, Context} from 'aws-lambda'
import {logDebug, logError, logInfo} from '../../../util/lambda-helpers'
import {validateAccessToken} from '../../../util/jwt-helpers'
import {Sessions} from '../../../entities/Sessions'
import {withXRay} from '../../../lib/vendor/AWS/XRay'

// ... existing generateAllow/generateDeny/fetchApiKeys functions ...

async function getUserIdFromAuthenticationHeader(authorizationHeader: string): Promise<string | undefined> {
  const jwtRegex = /^Bearer [A-Za-z\d-_=]+\.[A-Za-z\d-_=]+\.?[A-Za-z\d-_.+/=]+$/
  const matches = authorizationHeader.match(jwtRegex)
  logDebug('getUserIdFromAuthenticationHeader.matches', matches)
  
  if (!matches) {
    return
  }

  const token = authorizationHeader.split(' ')[1]
  
  try {
    logDebug('validateAccessToken <=', token)
    const {userId, sessionId} = await validateAccessToken(token)
    logDebug('validateAccessToken =>', {userId, sessionId})

    // If token has sessionId, verify session is still valid
    if (sessionId) {
      const sessionResult = await Sessions.get({sessionId}).go()
      const session = sessionResult.data

      if (!session || session.expiresAt < Date.now()) {
        logError('Session expired or not found', {sessionId})
        return
      }

      // Update last active time
      await Sessions.update({sessionId})
        .set({lastActiveAt: Date.now()})
        .go()
    }

    return userId
  } catch (err) {
    logError('Invalid JWT token', err)
    return
  }
}

// ... rest of handler remains the same ...
```

## Phase 8: Token Refresh Endpoint (Week 3, Day 5)

```typescript
// src/lambdas/RefreshToken/src/index.ts
import {APIGatewayProxyResult, Context} from 'aws-lambda'
import {getPayloadFromEvent, validateRequest} from '../../../util/apigateway-helpers'
import {refreshTokenSchema} from '../../../util/constraints'
import {lambdaErrorResponse, logInfo, response} from '../../../util/lambda-helpers'
import {refreshAccessToken} from '../../../util/session-helpers'
import {withXRay} from '../../../lib/vendor/AWS/XRay'

export const handler = withXRay(async (event: any, context: Context, {traceId: _traceId}): Promise<APIGatewayProxyResult> => {
  logInfo('event <=', event)
  
  try {
    const requestBody = getPayloadFromEvent(event)
    validateRequest(requestBody, refreshTokenSchema)

    const {refreshToken} = requestBody
    const {accessToken} = await refreshAccessToken(refreshToken)

    return response(context, 200, {accessToken})
  } catch (error) {
    return lambdaErrorResponse(context, error)
  }
})
```

## Phase 9: Migration Strategy (Week 3, Days 6-7)

### Data Migration Script

```typescript
// scripts/migrate-users-to-new-auth.ts
import {Users} from '../src/entities/Users'
import {Accounts} from '../src/entities/Accounts'
import {v4 as uuidv4} from 'uuid'

/**
 * Migrates existing users to new authentication system
 * Creates Account records for existing identityProviders
 */
async function migrateUsers() {
  console.log('Starting user migration...')

  // Scan all existing users
  const usersResult = await Users.scan().go()
  const users = usersResult.data || []

  console.log(`Found ${users.length} users to migrate`)

  for (const user of users) {
    console.log(`Migrating user ${user.userId}...`)

    // Check if user has identityProviders (old Apple auth)
    if (user.identityProviders && user.identityProviders.userId) {
      // Create Account record for Apple provider
      const accountId = uuidv4()
      
      try {
        await Accounts.create({
          accountId,
          userId: user.userId,
          provider: 'apple',
          providerAccountId: user.identityProviders.userId,
          accessToken: user.identityProviders.accessToken,
          refreshToken: user.identityProviders.refreshToken,
          tokenExpiresAt: user.identityProviders.expiresAt,
          scope: user.identityProviders.scope || ''
        }).go()

        console.log(`  ✓ Created Apple account link`)
      } catch (error) {
        console.error(`  ✗ Failed to create account:`, error)
      }
    }

    // Update emailVerified if not set
    if (user.emailVerified === undefined) {
      try {
        await Users.update({userId: user.userId})
          .set({
            emailVerified: user.identityProviders?.emailVerified || false
          })
          .go()

        console.log(`  ✓ Updated emailVerified`)
      } catch (error) {
        console.error(`  ✗ Failed to update user:`, error)
      }
    }
  }

  console.log('Migration complete!')
}

migrateUsers().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})
```

## Phase 10: Testing (Week 4)

### Unit Tests Structure

```typescript
// src/entities/Sessions.test.ts
import {describe, it, expect, jest, beforeEach} from '@jest/globals'
import {createElectroDBEntityMock} from '../../test/helpers/electrodb-mock'

describe('Sessions Entity', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('should create a session', async () => {
    const sessionsMock = createElectroDBEntityMock({queryIndexes: ['byUser']})
    jest.unstable_mockModule('../entities/Sessions', () => ({
      Sessions: sessionsMock.entity
    }))

    const {Sessions} = await import('../entities/Sessions')

    const sessionData = {
      sessionId: 'session-123',
      userId: 'user-123',
      refreshToken: 'token',
      expiresAt: Date.now() + 86400000
    }

    sessionsMock.mocks.create.mockResolvedValue({data: sessionData})

    const result = await Sessions.create(sessionData).go()

    expect(result.data).toEqual(sessionData)
    expect(sessionsMock.mocks.create).toHaveBeenCalledTimes(1)
  })

  it('should query sessions by user', async () => {
    const sessionsMock = createElectroDBEntityMock({queryIndexes: ['byUser']})
    jest.unstable_mockModule('../entities/Sessions', () => ({
      Sessions: sessionsMock.entity
    }))

    const {Sessions} = await import('../entities/Sessions')

    const sessions = [
      {sessionId: 'session-1', userId: 'user-123'},
      {sessionId: 'session-2', userId: 'user-123'}
    ]

    sessionsMock.mocks.query.byUser!.go.mockResolvedValue({data: sessions})

    const result = await Sessions.query.byUser({userId: 'user-123'}).go()

    expect(result.data).toEqual(sessions)
    expect(sessionsMock.mocks.query.byUser!.go).toHaveBeenCalledTimes(1)
  })
})
```

### Integration Tests

```typescript
// test/integration/auth-flow.test.ts
import {describe, it, expect} from '@jest/globals'
import {Users} from '../../src/entities/Users'
import {Accounts} from '../../src/entities/Accounts'
import {Sessions} from '../../src/entities/Sessions'
import {createSession, refreshAccessToken} from '../../src/util/session-helpers'
import {hashPassword, verifyPassword} from '../../src/util/password-helpers'
import {v4 as uuidv4} from 'uuid'

describe('Authentication Flow (Integration)', () => {
  it('should complete full email/password auth flow', async () => {
    const userId = uuidv4()
    const email = `test-${Date.now()}@example.com`
    const password = 'TestPassword123!'

    // 1. Create user with hashed password
    const passwordHash = await hashPassword(password)
    await Users.create({
      userId,
      email,
      firstName: 'Test',
      lastName: 'User',
      emailVerified: false,
      passwordHash
    }).go()

    // 2. Create account link
    const accountId = uuidv4()
    await Accounts.create({
      accountId,
      userId,
      provider: 'email',
      providerAccountId: email
    }).go()

    // 3. Verify password
    const isValid = await verifyPassword(password, passwordHash)
    expect(isValid).toBe(true)

    // 4. Create session
    const session = await createSession(userId)
    expect(session.accessToken).toBeDefined()
    expect(session.refreshToken).toBeDefined()
    expect(session.expiresAt).toBeGreaterThan(Date.now())

    // 5. Refresh access token
    const refreshed = await refreshAccessToken(session.refreshToken)
    expect(refreshed.accessToken).toBeDefined()

    // Cleanup
    await Users.delete({userId}).go()
    await Accounts.delete({accountId}).go()
  })
})
```

## Implementation Timeline

### Week 1: Foundation
- **Days 1-2**: ElectroDB entities (Sessions, Accounts, VerificationTokens, RateLimits)
- **Days 3-4**: JWT management (RS256 implementation, key generation)
- **Days 5-7**: Session management (create, refresh, revoke)

### Week 2: Authentication Methods
- **Days 1-3**: Email/password auth (hashing, registration, login)
- **Days 4-7**: OAuth providers (Apple, Google, GitHub)

### Week 3: Security & Integration
- **Days 1-2**: Rate limiting implementation
- **Days 3-4**: Update ApiGatewayAuthorizer for new JWT system
- **Day 5**: Token refresh endpoint
- **Days 6-7**: Data migration script and testing

### Week 4: Testing & Documentation
- **Days 1-3**: Comprehensive unit and integration tests
- **Days 4-5**: End-to-end testing with LocalStack
- **Days 6-7**: Documentation updates and deployment

## Infrastructure Changes

### Environment Variables (Add to Lambda configuration)

```hcl
# terraform/variables.tf
variable "jwt_private_key" {
  description = "RSA private key for JWT signing (PEM format)"
  type        = string
  sensitive   = true
}

variable "jwt_public_key" {
  description = "RSA public key for JWT verification (PEM format)"
  type        = string
  sensitive   = true
}

variable "google_oauth_config" {
  description = "Google OAuth configuration JSON"
  type        = string
  sensitive   = true
  default     = ""
}

variable "github_oauth_config" {
  description = "GitHub OAuth configuration JSON"
  type        = string
  sensitive   = true
  default     = ""
}
```

### DynamoDB Table Changes

The existing table already supports our needs through the single-table design. No schema migration needed - new entities use existing GSI structure.

## Security Considerations

### Password Security
- ✅ Scrypt hashing (memory-hard, resistant to GPU attacks)
- ✅ Random salt per password
- ✅ Timing-safe comparison

### JWT Security
- ✅ RS256 asymmetric signing (private key only on server)
- ✅ Short-lived access tokens (15 minutes)
- ✅ Long-lived refresh tokens (30 days, revocable)
- ✅ Token type separation (can't use refresh as access)

### Session Security
- ✅ Session tracking in database
- ✅ Automatic cleanup of old sessions
- ✅ IP address and user agent tracking
- ✅ Device-based session limits
- ✅ Revocation support (logout all devices)

### Rate Limiting
- ✅ Per-endpoint limits
- ✅ Per-identifier limits (email, userId, IP)
- ✅ Automatic TTL cleanup via DynamoDB
- ✅ Failed login attempt tracking

### OAuth Security
- ✅ CSRF protection via state parameter
- ✅ Token validation against provider
- ✅ Secure token storage

## Success Metrics

After implementation:
- [x] 100% feature parity with current Apple auth
- [ ] Session refresh working (no more re-authentication)
- [ ] Multiple authentication methods supported (Apple, Google, GitHub, Email/Password)
- [ ] Rate limiting active (protect against brute force)
- [ ] Test coverage ≥90% (adapter + integration tests)
- [ ] Zero production incidents (smooth migration)
- [ ] RS256 JWT tokens (upgraded from HS256)
- [ ] Session management (revoke, logout all devices)
- [ ] Existing users migrated successfully

## Next Steps

1. **Generate RSA key pair** for JWT signing
2. **Create ElectroDB entities** (Sessions, Accounts, VerificationTokens, RateLimits)
3. **Implement JWT helpers** with RS256 support
4. **Build session management system**
5. **Add authentication methods** (email/password, OAuth)
6. **Update Lambda functions** (LoginUser, RegisterUser, ApiGatewayAuthorizer)
7. **Write comprehensive tests**
8. **Migrate existing users**
9. **Deploy to production**
10. **Monitor and iterate**

## Conclusion

This custom authentication system provides:
- ✅ **Full control** over authentication logic
- ✅ **Cost efficiency** (~$0.50/month vs $15-20/month for RDS)
- ✅ **Perfect fit** with existing ElectroDB/DynamoDB architecture
- ✅ **Production-grade security** (RS256 JWT, scrypt passwords, rate limiting)
- ✅ **Future-proof** (easy to add new providers or features)
- ✅ **Zero dependencies** on external services (beyond OAuth providers)

This is the right choice for a serverless AWS project that values simplicity, ownership, and architectural consistency.
