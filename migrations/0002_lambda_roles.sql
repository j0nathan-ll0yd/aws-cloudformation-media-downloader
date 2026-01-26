-- Migration: 0002_lambda_roles
-- Description: Per-Lambda PostgreSQL roles with fine-grained table permissions
-- Auto-generated from @RequiresTable decorators
-- Generated at: 2026-01-26T05:20:41.980Z
--
-- This migration creates per-Lambda PostgreSQL roles and grants them
-- exactly the table permissions declared in their @RequiresTable decorators.
-- Note: ${AWS_ACCOUNT_ID} is replaced at runtime by MigrateDSQL handler.

-- =============================================================================
-- CREATE ROLES (per-Lambda with LOGIN for IAM auth)
-- =============================================================================

CREATE ROLE lambda_api_gateway_authorizer WITH LOGIN;
CREATE ROLE lambda_cleanup_expired_records WITH LOGIN;
CREATE ROLE lambda_list_files WITH LOGIN;
CREATE ROLE lambda_login_user WITH LOGIN;
CREATE ROLE lambda_logout_user WITH LOGIN;
-- MigrateDSQL: Uses built-in admin role (DDL/DML access)
CREATE ROLE lambda_prune_devices WITH LOGIN;
CREATE ROLE lambda_refresh_token WITH LOGIN;
CREATE ROLE lambda_register_device WITH LOGIN;
CREATE ROLE lambda_register_user WITH LOGIN;
CREATE ROLE lambda_s3_object_created WITH LOGIN;
CREATE ROLE lambda_send_push_notification WITH LOGIN;
CREATE ROLE lambda_start_file_upload WITH LOGIN;
CREATE ROLE lambda_user_delete WITH LOGIN;
CREATE ROLE lambda_user_subscribe WITH LOGIN;
CREATE ROLE lambda_webhook_feedly WITH LOGIN;

-- =============================================================================
-- GRANT TABLE PERMISSIONS (per-Lambda least-privilege)
-- =============================================================================

-- ApiGatewayAuthorizer: sessions
GRANT SELECT, UPDATE ON sessions TO lambda_api_gateway_authorizer;

-- CleanupExpiredRecords: sessions, verification, file_downloads
GRANT SELECT, DELETE ON sessions TO lambda_cleanup_expired_records;
GRANT SELECT, DELETE ON verification TO lambda_cleanup_expired_records;
GRANT SELECT, DELETE ON file_downloads TO lambda_cleanup_expired_records;

-- ListFiles: files, user_files
GRANT SELECT ON files TO lambda_list_files;
GRANT SELECT ON user_files TO lambda_list_files;

-- LoginUser: users, sessions, accounts
GRANT SELECT, INSERT, UPDATE ON users TO lambda_login_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON sessions TO lambda_login_user;
GRANT SELECT, INSERT ON accounts TO lambda_login_user;

-- LogoutUser: sessions
GRANT SELECT, UPDATE ON sessions TO lambda_logout_user;

-- PruneDevices: devices, user_devices
GRANT DELETE, SELECT ON devices TO lambda_prune_devices;
GRANT DELETE, SELECT ON user_devices TO lambda_prune_devices;

-- RefreshToken: sessions
GRANT SELECT, UPDATE ON sessions TO lambda_refresh_token;

-- RegisterDevice: devices, user_devices
GRANT DELETE, INSERT, UPDATE ON devices TO lambda_register_device;
GRANT DELETE, INSERT, SELECT ON user_devices TO lambda_register_device;

-- RegisterUser: users
GRANT UPDATE ON users TO lambda_register_user;

-- S3ObjectCreated: files, user_files
GRANT SELECT ON files TO lambda_s3_object_created;
GRANT SELECT ON user_files TO lambda_s3_object_created;

-- SendPushNotification: devices, user_devices
GRANT DELETE, SELECT ON devices TO lambda_send_push_notification;
GRANT DELETE, SELECT ON user_devices TO lambda_send_push_notification;

-- StartFileUpload: file_downloads, files, user_files
GRANT INSERT, SELECT, UPDATE ON file_downloads TO lambda_start_file_upload;
GRANT INSERT, SELECT, UPDATE ON files TO lambda_start_file_upload;
GRANT SELECT ON user_files TO lambda_start_file_upload;

-- UserDelete: devices, user_devices, user_files, users
GRANT DELETE, SELECT ON devices TO lambda_user_delete;
GRANT DELETE, SELECT ON user_devices TO lambda_user_delete;
GRANT DELETE ON user_files TO lambda_user_delete;
GRANT DELETE ON users TO lambda_user_delete;

-- UserSubscribe: devices, user_devices
GRANT DELETE ON devices TO lambda_user_subscribe;
GRANT DELETE, SELECT ON user_devices TO lambda_user_subscribe;

-- WebhookFeedly: file_downloads, files, user_files
GRANT INSERT ON file_downloads TO lambda_webhook_feedly;
GRANT INSERT, SELECT ON files TO lambda_webhook_feedly;
GRANT INSERT, SELECT ON user_files TO lambda_webhook_feedly;

-- =============================================================================
-- AWS IAM GRANT (associate Lambda IAM roles with PostgreSQL roles)
-- =============================================================================
-- These statements link AWS IAM roles to PostgreSQL roles for authentication.
-- ${AWS_ACCOUNT_ID} is replaced at runtime by MigrateDSQL handler.

AWS IAM GRANT lambda_api_gateway_authorizer TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/ApiGatewayAuthorizer';
AWS IAM GRANT lambda_cleanup_expired_records TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/CleanupExpiredRecords';
AWS IAM GRANT lambda_list_files TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/ListFiles';
AWS IAM GRANT lambda_login_user TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/LoginUser';
AWS IAM GRANT lambda_logout_user TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/LogoutUser';
-- MigrateDSQL: Uses admin (no IAM GRANT needed, uses DbConnectAdmin)
AWS IAM GRANT lambda_prune_devices TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/PruneDevices';
AWS IAM GRANT lambda_refresh_token TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/RefreshToken';
AWS IAM GRANT lambda_register_device TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/RegisterDevice';
AWS IAM GRANT lambda_register_user TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/RegisterUser';
AWS IAM GRANT lambda_s3_object_created TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/S3ObjectCreated';
AWS IAM GRANT lambda_send_push_notification TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/SendPushNotification';
AWS IAM GRANT lambda_start_file_upload TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/StartFileUpload';
AWS IAM GRANT lambda_user_delete TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/UserDelete';
AWS IAM GRANT lambda_user_subscribe TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/UserSubscribe';
AWS IAM GRANT lambda_webhook_feedly TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/WebhookFeedly';
