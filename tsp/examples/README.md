# API Examples

JSON examples for TypeSpec API documentation.

## Purpose

These example files are referenced in the TypeSpec API documentation (`tsp/operations/operations.tsp`). They provide concrete examples of API request and response bodies.

## Updating Examples

Edit files directly in this directory. These examples are:
- Referenced by `tsp/operations/operations.tsp` doc comments
- Used to generate OpenAPI documentation
- Version-controlled (committed to git)

## Naming Convention

- `{operation}-request.json` - Request body example
- `{operation}-response.json` - Response body example

## File Inventory

| File | Description |
|------|-------------|
| `list-files-response.json` | Response from GET /files endpoint |
| `login-user-request.json` | Request body for POST /user/login |
| `login-user-response.json` | Response from POST /user/login |
| `register-device-request.json` | Request body for POST /device/register |
| `register-device-response.json` | Response from POST /device/register |
| `register-user-request.json` | Request body for POST /user/register |
| `register-user-response.json` | Response from POST /user/register |
| `webhook-feedly-request.json` | Request body for POST /feedly |
| `webhook-feedly-response.json` | Response from POST /feedly |

## Usage in TypeSpec

In TypeSpec operation documentation, examples are referenced like this:

```typescript
/**
 * Example request: See `tsp/examples/register-device-request.json`
 */
```

This reference appears in the generated OpenAPI documentation.

## Development Workflow

1. **Edit examples** directly in this directory
2. **Regenerate docs**: `pnpm run document-api`
3. **Verify changes**: Check `docs/api/openapi.yaml`
