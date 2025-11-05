# API Documentation

This directory contains the TypeSpec definition for the Offline Media Downloader API.

## Table of Contents

- [About TypeSpec](#about-typespec)
- [Structure](#structure)
- [Compiling TypeSpec](#compiling-typespec)
- [API Endpoints](#api-endpoints)
- [Examples](#examples)
- [Viewing the Documentation](#viewing-the-documentation)
- [Maintenance](#maintenance)
- [Benefits of TypeSpec](#benefits-of-typespec)

## About TypeSpec

[TypeSpec](https://typespec.io/) is a language for defining APIs that can generate OpenAPI specifications, JSON schemas, and other API description formats. It provides a more maintainable and type-safe way to document APIs compared to writing OpenAPI YAML directly.

## Structure

- `main.tsp` - Main TypeSpec entry point and service definition
- `models/models.tsp` - Data models and types
- `operations/operations.tsp` - API operations and endpoints
- `tspconfig.yaml` - TypeSpec compiler configuration

## Compiling TypeSpec

To generate and view API documentation from TypeSpec:

```bash
npm run document-api
```

This will:
1. Compile TypeSpec definitions to OpenAPI 3.0 specification (`docs/api/openapi.yaml`)
2. Generate a Redoc HTML documentation file (`docs/api/index.html`)
3. Automatically open the documentation in your default browser

You can also run the helper script directly:

```bash
./bin/document-api.sh
```

## Syncing Examples

To keep example files in sync with test fixtures:

```bash
./bin/sync-examples.sh
```

This script extracts data from test fixtures and creates/updates example JSON files in `tsp/examples/`. Run this whenever test fixtures are updated to ensure documentation stays in sync.

## API Endpoints

The API includes four main endpoint groups:

### Files (`/files`)
- **GET /files** - List all files available to the authenticated user

### Devices (`/device`)
- **POST /device/register** - Register a device for push notifications

### Webhooks (`/feedly`)
- **POST /feedly** - Process Feedly webhook to download media

### Authentication (`/user`)
- **POST /user/register** - Register new user with Sign in with Apple
- **POST /user/login** - Login existing user with Sign in with Apple

## Examples

The TypeSpec definitions include example requests and responses based on actual test fixtures from the codebase. These examples are embedded in the documentation comments and demonstrate real-world usage of the API.

See [EXAMPLES.md](./EXAMPLES.md) for detailed information about how test fixtures are incorporated into the API documentation.

## Viewing the Documentation

You can view the generated OpenAPI specification using various tools:

1. **Swagger UI**: Upload the generated `openapi.yaml` to [Swagger Editor](https://editor.swagger.io/)
2. **Redoc**: Use Redoc CLI or online viewer
3. **VS Code**: Use the OpenAPI Preview extension

## Maintenance

When modifying the API:

1. Update the TypeSpec definitions in the `tsp/` directory
2. Run `npm run document-api` to regenerate the OpenAPI spec
3. Verify the generated documentation is correct
4. Include relevant examples from test fixtures

## Benefits of TypeSpec

- **Type Safety**: Catch errors at definition time, not runtime
- **DRY**: Define models once, reuse across endpoints
- **Maintainability**: Easier to read and maintain than raw OpenAPI YAML
- **Validation**: Built-in validation and error checking
- **Examples**: Integrated examples from test fixtures for better documentation
