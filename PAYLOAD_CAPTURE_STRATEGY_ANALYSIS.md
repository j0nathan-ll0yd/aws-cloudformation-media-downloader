# Payload Capture & Testing Strategy Analysis

## Executive Summary

**Problem**: Need to capture and retain payloads sent to/within the service for documentation and testing purposes. Current test fixtures are manually maintained and become stale. No ability to replay production scenarios for debugging or testing.

**Recommendation**: **Hybrid approach** combining enhanced logging with automated fixture generation (Phase 1) followed by selective EventBridge migration for internal events (Phase 2). This maximizes value while minimizing complexity and aligns with existing architecture.

**Expected Impact**:
- Eliminate manual fixture maintenance (saves ~2 hours/month)
- Enable production scenario replay for debugging
- Auto-generate API documentation from real usage
- Reduce test fixture staleness from weeks/months to days
- Foundation for event-driven architecture expansion

---

## Current State Assessment

### What's Already Captured

**API Gateway (External Entry Points)**:
- ✅ **Full request/response logging enabled** (`data_trace_enabled = true`, `logging_level = "INFO"`)
- ✅ Captures: HTTP headers, query params, request body, response body, latency
- ✅ Stored in CloudWatch Logs: `/aws/api-gateway/OfflineMediaDownloader`
- ✅ Retention: 30 days (CloudWatch default, could extend or archive to S3)

**Lambda Functions (Internal Processing)**:
- ⚠️ **Partial logging**: Custom `logInfo()`/`logDebug()` calls throughout handlers
- ⚠️ Captures: Selected inputs/outputs, not comprehensive
- ⚠️ Lambda-to-Lambda invocations: Only status codes logged, not full payloads
- ⚠️ Stored in CloudWatch Logs: `/aws/lambda/{FunctionName}`

**What's Missing**:
- ❌ Automatic capture of internal Lambda-to-Lambda payloads
- ❌ Structured event schema enforcement
- ❌ Ability to replay production events
- ❌ Automated test fixture generation from production data
- ❌ API contract documentation synchronized with reality

### Current Test Fixtures (Manual)

**Location**: `src/lambdas/*/test/fixtures/*.json`

**Examples**:
- `WebhookFeedly/test/fixtures/APIGatewayEvent.json` - Feedly webhook request
- `ListFiles/test/fixtures/batchGet-200-OK.json` - DynamoDB batch get response
- `RegisterDevice/test/fixtures/apiRequest-POST-device.json` - Device registration request

**Maintenance Burden**:
- Manual creation when API changes
- Manual updates when upstream services change (YouTube, Feedly, Apple)
- Risk of staleness (fixtures may not match current API contracts)
- No validation that fixtures represent real production scenarios

---

## The Core Problems

### Problem 1: Test Fixture Staleness
**Current**: Hand-crafted JSON fixtures can drift from reality over time
**Impact**: Tests pass but don't reflect actual API behavior
**Example**: Feedly webhook payload structure changes, tests still use old fixture

### Problem 2: No Production Replay Capability
**Current**: Can't reproduce production issues in dev/test environments
**Impact**: Difficult debugging, "works in dev but fails in prod" scenarios
**Example**: Video download fails for specific YouTube URL, can't replay exact payload

### Problem 3: Internal Event Opacity
**Current**: Lambda-to-Lambda calls (`initiateFileDownload`) only log status codes
**Impact**: Can't see full payloads flowing between services
**Example**: FileCoordinator → StartFileUpload invocation payload not retained

### Problem 4: Documentation Drift
**Current**: No single source of truth for API contracts
**Impact**: API documentation in README may not match actual behavior
**Example**: API accepts additional fields not documented, or documented fields no longer used

### Problem 5: Manual Testing Required for Integration Changes
**Current**: Must manually test against production/staging to verify API changes
**Impact**: Slow feedback loop, risk of breaking changes
**Example**: Changing Feedly webhook handler requires manual webhook trigger from Feedly

---

## Solution Approaches

## Approach 1: Enhanced Logging + Automated Fixture Generation

### Overview
Leverage existing API Gateway logging and enhance Lambda logging to capture all payloads. Build tooling to extract, sanitize, and convert CloudWatch Logs into test fixtures.

### Architecture

```
Production Request Flow:
  External API Call (Feedly)
         ↓
  API Gateway (logs full request/response)
         ↓
  Lambda Handler (enhanced logging of all inputs/outputs)
         ↓
  CloudWatch Logs

Development Flow:
  CloudWatch Logs
         ↓
  Extraction Script (sanitize sensitive data)
         ↓
  S3 Archive (long-term storage)
         ↓
  Fixture Generator (creates Jest fixtures)
         ↓
  `test/fixtures/*.json` (auto-updated in git)
```

### Implementation

**Phase 1: Enhanced Lambda Logging**

Add structured logging to capture complete payloads:

```typescript
// util/lambda-helpers.ts - New function
export function logPayload(direction: 'input' | 'output', name: string, payload: unknown) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    direction,
    name,
    payload: JSON.stringify(payload),
    payloadType: typeof payload
  }
  console.log(`PAYLOAD_CAPTURE: ${JSON.stringify(logEntry)}`)
}

// Usage in handler
export const handler = async (event: APIGatewayEvent) => {
  logPayload('input', 'WebhookFeedly.event', event)

  const result = await processWebhook(event)

  logPayload('output', 'WebhookFeedly.result', result)
  return result
}
```

**Phase 2: Log Extraction Script**

```bash
#!/bin/bash
# bin/extract-payloads.sh

# Extract payloads from CloudWatch Logs for last 7 days
aws logs filter-log-events \
  --log-group-name "/aws/lambda/WebhookFeedly" \
  --start-time $(date -v-7d +%s000) \
  --filter-pattern "PAYLOAD_CAPTURE" \
  --output json > /tmp/raw_payloads.json

# Sanitize sensitive data (API keys, user IDs, etc.)
node bin/sanitize-payloads.js /tmp/raw_payloads.json /tmp/sanitized_payloads.json

# Archive to S3 for long-term retention
aws s3 cp /tmp/sanitized_payloads.json \
  s3://offline-media-downloader-payload-archive/$(date +%Y-%m-%d)/payloads.json
```

**Phase 3: Fixture Generator**

```javascript
// bin/generate-fixtures.js
const fs = require('fs')
const payloads = JSON.parse(fs.readFileSync('/tmp/sanitized_payloads.json'))

// Group payloads by function and scenario
const fixtures = {}
payloads.forEach(entry => {
  const {name, payload, direction} = entry
  const [functionName, scenario] = name.split('.')

  if (!fixtures[functionName]) fixtures[functionName] = {}
  fixtures[functionName][`${scenario}-${direction}.json`] = JSON.parse(payload)
})

// Write to test/fixtures directories
Object.entries(fixtures).forEach(([func, scenarios]) => {
  Object.entries(scenarios).forEach(([filename, content]) => {
    const path = `src/lambdas/${func}/test/fixtures/${filename}`
    fs.writeFileSync(path, JSON.stringify(content, null, 2))
  })
})

console.log('✅ Test fixtures updated from production payloads')
```

**Phase 4: OpenAPI Spec Generation**

```typescript
// bin/generate-openapi-spec.ts
import {CloudWatchLogsClient, FilterLogEventsCommand} from '@aws-sdk/client-cloudwatch-logs'

// Extract all API Gateway requests from logs
// Analyze request/response patterns
// Generate OpenAPI 3.0 spec

const spec = {
  openapi: '3.0.0',
  info: {
    title: 'Offline Media Downloader API',
    version: '1.0.0',
    description: 'Auto-generated from production API usage'
  },
  paths: {
    '/webhook': {
      post: {
        summary: 'Feedly webhook receiver',
        requestBody: {
          content: {
            'application/json': {
              schema: inferSchemaFromPayloads(webhookPayloads),
              example: sanitizedExamplePayload
            }
          }
        },
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: inferSchemaFromPayloads(webhookResponses)
              }
            }
          }
        }
      }
    }
  }
}
```

### Pros
- ✅ **Low complexity**: Builds on existing logging infrastructure
- ✅ **Real production data**: Fixtures represent actual usage patterns
- ✅ **No architectural changes**: Works with current Lambda invocation pattern
- ✅ **API documentation sync**: OpenAPI spec generated from reality
- ✅ **Privacy controls**: Sanitization step removes sensitive data
- ✅ **Version controlled**: Fixtures committed to git, reviewable in PRs
- ✅ **Low cost**: Only CloudWatch Logs + S3 storage ($5-10/month)

### Cons
- ⚠️ **No replay capability**: Can't re-execute production events
- ⚠️ **Internal events partial**: Lambda-to-Lambda calls need enhanced logging
- ⚠️ **Manual execution**: Scripts need to be run periodically (could automate with cron/EventBridge Scheduler)
- ⚠️ **Snapshot in time**: Fixtures are point-in-time, not continuously updated
- ⚠️ **Sanitization complexity**: Need to identify and redact all sensitive fields

### Cost Estimate
- CloudWatch Logs ingestion: Already paying (no change)
- S3 archive storage: $0.023/GB/month × ~1GB/year = $0.02/month
- Lambda for fixture generation: Free tier covers it
- **Total: ~$0.25/month additional**

---

## Approach 2: EventBridge Migration for Event Sourcing

### Overview
Migrate Lambda-to-Lambda invocations to EventBridge. Enable EventBridge Archive to capture all events. Use EventBridge Replay to reproduce production scenarios in test environments.

### Architecture

```
Current Flow:
  WebhookFeedly Lambda
         ↓ (direct invoke)
  FileCoordinator Lambda
         ↓ (direct invoke)
  StartFileUpload Lambda

EventBridge Flow:
  WebhookFeedly Lambda → EventBridge Event: "FileRequested"
                               ↓ (archived)
                         FileCoordinator Lambda → EventBridge Event: "FileDownloadInitiated"
                                                        ↓ (archived)
                                                  StartFileUpload Lambda

  Archive Store (S3-backed)
         ↓ (replay)
  Test Environment (identical flow, different targets)
```

### Implementation

**Phase 1: Define Event Schemas**

```typescript
// types/events.ts
export interface FileRequestedEvent {
  version: '1.0',
  source: 'aws.offlinemediadownloader',
  'detail-type': 'FileRequested',
  detail: {
    fileId: string,
    userId: string,
    articleURL: string,
    requestedAt: string
  }
}

export interface FileDownloadInitiatedEvent {
  version: '1.0',
  source: 'aws.offlinemediadownloader',
  'detail-type': 'FileDownloadInitiated',
  detail: {
    fileId: string,
    initiatedAt: string,
    status: 'queued'
  }
}
```

**Phase 2: Create EventBridge Bus & Rules**

```hcl
# terraform/eventbridge.tf

resource "aws_cloudwatch_event_bus" "MediaDownloader" {
  name = "MediaDownloaderBus"
}

resource "aws_cloudwatch_event_archive" "MediaDownloader" {
  name             = "MediaDownloaderArchive"
  event_source_arn = aws_cloudwatch_event_bus.MediaDownloader.arn
  retention_days   = 365  # 1 year retention

  event_pattern = jsonencode({
    source = ["aws.offlinemediadownloader"]
  })
}

resource "aws_cloudwatch_event_rule" "FileRequested" {
  name           = "FileRequested"
  event_bus_name = aws_cloudwatch_event_bus.MediaDownloader.name

  event_pattern = jsonencode({
    source      = ["aws.offlinemediadownloader"],
    detail-type = ["FileRequested"]
  })
}

resource "aws_cloudwatch_event_target" "FileRequestedToFileCoordinator" {
  rule           = aws_cloudwatch_event_rule.FileRequested.name
  event_bus_name = aws_cloudwatch_event_bus.MediaDownloader.name
  arn            = aws_lambda_function.FileCoordinator.arn
}
```

**Phase 3: Migrate Lambda Invocations to Events**

```typescript
// util/shared.ts - Replace direct Lambda invoke with EventBridge

// OLD:
export async function initiateFileDownload(fileId: string) {
  const result = await invokeAsync('StartFileUpload', {fileId})
  logDebug('initiateFileDownload =>', result)
}

// NEW:
import {putEvent} from '../lib/vendor/AWS/EventBridge'

export async function initiateFileDownload(fileId: string, userId: string, articleURL: string) {
  const event: FileRequestedEvent = {
    version: '1.0',
    source: 'aws.offlinemediadownloader',
    'detail-type': 'FileRequested',
    detail: {
      fileId,
      userId,
      articleURL,
      requestedAt: new Date().toISOString()
    }
  }

  const result = await putEvent('MediaDownloaderBus', event)
  logDebug('initiateFileDownload =>', result)
}
```

**Phase 4: Enable Replay for Testing**

```bash
#!/bin/bash
# bin/replay-production-events.sh

# Replay last 24 hours of FileRequested events to test environment
aws events start-replay \
  --replay-name "test-replay-$(date +%s)" \
  --event-source-arn "arn:aws:events:us-west-2:ACCOUNT:archive/MediaDownloaderArchive" \
  --event-start-time $(date -v-24H +%s) \
  --event-end-time $(date +%s) \
  --destination '{
    "Arn": "arn:aws:events:us-west-2:ACCOUNT:event-bus/MediaDownloaderBus-Test",
    "FilterArns": ["arn:aws:events:us-west-2:ACCOUNT:rule/MediaDownloaderBus-Test/FileRequested"]
  }'
```

**Phase 5: Schema Registry (Optional)**

```hcl
resource "aws_schemas_registry" "MediaDownloader" {
  name        = "MediaDownloader"
  description = "Event schemas for media downloader service"
}

resource "aws_schemas_schema" "FileRequested" {
  name          = "FileRequested"
  registry_name = aws_schemas_registry.MediaDownloader.name
  type          = "OpenApi3"

  content = jsonencode({
    openapi = "3.0.0"
    info = {
      version = "1.0.0"
      title   = "FileRequested"
    }
    paths = {}
    components = {
      schemas = {
        FileRequestedEvent = {
          type = "object"
          required = ["version", "source", "detail-type", "detail"]
          properties = {
            version = {type = "string"}
            source = {type = "string"}
            detail-type = {type = "string"}
            detail = {
              type = "object"
              required = ["fileId", "userId", "articleURL", "requestedAt"]
              properties = {
                fileId = {type = "string"}
                userId = {type = "string", format = "uuid"}
                articleURL = {type = "string", format = "uri"}
                requestedAt = {type = "string", format = "date-time"}
              }
            }
          }
        }
      }
    }
  })
}
```

### Pros
- ✅ **Full replay capability**: Re-execute exact production events in test environment
- ✅ **Event sourcing foundation**: Can rebuild state from event history
- ✅ **Decoupling**: Lambdas don't directly call each other, easier to add new consumers
- ✅ **Schema enforcement**: EventBridge Schema Registry validates event structure
- ✅ **Automatic documentation**: Schema Registry generates docs
- ✅ **Long-term retention**: Archive events for up to 10 years
- ✅ **Filtering**: Replay specific event types or time ranges
- ✅ **Dead letter queue**: Built-in DLQ for failed event processing

### Cons
- ⚠️ **Architectural migration**: Significant code changes to replace Lambda invokes with events
- ⚠️ **Eventual consistency**: Events are asynchronous, harder to reason about
- ⚠️ **Payload size limit**: EventBridge max payload is 256KB (may not fit large video metadata)
- ⚠️ **Testing complexity**: Need to mock EventBridge in unit tests
- ⚠️ **Debugging overhead**: Event-driven systems harder to debug (need correlation IDs)
- ⚠️ **Cost increase**: EventBridge charges per event ($1/million, likely ~$5/month at current scale)
- ⚠️ **Migration risk**: High-impact change, risk of breaking existing functionality

### Cost Estimate
- EventBridge events: $1/million × 100/month = $0.0001/month
- EventBridge Archive: $0.023/GB/month × ~0.1GB = $0.0023/month
- EventBridge Replay: $0.02 per GB replayed × ~5 replays/month × 0.1GB = $0.01/month
- Schema Registry: Free tier covers it
- **Total: ~$1/month (minimal, mostly from potential future scaling)**

---

## Approach 3: Contract Testing with Pact/OpenAPI

### Overview
Define API contracts using OpenAPI specifications. Use contract testing frameworks (Pact) to ensure both provider (API) and consumer (iOS app, Feedly webhook) adhere to contracts. Generate mock servers from contracts for testing.

### Architecture

```
Contract Definition (OpenAPI spec)
         ↓
Provider Tests (Lambda functions must match contract)
         ↓
Consumer Tests (iOS app, Feedly must match contract)
         ↓
Contract Verification (CI/CD fails if mismatch)

Mock Server (Prism) ← Generated from OpenAPI spec
         ↓
Integration Tests (use mock server instead of real API)
```

### Implementation

**Phase 1: Define OpenAPI Contracts**

```yaml
# contracts/webhook-feedly.openapi.yaml
openapi: 3.0.0
info:
  title: Feedly Webhook API
  version: 1.0.0

paths:
  /webhook:
    post:
      summary: Receive Feedly webhook
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/FeedlyWebhook'
            example:
              articleURL: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/WebhookResponse'

components:
  schemas:
    FeedlyWebhook:
      type: object
      required:
        - articleURL
      properties:
        articleURL:
          type: string
          format: uri
          pattern: '^https://www\.youtube\.com/watch\?v=.*'

    WebhookResponse:
      type: object
      required:
        - success
        - fileId
      properties:
        success:
          type: boolean
        fileId:
          type: string
```

**Phase 2: Provider Tests (Lambda validation)**

```typescript
// src/lambdas/WebhookFeedly/test/contract.test.ts
import {Verifier} from '@pact-foundation/pact'
import {handler} from '../src/index'

describe('WebhookFeedly Contract Tests', () => {
  it('matches the provider contract', async () => {
    const verifier = new Verifier({
      providerBaseUrl: 'http://localhost:3000',  // Local API Gateway mock
      provider: 'WebhookFeedlyAPI',
      pactUrls: ['./contracts/webhook-feedly.openapi.yaml'],
      stateHandlers: {
        'file does not exist': async () => {
          // Setup: Empty DynamoDB table
        },
        'file already exists': async () => {
          // Setup: Pre-populate DynamoDB
        }
      }
    })

    await verifier.verifyProvider()
  })
})
```

**Phase 3: Consumer Tests (iOS App validation)**

```swift
// iOS App: OfflineMediaDownloaderTests/WebhookContractTests.swift
import PactSwift

class WebhookContractTests: XCTestCase {
  func testFeedlyWebhookContract() {
    let mockService = MockService(consumer: "iOSApp", provider: "WebhookFeedlyAPI")

    let interaction = Interaction(
      description: "Request to trigger video download",
      providerState: "file does not exist",
      request: .POST(
        path: "/webhook",
        headers: ["Content-Type": "application/json"],
        body: ["articleURL": "https://www.youtube.com/watch?v=test123"]
      ),
      response: .success(
        status: 200,
        body: ["success": true, "fileId": "test123"]
      )
    )

    mockService.uponReceiving(interaction)
    mockService.run { baseUrl in
      // Test iOS app makes correct request
      let client = WebhookClient(baseURL: baseUrl)
      let result = client.triggerDownload(url: "https://www.youtube.com/watch?v=test123")
      XCTAssertTrue(result.success)
    }
  }
}
```

**Phase 4: Mock Server for Integration Tests**

```bash
# Use Prism to generate mock API server from OpenAPI spec
npx @stoplight/prism-cli mock contracts/webhook-feedly.openapi.yaml --port 4010

# Integration tests hit mock server instead of real API
export API_BASE_URL=http://localhost:4010
npm run test:integration
```

**Phase 5: Contract Validation in CI/CD**

```yaml
# .github/workflows/contract-tests.yml
name: Contract Tests

on: [push, pull_request]

jobs:
  contract-validation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Validate OpenAPI Specs
        run: |
          npm install -g @stoplight/spectral-cli
          spectral lint contracts/*.openapi.yaml

      - name: Run Provider Contract Tests
        run: npm run test:contract:provider

      - name: Publish Contracts to Pact Broker
        run: |
          npx pact-broker publish ./pacts \
            --consumer-app-version=$GITHUB_SHA \
            --broker-base-url=$PACT_BROKER_URL \
            --broker-token=$PACT_BROKER_TOKEN
```

### Pros
- ✅ **Consumer-driven**: iOS app defines what it needs, backend implements it
- ✅ **Contract enforcement**: Breaking changes caught in CI/CD before deployment
- ✅ **Documentation**: OpenAPI specs are living documentation
- ✅ **Mock servers**: Can develop iOS app without backend running
- ✅ **API versioning**: Explicit versioning in contracts
- ✅ **Cross-team coordination**: Contracts are shared artifact between teams (even if one team)
- ✅ **Tooling ecosystem**: OpenAPI has rich tooling (Swagger UI, code generators, validators)

### Cons
- ⚠️ **Maintenance burden**: Contracts must be kept in sync with code
- ⚠️ **Learning curve**: Pact has complex setup and concepts
- ⚠️ **Not production payloads**: Contracts are idealized, may not match real usage
- ⚠️ **Bi-directional testing**: Need both provider and consumer tests
- ⚠️ **Internal events not covered**: Only works for external API boundaries
- ⚠️ **Pact Broker needed**: Requires additional infrastructure (hosted or self-hosted)
- ⚠️ **No replay capability**: Can't reproduce production scenarios

### Cost Estimate
- Pact Broker (hosted): $0 (self-host) or $30/month (Pactflow SaaS)
- Prism mock server: Free (runs locally or in CI)
- CI/CD time increase: ~2 minutes per build (negligible cost)
- **Total: $0/month (self-hosted) or $30/month (SaaS)**

---

## Approach 4: Hybrid Strategy (RECOMMENDED)

### Overview
Combine the strengths of multiple approaches in a phased rollout:
1. **Phase 1 (Immediate)**: Enhanced logging + automated fixture generation
2. **Phase 2 (3-6 months)**: Selective EventBridge migration for critical paths
3. **Phase 3 (Optional)**: Contract testing for iOS app integration

### Why Hybrid?

**Maximizes Value**:
- Get immediate benefits from automated fixtures (Phase 1)
- Add replay capability incrementally (Phase 2)
- Defer contract testing until iOS app needs it (Phase 3)

**Minimizes Risk**:
- Low-risk logging changes first
- High-impact EventBridge migration only where needed
- Can abandon later phases if ROI not there

**Aligns with Architecture**:
- Logging builds on existing infrastructure
- EventBridge fits event-driven nature of media download pipeline
- Contract testing adds value for external integrations

### Detailed Implementation Plan

## Phase 1: Enhanced Logging + Automated Fixtures (4-6 hours)

**Goal**: Eliminate manual fixture maintenance, auto-generate from production

**Tasks**:

1. **Add structured payload logging** (2 hours)
   - [ ] Create `logPayload()` helper in `util/lambda-helpers.ts`
   - [ ] Add input/output logging to all API Gateway handlers:
     - [ ] WebhookFeedly
     - [ ] ListFiles
     - [ ] RegisterDevice
     - [ ] RegisterUser
     - [ ] LoginUser
   - [ ] Add input/output logging to internal Lambda calls:
     - [ ] FileCoordinator
     - [ ] StartFileUpload
   - [ ] Test locally with `npm run test`

2. **Create extraction scripts** (2 hours)
   - [ ] Write `bin/extract-payloads.sh` (CloudWatch Logs → JSON)
   - [ ] Write `bin/sanitize-payloads.js` (remove sensitive data)
   - [ ] Write `bin/generate-fixtures.js` (JSON → test fixtures)
   - [ ] Test extraction on staging environment

3. **Setup S3 archive** (30 minutes)
   - [ ] Create S3 bucket: `offline-media-downloader-payload-archive`
   - [ ] Enable versioning and lifecycle policy (transition to Glacier after 90 days)
   - [ ] Update extraction script to archive to S3

4. **Generate OpenAPI spec** (1.5 hours)
   - [ ] Write `bin/generate-openapi-spec.ts`
   - [ ] Run against production logs
   - [ ] Review generated spec for accuracy
   - [ ] Commit to `docs/api/openapi.yaml`
   - [ ] Setup Swagger UI for human-readable docs

5. **Automate with EventBridge Scheduler** (30 minutes)
   - [ ] Create Lambda function to run extraction scripts
   - [ ] Schedule daily via EventBridge Scheduler
   - [ ] Setup SNS notification on failure

**Success Metrics**:
- [ ] Test fixtures auto-updated weekly
- [ ] Zero manual fixture edits in 30 days
- [ ] OpenAPI spec generated and published
- [ ] Payload archive contains ≥7 days of data

**Rollback Plan**: Remove `logPayload()` calls, delete S3 bucket

**Cost**: ~$0.25/month

---

## Phase 2: EventBridge for Download Pipeline (8-12 hours)

**Goal**: Enable replay of download requests for debugging

**Scope**: Migrate **only** the download pipeline to EventBridge:
- WebhookFeedly → FileRequested event
- FileCoordinator → FileDownloadInitiated event

**Why Limited Scope?**
- Highest value path (most debugging needed)
- Minimal surface area (2 events, 3 Lambdas)
- Doesn't touch user authentication or device registration (lower risk)

**Tasks**:

1. **Define event schemas** (1 hour)
   - [ ] Create `types/events.ts` with TypeScript interfaces
   - [ ] Define `FileRequested` event
   - [ ] Define `FileDownloadInitiated` event
   - [ ] Add JSDoc comments

2. **Create EventBridge infrastructure** (2 hours)
   - [ ] Create `terraform/eventbridge.tf`
   - [ ] Create EventBridge bus: `MediaDownloaderBus`
   - [ ] Create EventBridge archive: 365-day retention
   - [ ] Create rules for each event type
   - [ ] Create targets (Lambda functions)
   - [ ] Add IAM permissions
   - [ ] Deploy with `npm run deploy`

3. **Create EventBridge vendor wrapper** (1 hour)
   - [ ] Create `lib/vendor/AWS/EventBridge.ts`
   - [ ] Implement `putEvent()` function
   - [ ] Follow existing vendor wrapper pattern (encapsulate SDK)
   - [ ] Add tests in `lib/vendor/AWS/EventBridge.test.ts`

4. **Migrate Lambda invocations** (2 hours)
   - [ ] Update `WebhookFeedly` to emit `FileRequested` event
   - [ ] Update `FileCoordinator` to listen for `FileRequested`
   - [ ] Update `FileCoordinator` to emit `FileDownloadInitiated`
   - [ ] Update `StartFileUpload` to listen for `FileDownloadInitiated`
   - [ ] Keep old `initiateFileDownload()` as fallback (feature flag)

5. **Update tests** (3 hours)
   - [ ] Mock EventBridge in `util/jest-setup.ts`
   - [ ] Update `WebhookFeedly` tests
   - [ ] Update `FileCoordinator` tests
   - [ ] Update `StartFileUpload` tests
   - [ ] Run full test suite: `npm test`

6. **Create replay script** (1 hour)
   - [ ] Write `bin/replay-events.sh`
   - [ ] Document usage in README
   - [ ] Test replay to staging environment

7. **Deploy and validate** (2 hours)
   - [ ] Deploy to staging
   - [ ] Trigger test webhook
   - [ ] Verify events in EventBridge console
   - [ ] Verify archive capturing events
   - [ ] Deploy to production
   - [ ] Monitor for 48 hours
   - [ ] Remove old code path once confident

**Success Metrics**:
- [ ] All FileRequested events archived
- [ ] Successfully replayed production events in staging
- [ ] Zero production incidents from migration
- [ ] Debugging time reduced by 50%

**Rollback Plan**: Feature flag to revert to direct Lambda invocation

**Cost**: ~$1/month

---

## Phase 3: Contract Testing (Optional, 12-16 hours)

**Goal**: Formalize API contracts with iOS app

**When to do this**:
- After iOS app development accelerates
- When multiple developers working on API/app
- When API breaking changes become costly

**Defer if**:
- Solo developer maintaining both API and iOS app
- API changes infrequent
- Strong integration test coverage already exists

**Tasks** (if pursued):
- Define OpenAPI contracts (use generated spec from Phase 1 as starting point)
- Setup Pact provider tests for Lambda functions
- Setup Pact consumer tests in iOS app
- Integrate into CI/CD pipeline
- Setup Pact Broker (self-hosted)

**Success Metrics**:
- [ ] Breaking API changes caught in CI before deployment
- [ ] iOS app can develop against mock server
- [ ] API versioning strategy enforced

**Cost**: $0/month (self-hosted Pact Broker on existing infrastructure)

---

## Comparison Matrix

| Criteria | Approach 1: Logging + Fixtures | Approach 2: EventBridge | Approach 3: Contract Testing | Hybrid (Recommended) |
|----------|-------------------------------|------------------------|------------------------------|---------------------|
| **Complexity** | Low | High | Medium | Medium (phased) |
| **Time to implement** | 4-6 hours | 8-12 hours | 12-16 hours | 4-6 hours (Phase 1), then incremental |
| **Production replay** | ❌ No | ✅ Yes | ❌ No | ✅ Yes (Phase 2) |
| **Real production data** | ✅ Yes | ✅ Yes | ⚠️ Idealized | ✅ Yes |
| **Auto-fixture generation** | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| **API documentation** | ✅ OpenAPI generated | ✅ Schema Registry | ✅ OpenAPI maintained | ✅ OpenAPI generated |
| **Internal events captured** | ⚠️ Partial | ✅ Full | ❌ Not applicable | ✅ Full (Phase 2) |
| **Breaking change detection** | ⚠️ Manual | ⚠️ Manual | ✅ Automated | ⚠️ Manual (✅ if Phase 3) |
| **Architectural impact** | None | High | Low | Medium (incremental) |
| **Cost/month** | $0.25 | $1.00 | $0-30 | $1.25 |
| **Risk level** | Low | Medium-High | Low | Low → Medium (phased) |

---

## Recommendations by Use Case

### If your goal is: **Eliminate manual fixture maintenance**
→ **Approach 1** or **Hybrid Phase 1**

### If your goal is: **Debug production issues with replay**
→ **Approach 2** or **Hybrid Phase 2**

### If your goal is: **Formalize iOS app integration**
→ **Approach 3** or **Hybrid Phase 3**

### If your goal is: **All of the above** (most comprehensive)
→ **Hybrid Strategy** (Phases 1-3)

### If your goal is: **Quick win with minimal effort**
→ **Approach 1** (4-6 hours, $0.25/month, immediate value)

---

## Risk Assessment

### Approach 1 Risks (Low)
- **Data sanitization errors**: Could leak sensitive data into fixtures
  - *Mitigation*: Code review of sanitization logic, test with production-like data locally
- **Fixture bloat**: Generated fixtures could become very large
  - *Mitigation*: Limit to representative samples (1-3 examples per scenario)
- **Log volume increase**: More logging increases CloudWatch costs
  - *Mitigation*: Use `logPayload()` selectively, compress large payloads

### Approach 2 Risks (Medium-High)
- **EventBridge payload limits**: 256KB max, video metadata could exceed
  - *Mitigation*: Store large payloads in S3, pass S3 key in event
- **Event ordering**: EventBridge doesn't guarantee order
  - *Mitigation*: Design idempotent handlers, use correlation IDs
- **Migration bugs**: Incorrect event wiring could break download pipeline
  - *Mitigation*: Phased rollout, feature flags, comprehensive testing

### Approach 3 Risks (Low)
- **Contract maintenance burden**: Contracts could become out of sync
  - *Mitigation*: Generate contracts from code (Hegel, TypeSpec), not hand-written
- **False positives**: Contract tests fail even though API works
  - *Mitigation*: Balance strict contracts with pragmatic flexibility

### Hybrid Risks (Low)
- **Incremental complexity**: Each phase adds new patterns
  - *Mitigation*: Complete each phase before starting next, document patterns

---

## Decision Framework

Use this decision tree to choose the right approach:

```
START: Do you need to replay production events?
  ├─ NO → Do you want auto-generated fixtures?
  │      ├─ YES → Approach 1: Enhanced Logging + Fixtures ✅
  │      └─ NO → Approach 3: Contract Testing (if formalizing iOS app integration)
  │
  └─ YES → Is the download pipeline your primary debugging target?
         ├─ YES → Hybrid Strategy (Phase 1 + 2) ✅
         └─ NO → Approach 2: Full EventBridge Migration

BUDGET CONSTRAINT: Do you have <$5/month for this?
  ├─ YES → Any approach is affordable
  └─ NO → Approach 1 only ($0.25/month)

TIME CONSTRAINT: Do you have <1 day to implement?
  ├─ YES → Approach 1 (4-6 hours) ✅
  └─ NO → Any approach is feasible

RISK TOLERANCE: Low tolerance for production issues?
  ├─ YES → Approach 1 or Hybrid (phased rollout) ✅
  └─ NO → Approach 2 (EventBridge) acceptable
```

---

## Final Recommendation

**Implement Hybrid Strategy, starting with Phase 1 immediately.**

**Why?**
1. **Immediate value**: Phase 1 solves the fixture staleness problem NOW (issues #9)
2. **Low risk**: Logging changes are additive, easy to rollback
3. **Foundation for future**: Phase 1 logging enables future EventBridge migration
4. **Cost-effective**: $0.25/month for Phase 1, defer Phase 2 costs until needed
5. **Incremental commitment**: Can stop after Phase 1 if satisfied, or continue to Phase 2

**When to proceed to Phase 2?**
- After successfully using Phase 1 fixtures for 1-2 months
- When you encounter a production issue that replay would have helped debug
- When download pipeline becomes more complex (e.g., adding new video sources beyond YouTube)

**When to proceed to Phase 3?**
- When iOS app has multiple contributors
- When API breaking changes start causing iOS app bugs
- When you want stronger API versioning guarantees

**Next Steps**:
1. Review this analysis and confirm approach
2. Create tracking issue for Phase 1 implementation
3. Implement Phase 1 (use TodoWrite tool for task tracking)
4. Evaluate Phase 1 success after 30 days
5. Decide whether to proceed to Phase 2

---

## Appendix: Related Issues

- **Issue #7**: Explore AWS EventBridge for Event Sourcing
  - *Resolution*: Implement in Hybrid Phase 2, limited to download pipeline

- **Issue #9**: Explore auto-generating test fixtures based on API usage
  - *Resolution*: Implement in Hybrid Phase 1, enhanced logging + fixture generation

- **Issue #8**: Implement AWS X-Ray Distributed Tracing
  - *Synergy*: X-Ray trace IDs can be included in event payloads for correlation
  - *Integration*: Phase 1 logging can include X-Ray trace IDs, Phase 2 EventBridge events can include trace IDs as metadata

---

## Glossary

- **Payload**: The data sent to or returned from an API/Lambda function (request/response body)
- **Fixture**: Test data stored as JSON files used in unit tests
- **Contract**: A formal specification of API behavior (request/response structure)
- **Event Sourcing**: Storing all changes as a sequence of events that can be replayed
- **Replay**: Re-executing past events in a test environment
- **Sanitization**: Removing sensitive data (API keys, user IDs) before storing/sharing
- **Provider**: The API/service that implements functionality (this backend)
- **Consumer**: The client that uses the API (iOS app, Feedly)
- **Archive**: Long-term storage of events for future replay
- **Schema Registry**: Centralized store of event/API schemas with versioning

---

## References

- [AWS EventBridge Archive & Replay](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-archive.html)
- [AWS EventBridge Schema Registry](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-schema.html)
- [Pact Contract Testing](https://docs.pact.io/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [Prism Mock Server](https://stoplight.io/open-source/prism)
- [API Gateway Logging](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-logging.html)
- [CloudWatch Logs Insights](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/AnalyzingLogData.html)
