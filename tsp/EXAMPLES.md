# TypeSpec Examples from Test Fixtures

This document explains how test fixtures are incorporated into the TypeSpec API documentation.

## Overview

The TypeSpec definitions include real-world examples extracted from the test fixtures in `src/lambdas/*/test/fixtures/`. These examples demonstrate actual API usage and responses.

## Examples Included

### 1. List Files (`GET /files`)

**Source Fixture**: `src/lambdas/ListFiles/test/fixtures/batchGet-200-OK.json`

The example shows a file that has been successfully downloaded and is available to the user:

```json
{
  "contents": [
    {
      "fileId": "PaZ1EmPOE_k",
      "key": "20150826-[The School of Life].mp4",
      "title": "On Feeling Melancholy",
      "status": "Downloaded",
      "size": 12023572,
      "contentType": "video/mp4",
      "authorName": "The School of Life"
    }
  ],
  "keyCount": 1
}
```

**Location in TypeSpec**: `tsp/operations/operations.tsp` - Files interface

### 2. Register Device (`POST /device/register`)

**Source Fixture**: `src/lambdas/RegisterDevice/test/fixtures/APIGatewayEvent.json`

The example shows a typical device registration request from an iOS device:

**Request**:
```json
{
  "systemVersion": "16.0.2",
  "deviceId": "67C431DE-37D2-4BBA-9055-E9D2766517E1",
  "name": "iPhone",
  "systemName": "iOS",
  "token": "1270ac093113154918d1ae96e90247d068b98766842654b3cc2400c7342dc4ba"
}
```

**Response**:
```json
{
  "endpointArn": "arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/abcd1234-5678-90ab-cdef-1234567890ab"
}
```

**Location in TypeSpec**: `tsp/operations/operations.tsp` - Devices interface

### 3. Feedly Webhook (`POST /feedly`)

**Source Fixture**: `src/lambdas/WebhookFeedly/test/fixtures/handleFeedlyEvent-200-OK.json`

The example shows a webhook payload from Feedly when a new YouTube video is published:

**Request**:
```json
{
  "articleFirstImageURL": "https://i.ytimg.com/vi/7jEzw5WLiMI/maxresdefault.jpg",
  "articleCategories": "YouTube",
  "articlePublishedAt": "April 27, 2020 at 04:10PM",
  "articleTitle": "WOW! Ariana Grande Meme Backlash & Meme War",
  "articleURL": "https://www.youtube.com/watch?v=wRG7lAGdRII",
  "createdAt": "April 27, 2020 at 04:10PM",
  "sourceFeedURL": "https://www.youtube.com/playlist?list=UUlFSU9_bUb4Rc6OYfTt5SPw",
  "sourceTitle": "Philip DeFranco (uploads) on YouTube",
  "sourceURL": "https://youtube.com/playlist?list=UUlFSU9_bUb4Rc6OYfTt5SPw"
}
```

**Response**:
```json
{
  "status": "Dispatched"
}
```

**Location in TypeSpec**: `tsp/operations/operations.tsp` - Webhooks interface

## Benefits of Using Test Fixtures as Examples

1. **Accuracy**: Examples are based on real API behavior, not hypothetical scenarios
2. **Consistency**: When tests change, we know to update the documentation
3. **Validation**: Examples are validated by actual test cases
4. **Maintainability**: Single source of truth for request/response structures

## Adding New Examples

When adding new endpoints or modifying existing ones:

1. Create or update test fixtures in `src/lambdas/[LambdaName]/test/fixtures/`
2. Add example snippets to the relevant TypeSpec operation in `tsp/operations/operations.tsp`
3. Reference the fixture file in comments for traceability
4. Regenerate documentation with `npm run document-api`

## Example Format in TypeSpec

Examples are embedded in operation documentation using markdown code blocks:

```typescript
/**
 * Operation description
 * 
 * Example request:
 * ```json
 * {
 *   "field": "value"
 * }
 * ```
 * 
 * Example response:
 * ```json
 * {
 *   "result": "success"
 * }
 * ```
 */
```

This format ensures examples appear in the generated OpenAPI documentation and are easy to read in the TypeSpec source files.
