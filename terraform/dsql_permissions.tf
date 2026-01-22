# Auto-generated from @RequiresTable decorators
# Do not edit manually - run: pnpm run generate:dsql-permissions
# Generated at: 2026-01-22T23:32:49.811Z

locals {
  # Per-Lambda PostgreSQL role configuration
  # Maps Lambda function names to their PostgreSQL role and admin status
  lambda_dsql_roles = {
    "ApiGatewayAuthorizer" = {
      role_name      = "lambda_api_gateway_authorizer"
      requires_admin = false
    }
    "CleanupExpiredRecords" = {
      role_name      = "lambda_cleanup_expired_records"
      requires_admin = false
    }
    "ListFiles" = {
      role_name      = "lambda_list_files"
      requires_admin = false
    }
    "LoginUser" = {
      role_name      = "lambda_login_user"
      requires_admin = false
    }
    "LogoutUser" = {
      role_name      = "lambda_logout_user"
      requires_admin = false
    }
    "MigrateDSQL" = {
      role_name      = "admin"
      requires_admin = true
    }
    "PruneDevices" = {
      role_name      = "lambda_prune_devices"
      requires_admin = false
    }
    "RefreshToken" = {
      role_name      = "lambda_refresh_token"
      requires_admin = false
    }
    "RegisterDevice" = {
      role_name      = "lambda_register_device"
      requires_admin = false
    }
    "RegisterUser" = {
      role_name      = "lambda_register_user"
      requires_admin = false
    }
    "S3ObjectCreated" = {
      role_name      = "lambda_s3_object_created"
      requires_admin = false
    }
    "SendPushNotification" = {
      role_name      = "lambda_send_push_notification"
      requires_admin = false
    }
    "StartFileUpload" = {
      role_name      = "lambda_start_file_upload"
      requires_admin = false
    }
    "UserDelete" = {
      role_name      = "lambda_user_delete"
      requires_admin = false
    }
    "WebhookFeedly" = {
      role_name      = "lambda_webhook_feedly"
      requires_admin = false
    }
  }

  # Partition by IAM requirement
  # Non-admin Lambdas use dsql:DbConnect with custom PostgreSQL roles
  lambda_dsql_connect = {
    for k, v in local.lambda_dsql_roles : k => v if !v.requires_admin
  }

  # Admin Lambdas use dsql:DbConnectAdmin with built-in admin user
  lambda_dsql_admin = {
    for k, v in local.lambda_dsql_roles : k => v if v.requires_admin
  }
}

# =============================================================================
# IAM Policy Attachments (generated with for_each)
# =============================================================================
# These replace the hardcoded aws_iam_role_policy_attachment resources
# in individual Lambda .tf files.

resource "aws_iam_role_policy_attachment" "lambda_dsql_connect" {
  for_each   = local.lambda_dsql_connect
  role       = each.key
  policy_arn = aws_iam_policy.LambdaDSQLConnect.arn
}

resource "aws_iam_role_policy_attachment" "lambda_dsql_admin" {
  for_each   = local.lambda_dsql_admin
  role       = each.key
  policy_arn = aws_iam_policy.LambdaDSQLAdminConnect.arn
}
