# Apple Sign In ID Token Migration

## Overview

As of November 2024, the backend API has migrated from Apple's authorization code flow to direct ID token authentication using Better Auth's OAuth capabilities. This eliminates the need for a server-side token exchange and reduces authentication latency by 200-500 ms.

## What Changed

### Before (Authorization Code Flow)
```
iOS App → Sign in with Apple → Authorization Code → Backend API
                                                    ↓
                                     Token Exchange with Apple
                                                    ↓
                                              User Session
```

### After (ID Token Flow)
```
iOS App → Sign in with Apple → ID Token → Backend API
                                            ↓
                                  Better Auth Verification
                                            ↓
                                      User Session
```

## API Contract Changes

### RegisterUser Endpoint

**Old Request Format:**
```json
{
  "authorizationCode": "c1234567890abcdef",
  "firstName": "Jonathan",
  "lastName": "Lloyd"
}
```

**New Request Format:**
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "firstName": "Jonathan",
  "lastName": "Lloyd"
}
```

### LoginUser Endpoint

**Old Request Format:**
```json
{
  "authorizationCode": "c1234567890abcdef"
}
```

**New Request Format:**
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## iOS Implementation Guide

### Accessing the ID Token

When using `ASAuthorizationController` for Sign in with Apple, the ID token is available in the authorization credential response:

```swift
func authorizationController(controller: ASAuthorizationController,
                            didCompleteWithAuthorization authorization: ASAuthorization) {
    if let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential {
        // Get the ID token (this is what we need!)
        guard let identityTokenData = appleIDCredential.identityToken,
              let identityToken = String(data: identityTokenData, encoding: .utf8) else {
            print("Unable to fetch identity token")
            return
        }

        // Get user's full name (only available on first sign-in)
        let firstName = appleIDCredential.fullName?.givenName ?? ""
        let lastName = appleIDCredential.fullName?.familyName ?? ""

        // Determine if this is a new user (first sign-in)
        let isNewUser = appleIDCredential.fullName?.givenName != nil

        if isNewUser {
            // Call RegisterUser endpoint
            registerUser(idToken: identityToken,
                        firstName: firstName,
                        lastName: lastName)
        } else {
            // Call LoginUser endpoint
            loginUser(idToken: identityToken)
        }
    }
}
```

### RegisterUser API Call

```swift
func registerUser(idToken: String, firstName: String, lastName: String) {
    let url = URL(string: "\(baseURL)/registerUser")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

    let body: [String: Any] = [
        "idToken": idToken,
        "firstName": firstName,
        "lastName": lastName
    ]

    request.httpBody = try? JSONSerialization.data(withJSONObject: body)

    URLSession.shared.dataTask(with: request) { data, response, error in
        guard let data = data, error == nil else {
            print("Registration failed: \(error?.localizedDescription ?? "Unknown error")")
            return
        }

        // Parse response
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let body = json["body"] as? [String: Any],
           let token = body["token"] as? String,
           let expiresAt = body["expiresAt"] as? Double,
           let sessionId = body["sessionId"] as? String,
           let userId = body["userId"] as? String {

            // Save session token for authenticated requests
            saveSessionToken(token: token, expiresAt: expiresAt,
                           sessionId: sessionId, userId: userId)
        }
    }.resume()
}
```

### LoginUser API Call

```swift
func loginUser(idToken: String) {
    let url = URL(string: "\(baseURL)/login")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

    let body: [String: Any] = [
        "idToken": idToken
    ]

    request.httpBody = try? JSONSerialization.data(withJSONObject: body)

    URLSession.shared.dataTask(with: request) { data, response, error in
        guard let data = data, error == nil else {
            print("Login failed: \(error?.localizedDescription ?? "Unknown error")")
            return
        }

        // Parse response (same format as RegisterUser)
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let body = json["body"] as? [String: Any],
           let token = body["token"] as? String,
           let expiresAt = body["expiresAt"] as? Double,
           let sessionId = body["sessionId"] as? String,
           let userId = body["userId"] as? String {

            // Save session token for authenticated requests
            saveSessionToken(token: token, expiresAt: expiresAt,
                           sessionId: sessionId, userId: userId)
        }
    }.resume()
}
```

## Important Notes

### ID Token vs Authorization Code

- **ID Token**: A JWT containing user identity claims (email, sub, etc.). Available immediately after Apple Sign In.
- **Authorization Code**: A one-time code that must be exchanged for tokens via Apple's token endpoint. This is what the project used before.

### Name Availability

Apple's privacy design means:
1. `fullName` is ONLY populated on the first sign-in
2. Subsequent sign-ins have `nil` for `fullName`
3. The ID token does NOT contain first/last name for privacy reasons
4. This is why the name is sent separately in the RegisterUser request

The backend detects new users (created within last 5 seconds) and updates their name from the iOS app's request.

### Token Security

- ID tokens are short-lived (typically 10 minutes)
- They are signed by Apple using RS256 algorithm
- Better Auth verifies the signature using Apple's public JWKS
- Never cache or store ID tokens - they are single-use for authentication

### Session Management

Both RegisterUser and LoginUser return the same session response format:

```json
{
  "body": {
    "token": "session-token-string",
    "expiresAt": 1234567890000,
    "sessionId": "uuid-session-id",
    "userId": "uuid-user-id"
  }
}
```

Use the `token` value for subsequent authenticated API requests via the `Authorization` header:

```swift
request.setValue("Bearer \(sessionToken)", forHTTPHeaderField: "Authorization")
```

## Migration Checklist

- [ ] Update RegisterUser calls to use `idToken` instead of `authorizationCode`
- [ ] Update LoginUser calls to use `idToken` instead of `authorizationCode`
- [ ] Extract ID token from `ASAuthorizationAppleIDCredential.identityToken`
- [ ] Remove any authorization code handling logic
- [ ] Test new user registration flow
- [ ] Test existing user login flow
- [ ] Verify session token handling remains unchanged
- [ ] Update any error handling for new API contract

## Benefits

1. **Reduced Latency**: Eliminates 200-500 ms token exchange round trip to Apple
2. **Simpler Flow**: Direct token verification vs. two-step exchange
3. **Better Auth Integration**: Leverages Better Auth's built-in OAuth capabilities
4. **Same Security**: ID token verification is cryptographically equivalent to authorization code flow

## Troubleshooting

### "Invalid ID token" Error

Check that you're using `identityToken` not `authorizationCode`:
```swift
// Correct
let identityToken = String(data: appleIDCredential.identityToken!, encoding: .utf8)

// Wrong
let authCode = String(data: appleIDCredential.authorizationCode!, encoding: .utf8)
```

### Name Not Saved for New Users

Ensure you're:
1. Checking if `fullName` is populated (indicates new user)
2. Sending `firstName` and `lastName` in RegisterUser request
3. Calling RegisterUser, not LoginUser, for new users

### Session Token Not Working

Verify the response format hasn't changed - both endpoints return identical session structure.

## References

- [Apple Sign In Documentation](https://developer.apple.com/documentation/sign_in_with_apple)
- [ASAuthorizationAppleIDCredential](https://developer.apple.com/documentation/authenticationservices/asauthorizationappleidcredential)
- [Better Auth OAuth Provider](https://www.better-auth.com/docs/authentication/oauth)
