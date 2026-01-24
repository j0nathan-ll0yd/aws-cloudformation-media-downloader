---
last_updated: 2026-01-02
next_review: 2026-07-02
status: current
---

# API Documentation Audit - January 2, 2026

## Summary

This audit evaluated the completeness and accuracy of API documentation across TypeSpec definitions, generated OpenAPI spec, TypeScript types, and Terraform infrastructure configuration.

## Issues Found and Fixed

### 1. Missing TypeScript Types (CRITICAL - Fixed)

**Issue**: Three TypeSpec models had no corresponding TypeScript/Zod types in `src/types/api-schema/`.

| Missing Type | Usage |
|-------------|-------|
| `UserSubscriptionResponse` | Response for POST /user/subscribe |
| `TokenRefreshResponse` | Response for POST /user/refresh |
| `ClientEventRequest` | Request body for POST /device/event |

**Fix**: Added these types to `scripts/generateApiTypes.ts` DOMAIN_MODELS set and regenerated types.

### 2. Terraform Authorization Mismatches (HIGH - Fixed)

**Issue**: Two endpoints had `authorization = "NONE"` in Terraform but TypeSpec documented them as requiring Authorization headers.

| Endpoint | Before | After |
|----------|--------|-------|
| DELETE /user | NONE | CUSTOM with authorizer |
| POST /user/subscribe | NONE | CUSTOM with authorizer |

**Fix**: Updated `terraform/user_delete.tf` and `terraform/user_subscribe.tf` to use CUSTOM authorization.

### 3. OpenAPI Response Descriptions (MEDIUM - Fixed)

**Issue**: Error responses (400, 401, 403, 500) previously had the same descriptions as success responses.

**Fix**: Added `@doc` decorators to TypeSpec operations. OpenAPI now uses proper HTTP semantic descriptions.

### 4. Response Model Completeness (VERIFIED)

All response models now include required fields:

| Model | Required Fields |
|-------|----------------|
| UserLoginResponse | token, expiresAt, sessionId, userId |
| UserRegistrationResponse | token, expiresAt, sessionId, userId |
| TokenRefreshResponse | token, expiresAt, sessionId, userId |

## TypeSpec to Implementation Alignment Matrix

| Endpoint | TypeSpec | Lambda | Terraform | OpenAPI |
|----------|----------|--------|-----------|---------|
| GET /files | /files | ListFiles | list_files.tf | openapi.yaml |
| POST /device/register | /device/register | RegisterDevice | register_device.tf | openapi.yaml |
| POST /device/event | /device/event | DeviceEvent | device_event.tf | openapi.yaml |
| POST /feedly | /feedly | WebhookFeedly | feedly_webhook.tf | openapi.yaml |
| POST /user/register | /user/register | RegisterUser | register_user.tf | openapi.yaml |
| POST /user/login | /user/login | LoginUser | login_user.tf | openapi.yaml |
| POST /user/refresh | /user/refresh | RefreshToken | refresh_token.tf | openapi.yaml |
| DELETE /user | /user | UserDelete | user_delete.tf | openapi.yaml |
| POST /user/subscribe | /user/subscribe | UserSubscribe | user_subscribe.tf | openapi.yaml |

## Files Modified

| File | Changes |
|------|---------|
| `scripts/generateApiTypes.ts` | Added 3 types to DOMAIN_MODELS |
| `src/types/api-schema/schemas.ts` | Regenerated with new Zod schemas |
| `src/types/api-schema/types.ts` | Regenerated with new TypeScript types |
| `terraform/user_delete.tf` | Changed authorization to CUSTOM |
| `terraform/user_subscribe.tf` | Changed authorization to CUSTOM |
| `tsp/operations/operations.tsp` | Added @doc decorators for response descriptions |
| `docs/api/openapi.yaml` | Regenerated from TypeSpec |

## Recommendations for Ongoing Maintenance

1. **Keep TypeSpec as single source of truth**: All API changes should start in TypeSpec
2. **Regenerate types after TypeSpec changes**: Run `npx tsx scripts/generateApiTypes.ts` and `pnpm run typespec:compile`
3. **Verify Terraform matches TypeSpec**: Check authorization requirements align
4. **Run validation**: Use `pnpm run validate:conventions` before commits

## Validation Results

- `pnpm run precheck`: Passed
- `pnpm run validate:conventions`: Passed (MEDIUM/LOW only)
- `tofu validate`: Passed
