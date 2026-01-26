-- Migration: 0003_authorizer_session_update
-- Description: Fix ApiGatewayAuthorizer permissions to allow UPDATE on sessions
-- Reason: validateSessionToken() updates session.updated_at for session tracking
--
-- Bug fix: ApiGatewayAuthorizer was returning 401 because it could SELECT sessions
-- but not UPDATE them. The validateSessionToken function in sessionService.ts calls
-- updateSession() to touch the updated_at timestamp when validating a token.

GRANT UPDATE ON sessions TO lambda_api_gateway_authorizer;
