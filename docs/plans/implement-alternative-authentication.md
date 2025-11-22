# Issue: Implement Alternative Authentication Methods

## Problem Statement

The AWS Media Downloader currently requires Sign In With Apple (SIWA) as the only authentication method. This creates several limitations:

1. **High Barrier to Entry**: Requires an Apple Developer account ($99/year)
2. **Platform Lock-in**: iOS-only authentication limits potential Android/web expansion
3. **Testing Challenges**: Cannot create automated end-to-end tests without real Apple auth codes
4. **Configuration Complexity**: Requires multiple Apple-specific secrets and certificates
5. **Cannot Make Optional**: Without alternatives, SIWA cannot be made conditional

## Current Implementation Analysis

### SIWA Dependencies

**Secrets Required**:
- `signInWithApple.config` - JSON with client_id, team_id, key_id, redirect_uri
- `signInWithApple.authKey` - EC private key for JWT signing

**Lambda Functions Affected**:
- `RegisterUser` - Creates new users via SIWA
- `LoginUser` - Authenticates existing users via SIWA

**External API Calls**:
- `https://appleid.apple.com/auth/token` - Token validation
- `https://appleid.apple.com/auth/keys` - Public key fetch for JWT verification

### Authentication Flow

1. iOS app initiates Apple sign-in
2. Apple returns authorization code to app
3. App sends code to RegisterUser/LoginUser Lambda
4. Lambda validates code with Apple's servers
5. Lambda creates/validates user in DynamoDB
6. Lambda returns JWT access token signed with platform key

## Proposed Solutions

### Option 1: Email Magic Link (Recommended)

**Pros**:
- No password management required
- Secure and user-friendly
- Works across all platforms
- Minimal configuration (just email service)

**Implementation**:
1. User enters email address
2. Lambda generates secure token and stores in DynamoDB with TTL
3. Sends email with magic link containing token
4. User clicks link, app opens with token
5. Lambda validates token and creates session

**Required Services**:
- AWS SES or similar email service
- DynamoDB for token storage (already have)

### Option 2: Username/Password

**Pros**:
- Familiar to users
- No external dependencies
- Fully self-contained

**Cons**:
- Password storage and security concerns
- Password reset flow needed
- Less secure than passwordless options

**Implementation**:
1. Hash passwords with bcrypt/argon2
2. Store in DynamoDB
3. Implement password reset via email
4. Add rate limiting for brute force protection

### Option 3: OAuth Providers (GitHub, Google)

**Pros**:
- Leverages existing accounts
- No password management
- Industry standard flows

**Cons**:
- Still requires external configuration
- Each provider needs separate implementation
- Increases complexity

### Option 4: API Key Authentication (Simplest)

**Pros**:
- Dead simple implementation
- No external dependencies
- Perfect for development/testing
- Could coexist with SIWA for production

**Implementation**:
1. Generate unique API keys for users
2. Store in DynamoDB
3. Pass key in Authorization header
4. Validate in ApiGatewayAuthorizer

**Use Cases**:
- Development and testing
- Automated systems
- Fallback when SIWA not configured

## Recommended Approach

Implement a **dual-strategy approach**:

1. **Primary**: Email Magic Link for production users
2. **Secondary**: API Key for development/testing/automation

This combination provides:
- User-friendly authentication for end users
- Simple authentication for testing
- No external dependencies beyond email
- Makes SIWA truly optional

## Implementation Plan

### Phase 1: API Key Authentication
1. Create new Lambda: `GenerateApiKey`
2. Modify `ApiGatewayAuthorizer` to support API key auth
3. Add API key validation logic
4. Create management endpoints (list, revoke keys)

### Phase 2: Email Magic Link
1. Set up AWS SES or email provider
2. Create new Lambda: `RequestMagicLink`
3. Create new Lambda: `ValidateMagicLink`
4. Implement token generation and TTL
5. Add email templates

### Phase 3: Make SIWA Conditional
1. Add `verifySiwaConfiguration()` helper
2. Update RegisterUser/LoginUser to check configuration
3. Route to appropriate auth method based on availability
4. Update documentation

### Phase 4: Testing
1. Create end-to-end test suite using API keys
2. Test magic link flow
3. Verify SIWA still works when configured
4. Test fallback behavior

## Database Schema Changes

### New DynamoDB Items

**API Keys Table** (or add to existing):
```typescript
{
  userId: string,
  apiKey: string, // indexed
  createdAt: number,
  lastUsed: number,
  description: string
}
```

**Magic Link Tokens**:
```typescript
{
  token: string, // partition key
  email: string,
  createdAt: number,
  ttl: number, // DynamoDB TTL
  used: boolean
}
```

## API Gateway Changes

### New Endpoints
- `POST /auth/magic-link/request` - Request magic link email
- `POST /auth/magic-link/validate` - Validate magic link token
- `POST /auth/api-key/generate` - Generate new API key
- `DELETE /auth/api-key/{key}` - Revoke API key
- `GET /auth/api-key` - List user's API keys

### Modified Endpoints
- `POST /user/register` - Accept multiple auth methods
- `POST /user/login` - Route to appropriate auth validator

## Benefits of Implementation

### Immediate Benefits
1. **Testability**: Full end-to-end testing without iOS device
2. **Accessibility**: Anyone can use the service without Apple Developer account
3. **Development**: Easier local development and testing

### Future Benefits
1. **Platform Expansion**: Enable Android, web, or CLI clients
2. **Automation**: API keys enable automated workflows
3. **Flexibility**: Users choose preferred auth method

## Success Criteria

1. Users can authenticate without Apple ID
2. Existing SIWA users unaffected
3. Full end-to-end test suite runs in CI/CD
4. SIWA can be completely disabled without breaking auth
5. Clear documentation for each auth method

## Security Considerations

### API Key Security
- Keys must be cryptographically random (min 32 bytes)
- Store hashed in database (like passwords)
- Implement rate limiting
- Provide key rotation mechanism
- Audit key usage

### Magic Link Security
- Tokens expire after 15 minutes
- One-time use only
- Rate limit email requests
- Verify email ownership
- Use secure random tokens

### General
- All auth methods create same JWT format
- Maintain existing authorization patterns
- Add auth method to JWT claims for auditing

## Testing Requirements

### Unit Tests
- API key generation and validation
- Magic link token generation and expiration
- Auth method routing logic
- Backwards compatibility with SIWA

### Integration Tests
- Full auth flow for each method
- Method fallback behavior
- Token refresh across methods
- Authorization consistency

### End-to-End Tests
The following should be possible without iOS device:
- Register user with API key
- Download media
- List files with authentication
- Receive notifications (if configured)
- Delete user account

## Migration Strategy

1. **No Breaking Changes**: Existing SIWA users continue working
2. **Gradual Rollout**: Deploy auth methods individually
3. **Feature Flags**: Enable/disable methods via environment variables
4. **Documentation**: Clear upgrade path for existing deployments

## Related Plans

- **Conditional Functionality Implementation** (`docs/plans/conditional-functionality-implementation.md`)
- **End-to-End Testing Strategy** (TODO.md lines 13-36)

## Conclusion

Implementing alternative authentication methods is essential for making this project truly accessible and testable. The recommended dual-strategy approach balances user experience with development needs while maintaining security and allowing SIWA to become truly optional.

## Next Steps

1. Review and approve approach
2. Implement API key authentication (simplest)
3. Add email magic link support
4. Make SIWA conditional
5. Create comprehensive test suite
6. Update documentation