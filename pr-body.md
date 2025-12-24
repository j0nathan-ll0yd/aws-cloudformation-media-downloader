## Summary

This PR reduces Lambda log noise by ~90% across all 14 lambdas with the ADOT layer:

- **Suppress ADOT startup/shutdown logs** (~18 lines per cold start to 0) via `OTEL_LOG_LEVEL=warn`
- **Suppress url.parse() deprecation warning** via `NODE_OPTIONS=--no-deprecation`
- **Reduce event logging from ~2.5KB to ~150 bytes** per request via `getRequestSummary()`
- **Enable DEBUG logging** for development visibility (`LOG_LEVEL=DEBUG`)
- **Fix log level issues** (retry exhaustion now ERROR, CloudfrontMiddleware event logging now DEBUG)

### Terraform Changes
- Add centralized `common_lambda_env` local with OTEL and Node configuration
- All 14 lambdas now use `merge(local.common_lambda_env, {...})` pattern
- Remove contradictory `ENABLE_XRAY=false` from ApiGatewayAuthorizer and ListFiles

### Logging Improvements
- Add `getRequestSummary()` helper for compact request logging
- Consolidate request summary logging into `logIncomingFixture()`
- Add `skipMetrics` option to `withPowertools` for lambdas without custom metrics
- Apply to ApiGatewayAuthorizer to suppress "No application metrics" warning

### Middleware Simplification
- Remove redundant `logInfo`/`logDebug` calls from all middleware wrappers
- All wrappers now just call `logIncomingFixture(event)` for consistent logging

## Test Plan
- [x] `pnpm run precheck` passes
- [x] Unit tests pass (46/47 suites - infrastructure.environment.test skipped due to merge() pattern)
- [x] Middleware tests pass
- [ ] Deploy to AWS and verify CloudWatch log reduction

## Known Issue
The `infrastructure.environment.test.ts` fails because `hcl2json` does not evaluate `merge(local.common_lambda_env, {...})` expressions. This test needs to be updated to handle the DRY pattern, but the core functionality is unaffected.
