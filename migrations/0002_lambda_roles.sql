-- Migration: 0002_lambda_roles
-- Description: Per-Lambda PostgreSQL roles with fine-grained table permissions
-- Auto-generated from @RequiresTable decorators
-- Generated at: 2026-03-26T21:21:55.463Z
--
-- This migration creates per-Lambda PostgreSQL roles and grants them
-- exactly the table permissions declared in their @RequiresTable decorators.
-- Note: ${AWS_ACCOUNT_ID} is replaced at runtime by MigrateDSQL handler.

-- =============================================================================
-- CREATE ROLES (per-Lambda with LOGIN for IAM auth)
-- =============================================================================

CREATE ROLE lambda_api_gateway_authorizer WITH LOGIN;
CREATE ROLE lambda_cleanup_expired_records WITH LOGIN;
CREATE ROLE lambda_login_user WITH LOGIN;
-- MigrateDSQL: Uses built-in admin role (DDL/DML access)
CREATE ROLE lambda_refresh_token WITH LOGIN;

-- =============================================================================
-- GRANT TABLE PERMISSIONS (per-Lambda least-privilege)
-- =============================================================================

-- ApiGatewayAuthorizer: sessions
GRANT SELECT ON sessions TO lambda_api_gateway_authorizer;

-- CleanupExpiredRecords: sessions, verification, file_downloads
GRANT SELECT, DELETE ON sessions TO lambda_cleanup_expired_records;
GRANT SELECT, DELETE ON verification TO lambda_cleanup_expired_records;
GRANT SELECT, DELETE ON file_downloads TO lambda_cleanup_expired_records;

-- LoginUser: users, sessions, accounts
GRANT SELECT, INSERT, UPDATE ON users TO lambda_login_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON sessions TO lambda_login_user;
GRANT SELECT, INSERT ON accounts TO lambda_login_user;

-- RefreshToken: sessions
GRANT SELECT, UPDATE ON sessions TO lambda_refresh_token;

-- =============================================================================
-- AWS IAM GRANT (associate Lambda IAM roles with PostgreSQL roles)
-- =============================================================================
-- These statements link AWS IAM roles to PostgreSQL roles for authentication.
-- ${AWS_ACCOUNT_ID} and ${RESOURCE_PREFIX} are replaced at runtime by MigrateDSQL handler.

AWS IAM GRANT lambda_api_gateway_authorizer TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/${RESOURCE_PREFIX}-ApiGatewayAuthorizer';
AWS IAM GRANT lambda_cleanup_expired_records TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/${RESOURCE_PREFIX}-CleanupExpiredRecords';
AWS IAM GRANT lambda_login_user TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/${RESOURCE_PREFIX}-LoginUser';
-- MigrateDSQL: Uses admin (no IAM GRANT needed, uses DbConnectAdmin)
AWS IAM GRANT lambda_refresh_token TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/${RESOURCE_PREFIX}-RefreshToken';
