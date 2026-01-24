# Secret Rotation Runbook

This runbook documents all secrets used in the media downloader infrastructure, their rotation procedures, and expiration tracking.

## Secret Inventory

| Secret | Location | Rotation Frequency | Expiration | Owner |
|--------|----------|-------------------|------------|-------|
| Sign In With Apple Key | secrets.enc.yaml | As needed | No expiry | Apple Developer Account |
| Better Auth Secret | secrets.enc.yaml | On compromise | No expiry | Generated |
| APNS Signing Key | secrets.enc.yaml | Certificate renewal | 2027-01-03 | Apple Developer Account |
| APNS Certificate | secrets.enc.yaml | Certificate renewal | 2027-01-03 | Apple Developer Account |
| GitHub PAT | secrets.enc.yaml | 90 days recommended | Check GitHub | GitHub Account |
| YouTube Cookies | layers/yt-dlp/cookies/ | 3-5 days | Auto-detected | Chrome Browser |

## Expiration Calendar

| Secret | Expiration Date | Reminder Date | Action Required |
|--------|-----------------|---------------|-----------------|
| APNS Signing Key | 2027-01-03 | 2026-12-01 | Renew in Apple Developer Portal |
| APNS Certificate | 2027-01-03 | 2026-12-01 | Renew in Apple Developer Portal |
| GitHub PAT | Varies | Check GitHub settings | Regenerate token |
| YouTube Cookies | ~3-5 days | Auto-detected via 403 error | Run extraction script |

---

## Rotation Procedures

### YouTube Cookies

**Frequency**: Every 3-5 days, or when downloads fail with 403 errors.

**Auto-detection**: The system automatically detects cookie expiration via 403 errors and creates a GitHub issue with priority label.

**Procedure**:
1. Run the extraction script:
   ```bash
   pnpm run extract-cookies:chrome
   ```
2. Follow the prompts:
   - Chrome opens automatically
   - Log into YouTube when prompted
   - Press Enter when logged in (avatar visible)
   - Script extracts and saves cookies to layer
3. Verify the cookies were extracted:
   ```bash
   cat layers/yt-dlp/cookies/youtube-cookies.txt | head -10
   ```
4. Deploy the updated layer:
   ```bash
   pnpm run deploy
   ```

**Troubleshooting**:
- If Chrome doesn't open, verify Chrome is installed at the expected path
- If login fails, try signing out of all Google accounts first
- The script requires `puppeteer-core` - run `pnpm install` if missing

---

### GitHub Personal Access Token

**Frequency**: Every 90 days recommended, or immediately on suspected compromise.

**Purpose**: Used for automated GitHub issue creation when errors occur.

**Procedure**:
1. Visit [GitHub Token Settings](https://github.com/settings/tokens)
2. Create a new fine-grained personal access token:
   - Repository access: Only select the target repository
   - Permissions: Issues (Read and write)
   - Expiration: 90 days
3. Decrypt the secrets file:
   ```bash
   sops --decrypt secrets.enc.yaml > secrets.yaml
   ```
4. Update the token in `secrets.yaml`:
   ```yaml
   github:
     issue:
       token: github_pat_YOUR_NEW_TOKEN_HERE
   ```
5. Re-encrypt and deploy:
   ```bash
   pnpm run build-dependencies  # Auto-encrypts
   pnpm run deploy
   ```

**Verification**:
```bash
# Test the token (replace with actual values)
curl -H "Authorization: token YOUR_TOKEN" \
     https://api.github.com/repos/OWNER/REPO/issues
```

---

### APNS Certificates

**Frequency**: Certificate renewal (current expiration: 2027-01-03)

**Components**:
- APNS Signing Key (P8 format) - for token-based authentication
- APNS Certificate (PEM format) - for SNS platform application
- APNS Private Key (PEM format) - for SNS platform application

**Procedure**:
1. Log into [Apple Developer Portal](https://developer.apple.com/account)
2. Navigate to Certificates, Identifiers & Profiles
3. Generate new APNS key/certificate as needed
4. Download the new credentials
5. Extract/convert as needed:
   ```bash
   # For P12 to PEM conversion
   openssl pkcs12 -in certificate.p12 -out certificate.pem -clcerts -nokeys
   openssl pkcs12 -in certificate.p12 -out privatekey.pem -nocerts -nodes
   ```
6. Update `secrets.yaml` with new values:
   ```yaml
   apns:
     staging:
       team: YOUR_TEAM_ID
       keyId: YOUR_KEY_ID
       signingKey: |
         -----BEGIN PRIVATE KEY-----
         YOUR_SIGNING_KEY_HERE
         -----END PRIVATE KEY-----
       privateKey: |
         -----BEGIN PRIVATE KEY-----
         YOUR_PRIVATE_KEY_HERE
         -----END PRIVATE KEY-----
       certificate: |
         -----BEGIN CERTIFICATE-----
         YOUR_CERTIFICATE_HERE
         -----END CERTIFICATE-----
   ```
7. Re-encrypt and deploy:
   ```bash
   pnpm run build-dependencies
   pnpm run deploy
   ```

**Verification**:
- Send a test push notification to a registered device
- Check CloudWatch logs for SendPushNotification Lambda

---

### Better Auth Secret

**Frequency**: Only on suspected compromise.

**Purpose**: Used for session token signing and encryption.

**Impact**: Rotating this secret invalidates ALL existing user sessions.

**Procedure**:
1. Generate a new random secret:
   ```bash
   openssl rand -base64 32
   ```
2. Update `secrets.yaml`:
   ```yaml
   platform:
     key: 'YOUR_NEW_SECRET_HERE'
   ```
3. Re-encrypt and deploy:
   ```bash
   pnpm run build-dependencies
   pnpm run deploy
   ```

**Post-rotation**:
- All users need to re-authenticate
- Monitor authentication Lambda logs for issues

---

### Sign In With Apple Key

**Frequency**: As needed (key rotation or suspected compromise).

**Procedure**:
1. Log into [Apple Developer Portal](https://developer.apple.com/account)
2. Navigate to Keys section
3. Create a new Sign In With Apple key
4. Download the P8 key file
5. Note the new Key ID
6. Update `secrets.yaml`:
   ```yaml
   signInWithApple:
     config: |
       {"client_id":"YOUR_APP_ID","team_id":"YOUR_TEAM_ID","redirect_uri":"","key_id":"NEW_KEY_ID","scope":"email name"}
     authKey: |
       -----BEGIN PRIVATE KEY-----
       CONTENTS_OF_P8_FILE
       -----END PRIVATE KEY-----
   ```
7. Re-encrypt and deploy:
   ```bash
   pnpm run build-dependencies
   pnpm run deploy
   ```

---

## Emergency Rotation

If a secret is suspected to be compromised:

1. **Immediate**: Rotate the affected secret using procedures above
2. **Deploy**: Push changes immediately with `pnpm run deploy`
3. **Audit**: Check CloudWatch logs for unauthorized access
4. **Notify**: Update team on incident

---

## Automation Status

| Secret | Detection | Rotation | Notes |
|--------|-----------|----------|-------|
| YouTube Cookies | Automated (403 detection) | Manual | GitHub issue created, deploy after extraction |
| GitHub PAT | Manual | Manual | Set calendar reminder |
| APNS Credentials | Manual | Manual | Set calendar reminder for 2026-12-01 |
| Better Auth | Manual | Manual | Only rotate on compromise |
| Sign In With Apple | Manual | Manual | Only rotate as needed |

---

## Related Documentation

- [Security Audit Report](Security-Audit-Report.md)
- [Vendor Encapsulation Policy](../Conventions/Vendor-Encapsulation-Policy.md)
- [Lambda Environment Variables](../AWS/Lambda-Environment-Variables.md)

---

*Last updated: 2026-01-03*
