# SNS Resources for Push Notifications
#
# Topic for push notification delivery and APNS platform application.

resource "aws_sns_topic" "push_notifications" {
  name = "${module.core.name_prefix}-PushNotifications"
  tags = module.core.common_tags
}

resource "aws_sns_topic" "operations_alerts" {
  name = "${module.core.name_prefix}-OperationsAlerts"
  tags = module.core.common_tags
}

# APNS Platform Application for iOS push notifications
resource "aws_sns_platform_application" "apns" {
  name                = "${module.core.name_prefix}-MediaDownloader"
  platform            = var.environment == "production" ? "APNS" : "APNS_SANDBOX"
  platform_credential = data.sops_file.secrets.data["apns.staging.privateKey"]
  platform_principal  = data.sops_file.secrets.data["apns.staging.certificate"]

  # Note: success/failure feedback roles require iam:PassRole permission.
  # Add these after the IAM role is created and iam:PassRole is granted.
  # success_feedback_role_arn = aws_iam_role.sns_logging.arn
  # failure_feedback_role_arn = aws_iam_role.sns_logging.arn

  depends_on = [aws_iam_role.sns_logging, aws_iam_role_policy.sns_logging]
}

resource "aws_iam_role" "sns_logging" {
  name = "${module.core.name_prefix}-SNSLogging"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "sns.amazonaws.com"
      }
    }]
  })

  tags = module.core.common_tags
}

resource "aws_iam_role_policy" "sns_logging" {
  name = "SNSCloudWatchLogging"
  role = aws_iam_role.sns_logging.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:PutMetricFilter",
        "logs:PutRetentionPolicy"
      ]
      Resource = "*"
    }]
  })
}
