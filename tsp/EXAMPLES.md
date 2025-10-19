# TypeSpec Examples from Test Fixtures

This document explains how test fixtures are referenced in the TypeSpec API documentation.

## Overview

The TypeSpec definitions reference real-world examples from the test fixtures in `src/lambdas/*/test/fixtures/`. These examples are synchronized to `tsp/examples/` directory, ensuring the documentation stays in sync with actual test data.

## Example Files

All example files are located in `tsp/examples/` and are synchronized from test fixtures:

| Example File | Source Fixture | API Operation |
|-------------|----------------|---------------|
| `list-files-response.json` | `src/lambdas/ListFiles/test/fixtures/batchGet-200-OK.json` | GET /files |
| `register-device-request.json` | `src/lambdas/RegisterDevice/test/fixtures/APIGatewayEvent.json` | POST /device/register |
| `register-device-response.json` | Generated example | POST /device/register |
| `feedly-webhook-request.json` | `src/lambdas/WebhookFeedly/test/fixtures/handleFeedlyEvent-200-OK.json` | POST /feedly |
| `feedly-webhook-response.json` | Generated example | POST /feedly |
| `user-register-request.json` | Generated example | POST /user/register |
| `user-login-request.json` | Generated example | POST /user/login |
| `auth-response.json` | Generated example | POST /user/login, POST /user/register |

## Synchronizing Examples

To keep examples in sync with test fixtures, run:

```bash
./bin/sync-examples.sh
```

This script:
1. Extracts relevant data from test fixtures
2. Transforms them into API response format
3. Creates example files in `tsp/examples/`
4. Maintains references to source fixtures

## Benefits of Referencing Test Fixtures

1. **Accuracy**: Examples are based on real API behavior, not hypothetical scenarios
2. **Consistency**: Examples stay in sync with test fixtures via sync script
3. **Validation**: Examples are validated by actual test cases
4. **Maintainability**: Single source of truth - test fixtures drive documentation
5. **No Duplication**: Documentation references fixture files instead of copying content

## Adding New Examples

When adding new endpoints or modifying existing ones:

1. Create or update test fixtures in `src/lambdas/[LambdaName]/test/fixtures/`
2. Update `bin/sync-examples.sh` to include the new fixture
3. Run `./bin/sync-examples.sh` to sync examples
4. Reference the example file in TypeSpec operation comments
5. Regenerate documentation with `npm run document-api`

## Example Reference Format in TypeSpec

Examples are referenced in operation documentation comments:

```typescript
/**
 * Operation description
 * 
 * Example request: See `tsp/examples/example-request.json`
 * (sourced from `src/lambdas/Lambda/test/fixtures/fixture.json`)
 * 
 * Example response: See `tsp/examples/example-response.json`
 * 
 * @returns Response description
 */
```

This approach:
- References example files instead of copying content
- Maintains traceability to source fixtures
- Ensures documentation stays in sync with test data
- Reduces maintenance burden
