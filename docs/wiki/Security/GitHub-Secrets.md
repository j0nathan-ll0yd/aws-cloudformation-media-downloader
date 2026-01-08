# GitHub Secrets Configuration

This document describes the GitHub secrets required for automated workflows.

## YouTube Cookie Automation Secrets

The cookie refresh workflow requires authentication credentials to extract cookies from YouTube.

| Secret Name | Description | Required For |
|-------------|-------------|--------------|
| `YOUTUBE_EMAIL` | Personal Google account email | Cookie refresh workflow |
| `YOUTUBE_PASSWORD` | App Password (recommended for 2FA) | Cookie refresh workflow |

### Setup Instructions

#### 1. Generate an App Password (Recommended for 2FA accounts)

If your Google account uses 2-factor authentication:

1. Go to https://myaccount.google.com/apppasswords
2. Select "Other (Custom name)" from the dropdown
3. Enter "GitHub Actions" as the name
4. Click "Generate"
5. Copy the 16-character password (spaces are optional)

#### 2. Add Secrets to GitHub

1. Navigate to repository Settings > Secrets and variables > Actions
2. Click "New repository secret"
3. Add `YOUTUBE_EMAIL` with your Google email address
4. Add `YOUTUBE_PASSWORD` with your App Password (or regular password if no 2FA)

### Security Considerations

- **App Passwords are recommended** - They can be revoked without affecting your main account
- **Browser state is cached** - Reduces login frequency and Google security alerts
- **Browser state is NOT committed** - Listed in `.gitignore` as `playwright-state/`
- **Cookies are committed** - They only contain session data, not credentials
- **Session cookies expire** - Even if leaked, they expire within days

### Workflow Behavior

The `refresh-youtube-cookies.yml` workflow:
1. Uses Playwright to automate browser login
2. Caches browser state to avoid repeated logins
3. Extracts cookies to Netscape format
4. Creates a PR with updated cookies
5. Sends notification on failure

### Troubleshooting

#### "Login failed" errors
- Verify secrets are set correctly
- Check if Google blocked the login attempt (check Gmail for security alerts)
- Try generating a new App Password

#### "Cookies too small" errors
- The workflow verifies cookie file has >10 lines
- May indicate login succeeded but session wasn't established
- Try running the workflow again or extracting manually

#### Google Security Alerts
- Google may flag automated logins from new locations
- Check your Gmail for security notifications
- Approve the login if prompted
- Consider adding the GitHub Actions IP range to trusted locations

## Other Secrets

| Secret Name | Description | Used By |
|-------------|-------------|---------|
| `GITHUB_TOKEN` | Auto-provided by GitHub | All workflows |
| Various SOPS secrets | Encrypted in `secrets.enc.yaml` | Terraform deployment |

See `secrets.yaml.example` for the full list of SOPS-managed secrets.
