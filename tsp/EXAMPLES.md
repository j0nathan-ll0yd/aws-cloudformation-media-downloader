# TypeSpec Examples from Test Fixtures

This document explains how test fixtures are referenced in the TypeSpec API documentation.

## Overview

The TypeSpec definitions reference real-world examples from the test fixtures in `src/lambdas/*/test/fixtures/`. These examples are synchronized to `tsp/examples/` directory, ensuring the documentation stays in sync with actual test data.

## Example Files

All example files are located in `tsp/examples/` and are automatically synchronized from API-specific test fixtures. These fixtures follow the naming convention `apiRequest-*.json` and `apiResponse-*.json` in each lambda's test fixtures directory:

| Example File | API Operation |
|-------------|---------------|
| `list-files-response.json` | GET /files |
| `register-device-request.json` | POST /device/register |
| `register-device-response.json` | POST /device/register |
| `webhook-feedly-request.json` | POST /feedly |
| `webhook-feedly-response.json` | POST /feedly |
| `register-user-request.json` | POST /user/register |
| `register-user-response.json` | POST /user/register |
| `login-user-request.json` | POST /user/login |
| `login-user-response.json` | POST /user/login |

## Synchronizing Examples

Examples are automatically synced when you run:

```bash
npm run document-api
```

The sync happens automatically as the first step of the documentation generation process. The sync script (`bin/sync-examples.sh`):
1. Scans all lambda directories for files matching `apiRequest-*.json` and `apiResponse-*.json`
2. Automatically copies these fixtures to `tsp/examples/` with standardized naming
3. Converts lambda names from PascalCase to kebab-case for example file names
4. Maintains a clear mapping between source fixtures and example files

You can also run the sync script manually if needed:

```bash
./bin/sync-examples.sh
```

## Benefits of Referencing Test Fixtures

1. **Accuracy**: Examples are based on real API behavior, not hypothetical scenarios
2. **Consistency**: Examples stay in sync with test fixtures via sync script
3. **Validation**: Examples are validated by actual test cases
4. **Maintainability**: Single source of truth - test fixtures drive documentation
5. **No Duplication**: Documentation references fixture files instead of copying content

## Adding New Examples

When adding new endpoints or modifying existing ones:

1. **Create API-specific fixtures** in `src/lambdas/[LambdaName]/test/fixtures/` using the naming convention:
   - `apiRequest-[METHOD]-[note].json` for request examples
   - `apiResponse-[METHOD]-[statusCode]-[note].json` for response examples
   
   Examples:
   - `apiRequest-POST-register.json`
   - `apiResponse-GET-200-OK.json`
   - `apiResponse-POST-201-Created.json`

2. **Auto-discovery**: The sync script will automatically discover these fixtures during the next documentation build

3. **Generate documentation**: Run `npm run document-api` to:
   - Automatically sync the new fixtures to `tsp/examples/`
   - Compile TypeSpec to OpenAPI
   - Generate Redoc HTML documentation

4. **Reference in TypeSpec**: Update operation comments to reference the new example files in `tsp/operations/operations.tsp`

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
