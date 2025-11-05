# TypeSpec Example Files

This directory contains example JSON files that are referenced in the TypeSpec API documentation.

## Purpose

Instead of copying JSON content into TypeSpec documentation, we reference these external files. This approach:

1. **Maintains a single source of truth** - Test fixtures drive the examples
2. **Reduces duplication** - No need to copy JSON in multiple places
3. **Ensures consistency** - Examples stay in sync with test data
4. **Improves maintainability** - Update once, reflects everywhere

## File Structure

| File | Description | Source |
|------|-------------|--------|
| `list-files-response.json` | Response from GET /files endpoint | `src/lambdas/ListFiles/test/fixtures/batchGet-200-OK.json` |
| `register-device-request.json` | Request body for POST /device/register | `src/lambdas/RegisterDevice/test/fixtures/APIGatewayEvent.json` (body extracted) |
| `register-device-response.json` | Response from POST /device/register | Generated example |
| `feedly-webhook-request.json` | Request body for POST /feedly | `src/lambdas/WebhookFeedly/test/fixtures/handleFeedlyEvent-200-OK.json` |
| `feedly-webhook-response.json` | Response from POST /feedly | Generated example |
| `user-login-request.json` | Request body for POST /user/login | Generated example |
| `user-register-request.json` | Request body for POST /user/register | Generated example |
| `auth-response.json` | Response from authentication endpoints | Generated example |

## Syncing Examples

These files are automatically synced when you generate documentation:

```bash
npm run document-api
```

The sync happens automatically as the first step of the documentation generation process.

You can also run the sync script manually if needed:

```bash
./bin/sync-examples.sh
```

## Usage in TypeSpec

In TypeSpec operation documentation, examples are referenced like this:

```typescript
/**
 * Example request: See `tsp/examples/register-device-request.json`
 * (sourced from `src/lambdas/RegisterDevice/test/fixtures/APIGatewayEvent.json`)
 */
```

This reference appears in the generated OpenAPI documentation, allowing readers to:
1. View the example file directly
2. Trace back to the original test fixture
3. Verify the example against actual test data

## Development Workflow

1. **Update test fixture** in `src/lambdas/*/test/fixtures/`
2. **Regenerate docs**: `npm run document-api` (automatically syncs examples and generates documentation)
3. **Verify changes**: Check `docs/api/openapi.yaml` and `docs/api/index.html`

## Benefits

- ✅ **No duplication** - Examples aren't copied into TypeSpec files
- ✅ **Always in sync** - Sync script keeps examples current
- ✅ **Traceable** - Clear connection between tests and docs
- ✅ **Maintainable** - Update fixtures, run sync, done
- ✅ **Testable** - Examples are actual test data
