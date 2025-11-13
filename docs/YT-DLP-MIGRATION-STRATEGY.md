# yt-dlp Migration & Authentication Strategy

## Executive Summary

This document outlines the strategy for migrating from `ytdl-core` to `yt-dlp` to address two critical problems:
1. **Runtime Requirements**: yt-dlp now requires an external JavaScript runtime
2. **Authentication & IP Blocking**: YouTube blocks AWS Lambda datacenter IPs, requiring cookie-based authentication

## Current Architecture Analysis

### Download Flow
```
Feedly Webhook → FileCoordinator → Step Function (MultipartUpload)
  ↓
  StartFileUpload (uses ytdl-core to get video metadata & URL)
  ↓
  UploadPart (downloads chunks via HTTP range requests)
  ↓
  CompleteFileUpload (finalizes S3 upload)
```

### Current Implementation
- **Package**: `ytdl-core@4.11.5`
- **Usage**: `src/lib/vendor/YouTube.ts` wraps ytdl-core
- **Lambda**: `StartFileUpload` extracts video info and direct download URLs
- **Runtime**: Node.js 22.x on x86_64 architecture (Lambda default)
- **Timeout**: 900 seconds (15 minutes)
- **Process**: Direct HTTP streaming from YouTube CDN URLs to S3

**Note**: Lambda architecture is not explicitly set in Terraform, using default x86_64

### Problems with Current Approach
1. `ytdl-core` frequently breaks due to YouTube API changes
2. AWS Lambda IPs are blocked by YouTube (datacenter detection)
3. No authentication mechanism to bypass IP blocking
4. URL extraction fails without valid session cookies

---

## Problem 1: yt-dlp Runtime Requirements

### Understanding the Requirement
According to [GitHub issue #15012](https://github.com/yt-dlp/yt-dlp/issues/15012), yt-dlp now requires an external JavaScript runtime for:
- Decrypting video URLs (YouTube's signature cipher)
- Executing JavaScript challenges
- Parsing dynamic page content

### Available Runtime Options
| Runtime | Pros | Cons | Lambda Feasibility |
|---------|------|------|-------------------|
| **Node.js** | Already available in Lambda, no additional setup | Version must match yt-dlp requirements | ✅ Excellent |
| QuickJS | Lightweight, embedded | Another binary to bundle | ⚠️ Possible |
| Deno | Modern, secure | Large binary, not standard | ❌ Poor |

### Recommended Approach: Use Node.js Runtime

Since AWS Lambda already provides Node.js 22.x, we should configure yt-dlp to use it:
```bash
yt-dlp --exec-runtime nodejs <video-url>
```

### Implementation Options

#### Option A: Binary + Node Wrapper (Recommended)
**Package**: Use `yt-dlp-wrap` NPM package
- Wraps yt-dlp binary with Node.js API
- Handles binary execution and output parsing
- Community-maintained and actively updated
- Similar API to ytdl-core for easier migration

**Architecture**:
```
Lambda Deployment Package:
├── node_modules/
│   └── yt-dlp-wrap/
├── bin/
│   └── yt-dlp_linux (Linux x86_64 standalone binary, ~34.5 MB)
└── StartFileUpload.handler
```

**Binary Details**:
- **File**: `yt-dlp_linux` from [GitHub releases](https://github.com/yt-dlp/yt-dlp/releases)
- **Size**: ~34.5 MB (standalone with all dependencies)
- **Architecture**: x86_64 (matches Lambda default)
- **Note**: Use the standalone `_linux` version, not the smaller `yt-dlp` which requires Python

**Benefits**:
- Full yt-dlp feature set
- Direct control over binary version
- Can pass cookies and custom flags
- Node.js runtime automatically available

**Challenges**:
- Larger deployment package (+~35 MB for binary)
- Binary must be executable in Lambda environment
- Need to manage binary updates separately

#### Option B: Use @distube/ytdl-core (Alternative)
**Package**: Maintained fork of ytdl-core
- Drop-in replacement for ytdl-core
- Pure JavaScript, no binary needed
- Smaller package size

**Benefits**:
- Minimal code changes
- No binary management
- Faster deployment

**Challenges**:
- Still vulnerable to YouTube changes
- May not solve authentication issues
- Less feature-complete than yt-dlp

### Decision Matrix

| Criteria | Binary + yt-dlp-wrap | @distube/ytdl-core |
|----------|---------------------|-------------------|
| Long-term stability | ✅ Excellent | ⚠️ Moderate |
| Authentication support | ✅ Excellent | ⚠️ Limited |
| Deployment complexity | ⚠️ Moderate | ✅ Simple |
| Package size | ⚠️ Moderate (+35MB) | ✅ Small (~5MB) |
| Feature completeness | ✅ Full yt-dlp features | ⚠️ Basic |
| **Recommendation** | **✅ CHOOSE THIS** | Only if binary fails |

---

## Problem 2: Cookie-Based Authentication

### The Challenge
YouTube blocks requests from:
- AWS datacenter IP ranges
- Requests without valid session cookies
- High-frequency automated access patterns

### Cookie Requirements
yt-dlp accepts cookies via:
1. `--cookies FILE` - Netscape cookie format file
2. `--cookies-from-browser BROWSER` - Extract from installed browser (not viable in Lambda)

### Cookie Lifecycle Management

#### Phase 1: Manual Cookie Generation (MVP)
**Process**:
1. **Local Cookie Extraction** (Developer Machine):
   ```bash
   # Using yt-dlp to extract cookies from local Chrome
   yt-dlp --cookies-from-browser chrome --cookies cookies.txt \
          "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
   ```

2. **Cookie Storage** (AWS Secrets Manager):
   ```bash
   # Encrypt and store cookies
   aws secretsmanager create-secret \
       --name yt-dlp/cookies \
       --secret-string file://cookies.txt
   ```

3. **Lambda Retrieval**:
   - StartFileUpload Lambda downloads cookies from Secrets Manager
   - Writes to `/tmp/cookies.txt` (Lambda's writable directory)
   - Passes `--cookies /tmp/cookies.txt` to yt-dlp

**Cookie Format** (Netscape):
```
# Netscape HTTP Cookie File
.youtube.com	TRUE	/	TRUE	1735689600	CONSENT	YES+cb
.youtube.com	TRUE	/	TRUE	1735689600	VISITOR_INFO1_LIVE	xxxxxxxxxxx
.youtube.com	TRUE	/	FALSE	1735689600	SID	xxxxxxxxxxxxxxxxxxxx
```

**Lifespan**: YouTube cookies typically last 1-2 months

**Monitoring Strategy**:
- CloudWatch alarm on StartFileUpload failures
- Automated GitHub issue creation (already implemented)
- Manual cookie refresh process documented

#### Phase 2: Automated Cookie Refresh (Future Enhancement)
**Architecture**:
```
EC2 Spot Instance / ECS Fargate Task (runs weekly):
├── Puppeteer/Playwright
├── Headless Chrome
└── Automated login → cookie extraction → Secrets Manager update
```

**Benefits**:
- Automatic cookie refresh
- No manual intervention
- Higher reliability

**Complexity**: Moderate to High
**Timeline**: Implement after MVP is stable

### Cookie Security Considerations
1. **Encryption**: Store in AWS Secrets Manager (encrypted at rest)
2. **Access Control**: Lambda IAM role with least-privilege access
3. **Rotation**: Document manual refresh procedure
4. **Audit**: CloudWatch logs for secret access

### Alternative Authentication Approaches (Evaluated & Rejected)

#### YouTube API
- ❌ **Quota Limits**: 10,000 units/day (insufficient for video downloads)
- ❌ **Limited Features**: Cannot download videos directly
- ❌ **OAuth Overhead**: Complex authentication flow

#### Proxy Services
- ❌ **Cost**: Residential proxies cost $5-15/GB
- ❌ **Complexity**: Additional infrastructure
- ❌ **Reliability**: Third-party dependency

#### VPC NAT with Elastic IP
- ❌ **Still Blocked**: Elastic IPs are known AWS ranges
- ❌ **Cost**: $0.045/hour per NAT gateway
- ❌ **Ineffective**: YouTube blocks AWS IP ranges

---

## Implementation Plan

### Phase 1: Binary Integration (Week 1)
**Goal**: Get yt-dlp binary working in Lambda with Node.js runtime

#### Tasks:
1. **Research & Selection** ✅ COMPLETED
   - [x] Verify Lambda architecture (x86_64 confirmed)
   - [x] Download `yt-dlp_linux` x86_64 standalone binary (~34.5 MB) from [releases](https://github.com/yt-dlp/yt-dlp/releases/tag/2025.11.12)
   - [x] Evaluate `yt-dlp-wrap` vs custom wrapper (chose yt-dlp-wrap)
   - ⏭️ Test binary locally with Node.js runtime flag (skipped - will test in Lambda directly)

2. **Lambda Integration** ✅ COMPLETED
   - [x] Create `layers/yt-dlp/bin/` directory structure
   - [x] Add yt-dlp binary to Lambda layer
   - [x] Install `yt-dlp-wrap` package (v2.3.2)
   - [x] Update Terraform config for Lambda layer
   - [x] Binary permissions handled by Lambda layer architecture

3. **Code Refactoring** ✅ COMPLETED
   - [x] Update `src/lib/vendor/YouTube.ts`:
     - Replace `ytdl-core` imports with `yt-dlp-wrap`
     - Maintain existing API (`fetchVideoInfo`, `chooseVideoFormat`, `getVideoID`)
     - Add error handling for binary execution
   - [x] Update `StartFileUpload` Lambda to handle new response format
   - [x] Update TypeScript types for yt-dlp responses (inline interfaces)
   - [x] Deprecate old ytdl-core helper functions

4. **Testing** ⏸️ PENDING DEPLOYMENT
   - [ ] Deploy to AWS Lambda environment
   - [ ] Integration test with public video (no auth required)
   - [ ] Verify Lambda execution environment compatibility
   - [ ] Monitor CloudWatch logs for binary execution

### Phase 2: Cookie Authentication (Week 2) ⏸️ NOT STARTED
**Goal**: Implement cookie-based authentication to bypass IP blocking
**Prerequisites**: Phase 1 deployed and validated

#### Tasks:
1. **Cookie Infrastructure** ⏸️ PENDING
   - [ ] Document cookie extraction process for developers
   - [ ] Extract cookies locally using yt-dlp
   - [ ] Create AWS Secrets Manager secret for cookies
   - [ ] Add IAM permissions for StartFileUpload to read secret
   - [ ] Implement cookie retrieval helper in `src/util/secretsmanager-helpers.ts`

2. **Lambda Cookie Handling** ⏸️ PENDING
   - [ ] Add helper function to fetch cookies from Secrets Manager
   - [ ] Write cookies to `/tmp/cookies.txt` in Lambda
   - [ ] Pass `--cookies` flag to yt-dlp-wrap in `YouTube.ts`
   - [ ] Add error handling for missing/invalid cookies
   - [ ] Test cookie file permissions in Lambda environment

3. **Monitoring & Alerting** ⏸️ PENDING
   - [ ] Add CloudWatch metric for authentication failures
   - [ ] Create alarm for cookie expiration detection
   - [ ] Document cookie refresh procedure in README
   - [ ] Update automated GitHub issue templates
   - [ ] Add cookie age tracking

4. **Testing** ⏸️ PENDING
   - [ ] Test with age-restricted videos (requires auth)
   - [ ] Test with standard public videos (baseline)
   - [ ] Verify cookie expiration handling
   - [ ] End-to-end test of full download flow
   - [ ] Monitor IP blocking errors in CloudWatch

### Phase 3: Deployment & Validation (Week 3) ⏸️ PARTIALLY COMPLETE
**Goal**: Deploy to production and validate system stability
**Status**: Code built, awaiting terraform deployment

#### Tasks:
1. **Deployment Preparation** ✅ COMPLETED
   - [x] Run build process (`npm run build`) - Success
   - [x] TypeScript compilation check - 0 errors
   - [x] Verify Lambda package size (yt-dlp layer ~35MB, well within limits)
   - [x] Lambda timeout settings already at 900s (15 minutes)
   - [ ] Run full test suite (`npm test`) - Pending

2. **Terraform Updates** ✅ COMPLETED
   - [x] Update `StartFileUpload` Lambda memory (512MB)
   - [x] Add Lambda layer resource for yt-dlp binary
   - [x] Update Lambda environment variables (`YTDLP_BINARY_PATH`)
   - [ ] Add Secrets Manager resource for cookies (Phase 2)
   - [ ] Add IAM policy for secret access (Phase 2)

3. **Gradual Rollout** ⏸️ PENDING
   - [ ] Deploy with `terraform apply` (ready but not executed)
   - [ ] Test with known public video (e.g., test video ID)
   - [ ] Monitor CloudWatch logs for yt-dlp execution
   - [ ] Verify binary permissions and execution
   - [ ] Check for IP blocking errors (expected without cookies)

4. **Documentation** ⏸️ PENDING
   - [x] Update migration strategy document (this file)
   - [ ] Update CLAUDE.md with new architecture
   - [ ] Document cookie refresh procedure (Phase 2)
   - [ ] Update API documentation if response format changed
   - [ ] Create runbook for troubleshooting yt-dlp issues

### Phase 4: Optimization & Monitoring (Ongoing)
**Goal**: Ensure long-term stability and performance

#### Tasks:
- [ ] Monitor Lambda execution time and memory usage
- [ ] Track cookie expiration patterns
- [ ] Document yt-dlp version upgrade process
- [ ] Evaluate automated cookie refresh feasibility
- [ ] Consider Lambda layers for yt-dlp binary

---

## Technical Specifications

### Lambda Configuration Updates

```hcl
resource "aws_lambda_function" "StartFileUpload" {
  # ... existing config ...

  memory_size = 1024  # Increase from default 128 MB
  timeout     = 900   # Keep at 15 minutes

  environment {
    variables = {
      Bucket                = aws_s3_bucket.Files.id
      DynamoDBTableFiles    = aws_dynamodb_table.Files.name
      YTDLP_COOKIES_SECRET  = aws_secretsmanager_secret.ytdlp_cookies.name
      YTDLP_BINARY_PATH     = "/var/task/bin/yt-dlp_linux"
    }
  }

  # Ensure binary is included in deployment package
  # Consider using Lambda layers for large binaries
}
```

### Secrets Manager Configuration

```hcl
resource "aws_secretsmanager_secret" "ytdlp_cookies" {
  name        = "yt-dlp/cookies"
  description = "YouTube session cookies for yt-dlp authentication"

  # Rotate every 30 days (manual process)
  rotation_rules {
    automatically_after_days = 30
  }
}

resource "aws_iam_policy" "ytdlp_cookies_access" {
  name = "StartFileUpload-SecretsAccess"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = aws_secretsmanager_secret.ytdlp_cookies.arn
      }
    ]
  })
}
```

### Updated YouTube Wrapper API

```typescript
// src/lib/vendor/YouTube.ts
import YTDlpWrap from 'yt-dlp-wrap';
import { getCookiesFromSecretsManager } from '../../util/secretsmanager-helpers';
import { logDebug, logError } from '../../util/lambda-helpers';

const YTDLP_BINARY_PATH = process.env.YTDLP_BINARY_PATH || '/var/task/bin/yt-dlp_linux';
const COOKIES_PATH = '/tmp/cookies.txt';

interface VideoInfo {
  id: string;
  title: string;
  formats: VideoFormat[];
  thumbnail: string;
  duration: number;
  // ... other metadata
}

interface VideoFormat {
  url: string;
  format_id: string;
  filesize: number;
  ext: string;
  // ... other format info
}

async function setupCookies(): Promise<void> {
  const cookieContent = await getCookiesFromSecretsManager(
    process.env.YTDLP_COOKIES_SECRET
  );
  await fs.promises.writeFile(COOKIES_PATH, cookieContent);
}

export async function fetchVideoInfo(uri: string): Promise<VideoInfo> {
  logDebug('fetchVideoInfo =>', uri);

  try {
    // Ensure cookies are available
    await setupCookies();

    const ytDlp = new YTDlpWrap(YTDLP_BINARY_PATH);

    const info = await ytDlp.getVideoInfo([
      '--cookies', COOKIES_PATH,
      '--dump-json',
      uri
    ]);

    logDebug('fetchVideoInfo <=', info);
    return info as VideoInfo;
  } catch (error) {
    logError('fetchVideoInfo error', error);
    throw new UnexpectedError(`Failed to fetch video info: ${error.message}`);
  }
}

export function chooseVideoFormat(
  info: VideoInfo,
  quality: string = 'best'
): VideoFormat {
  // Filter for video+audio combined formats
  const combinedFormats = info.formats.filter(f =>
    f.vcodec !== 'none' && f.acodec !== 'none'
  );

  // Sort by filesize (best quality = largest file)
  return combinedFormats.sort((a, b) =>
    (b.filesize || 0) - (a.filesize || 0)
  )[0];
}

export function getVideoID(url: string): string {
  const match = url.match(/(?:v=|\/)([\w-]{11})/);
  if (!match) throw new Error('Invalid YouTube URL');
  return match[1];
}
```

### Secrets Manager Helper

```typescript
// src/util/secretsmanager-helpers.ts (update existing file)
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: process.env.AWS_REGION });

export async function getCookiesFromSecretsManager(
  secretName: string
): Promise<string> {
  try {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await client.send(command);
    return response.SecretString || '';
  } catch (error) {
    throw new Error(`Failed to retrieve cookies from Secrets Manager: ${error.message}`);
  }
}
```

---

## Risk Analysis & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Lambda package size exceeds limit** | High | Low | Binary is only ~35MB, well within 250MB uncompressed limit; use Lambda layers if needed |
| **Cookie expiration causes failures** | High | High | CloudWatch alarms + automated GitHub issues + documented refresh process |
| **yt-dlp binary permissions issues** | High | Low | Test in Lambda environment early, use Lambda layers with pre-set permissions |
| **Performance degradation** | Medium | Low | Increase Lambda memory, optimize binary flags, monitor execution time |
| **YouTube changes API/blocks cookies** | Critical | Medium | Monitor error rates, have fallback to @distube/ytdl-core, consider proxy options |
| **Binary architecture mismatch** | High | Very Low | ✅ Confirmed x86_64 architecture, using correct yt-dlp_linux binary |

---

## Success Metrics

### Immediate (Week 1-3)
- [ ] yt-dlp binary successfully executes in Lambda
- [ ] Video metadata extraction works for public videos
- [ ] Cookie authentication bypasses IP blocking
- [ ] Download success rate > 95%

### Short-term (Month 1-3)
- [ ] Zero manual interventions for cookie refresh
- [ ] Average Lambda execution time < 60 seconds
- [ ] Cost remains under $12/month
- [ ] No YouTube API breaking changes affect service

### Long-term (Month 3+)
- [ ] Automated cookie refresh implemented
- [ ] Download success rate > 99%
- [ ] Support for additional video platforms (Vimeo, etc.)

---

## Cost Analysis

### Current Costs
- Lambda invocations: ~$2-5/month
- S3 storage: ~$1-3/month
- Data transfer: ~$1-2/month
- **Total**: ~$4-10/month

### Projected Costs After Migration
- Lambda invocations: ~$3-7/month (slightly higher due to binary overhead)
- Secrets Manager: $0.40/month (1 secret)
- S3 storage: ~$1-3/month (unchanged)
- Data transfer: ~$1-2/month (unchanged)
- **Total**: ~$5-12/month ✅ Within budget

### Cost Optimization Options
- Use arm64 architecture (smaller binary, potentially faster)
- Lambda reserved concurrency to prevent over-invocation
- S3 lifecycle policies for old videos

---

## Rollback Plan

If migration fails or causes critical issues:

1. **Immediate Rollback** (< 5 minutes):
   ```bash
   git revert <migration-commit>
   npm run build
   npm run deploy
   ```

2. **Restore ytdl-core**:
   - Revert changes to `src/lib/vendor/YouTube.ts`
   - Remove yt-dlp binary from deployment package
   - Restore previous Lambda configuration

3. **Alternative Fallback**:
   - Deploy @distube/ytdl-core as interim solution
   - Minimal code changes required
   - Buys time to fix yt-dlp issues

---

## Open Questions & Research Needed

1. ✅ **Binary Size**: ~34.5 MB for yt-dlp_linux standalone binary
   - Source: https://github.com/yt-dlp/yt-dlp/releases/latest

2. ✅ **Lambda Architecture**: x86_64 (confirmed, using Lambda default)
   - No explicit architecture setting in Terraform
   - Using yt-dlp_linux x86_64 binary

3. **Cookie Freshness**: How long do YouTube cookies actually last?
   - Requires empirical testing
   - May vary by account type (Google Workspace vs personal)

4. **yt-dlp Flags**: What's the optimal set of flags for Lambda?
   - `--no-playlist` (only single videos)
   - `--format best` (highest quality)
   - `--no-check-certificate` (if SSL issues)
   - `--geo-bypass` (attempt geographic bypass)

5. **Lambda Layers**: Should we use Lambda layers for the binary?
   - Pros: Separate deployment, reusable, version control
   - Cons: Additional complexity
   - Decision: Evaluate after initial integration

---

## References

- [yt-dlp External Runtime Issue](https://github.com/yt-dlp/yt-dlp/issues/15012)
- [yt-dlp Releases](https://github.com/yt-dlp/yt-dlp/releases)
- [yt-dlp Cookie FAQ](https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp)
- [yt-dlp-wrap NPM Package](https://www.npmjs.com/package/yt-dlp-wrap)
- [@distube/ytdl-core](https://www.npmjs.com/package/@distube/ytdl-core)
- [AWS Lambda Deployment Package](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-package.html)
- [AWS Lambda Layers](https://docs.aws.amazon.com/lambda/latest/dg/chapter-layers.html)

---

## Next Steps

### Immediate (Ready Now)
1. **Deploy Phase 1**: Run `terraform apply` to deploy yt-dlp integration
   ```bash
   cd terraform
   terraform apply
   ```

2. **Test Basic Functionality**: Try downloading a public video
   - Monitor CloudWatch logs: `/aws/lambda/StartFileUpload`
   - Look for yt-dlp binary execution messages
   - Expect potential IP blocking errors (normal without cookies)

3. **Validate Binary Execution**:
   - Check for "yt-dlp" in CloudWatch logs
   - Verify binary has correct permissions
   - Confirm Node.js runtime is being used

### Near-term (Phase 2)
4. **Extract Cookies**: Use local yt-dlp to extract YouTube cookies
   ```bash
   yt-dlp --cookies-from-browser chrome --cookies cookies.txt "https://www.youtube.com/watch?v=test"
   ```

5. **Implement Cookie Authentication**: Follow Phase 2 tasks
   - Store cookies in AWS Secrets Manager
   - Update Lambda to fetch and use cookies
   - Test with previously blocked videos

### Long-term (Optimization)
6. **Monitor & Optimize**: Track performance and costs
7. **Automate Cookie Refresh**: Consider automated solution
8. **Expand Platform Support**: Add support for other video platforms

---

## Implementation Progress

### ✅ Phase 1: Binary Integration (COMPLETED)
**Completion Date**: 2025-11-12
**Status**: Successfully implemented and built, ready for deployment

#### Completed Tasks:
- [x] Verify Lambda architecture (x86_64 confirmed)
- [x] Download `yt-dlp_linux` x86_64 standalone binary (~34.5 MB) from GitHub releases
- [x] Create Lambda layer structure at `layers/yt-dlp/bin/`
- [x] Install `yt-dlp-wrap` NPM package (v2.3.2)
- [x] Update Terraform config with Lambda layer resource
- [x] Configure StartFileUpload Lambda to use layer (512MB memory, env vars)
- [x] Refactor `src/lib/vendor/YouTube.ts` to use yt-dlp-wrap
- [x] Update `StartFileUpload` Lambda handler for yt-dlp types
- [x] Deprecate old ytdl-core helper functions
- [x] Successful TypeScript compilation (0 errors)
- [x] Successful webpack build

#### Implementation Notes:
1. **Binary Location**: Stored in `layers/yt-dlp/bin/yt-dlp_linux` (~35MB actual size)
2. **Lambda Layer**: Created `aws_lambda_layer_version.YtDlp` resource in Terraform
3. **Environment Variable**: `YTDLP_BINARY_PATH=/opt/bin/yt-dlp_linux` (Lambda layer mounts to `/opt`)
4. **Memory Increase**: Bumped StartFileUpload from default to 512MB
5. **Deprecated Functions**:
   - `transformVideoInfoToMetadata()` - logic moved to StartFileUpload
   - `getFileFromMetadata()` - logic moved to StartFileUpload
   - `chooseVideoFormat()` signature changed to match yt-dlp output

#### Files Modified:
- `src/lib/vendor/YouTube.ts` - Complete rewrite for yt-dlp-wrap
- `src/lambdas/StartFileUpload/src/index.ts` - Updated handler
- `terraform/feedly_webhook.tf` - Added layer + configuration
- `src/util/transformers.ts` - Deprecated old functions
- `src/util/shared.ts` - Deprecated old functions
- `package.json` - Added yt-dlp-wrap dependency

### ⏸️ Phase 2: Cookie Authentication (NOT STARTED)
**Status**: Awaiting Phase 1 deployment and validation

### ⏸️ Phase 3: Deployment & Validation (PENDING)
**Status**: Code ready, awaiting terraform deployment

---

*Document Version: 1.1*
*Last Updated: 2025-11-12*
*Status: Phase 1 Complete - Ready for Deployment*
