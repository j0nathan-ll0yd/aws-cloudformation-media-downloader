# Auto-generated Lambda IAM policies from @RequiresServices and @RequiresDynamoDB decorators
# Generated at: 2026-01-18T18:35:36.400Z
# Source: build/service-permissions.json, build/dynamodb-permissions.json
#
# DO NOT EDIT - regenerate with: pnpm run generate:service-iam-policies
#
# This file creates IAM policies based on the @RequiresServices and @RequiresDynamoDB
# decorator declarations in Lambda handler code. Each Lambda gets a policy document,
# an IAM policy, and a role policy attachment.

# RegisterDevice: SNS permissions
data "aws_iam_policy_document" "RegisterDevice_services" {
  # SNS: OfflineMediaDownloader
  statement {
    actions   = ["sns:Publish", "sns:Subscribe"]
    resources = [aws_sns_platform_application.OfflineMediaDownloader[0].arn]
  }
}

resource "aws_iam_policy" "RegisterDevice_services" {
  name   = "RegisterDevice-services"
  policy = data.aws_iam_policy_document.RegisterDevice_services.json
  tags   = local.common_tags
}

resource "aws_iam_role_policy_attachment" "RegisterDevice_services" {
  role       = aws_iam_role.RegisterDevice.name
  policy_arn = aws_iam_policy.RegisterDevice_services.arn
}

# S3ObjectCreated: SQS permissions
data "aws_iam_policy_document" "S3ObjectCreated_services" {
  # SQS: SendPushNotification
  statement {
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.SendPushNotification.arn]
  }
}

resource "aws_iam_policy" "S3ObjectCreated_services" {
  name   = "S3ObjectCreated-services"
  policy = data.aws_iam_policy_document.S3ObjectCreated_services.json
  tags   = local.common_tags
}

resource "aws_iam_role_policy_attachment" "S3ObjectCreated_services" {
  role       = aws_iam_role.S3ObjectCreated.name
  policy_arn = aws_iam_policy.S3ObjectCreated_services.arn
}

# SendPushNotification: SNS permissions
data "aws_iam_policy_document" "SendPushNotification_services" {
  # SNS: OfflineMediaDownloader
  statement {
    actions   = ["sns:Publish"]
    resources = [aws_sns_platform_application.OfflineMediaDownloader[0].arn]
  }
}

resource "aws_iam_policy" "SendPushNotification_services" {
  name   = "SendPushNotification-services"
  policy = data.aws_iam_policy_document.SendPushNotification_services.json
  tags   = local.common_tags
}

resource "aws_iam_role_policy_attachment" "SendPushNotification_services" {
  role       = aws_iam_role.SendPushNotification.name
  policy_arn = aws_iam_policy.SendPushNotification_services.arn
}

# StartFileUpload: S3 + SQS + EventBridge permissions
data "aws_iam_policy_document" "StartFileUpload_services" {
  # S3: Files/*
  statement {
    actions   = ["s3:HeadObject", "s3:PutObject"]
    resources = ["${aws_s3_bucket.Files.arn}/*"]
  }
  # SQS: SendPushNotification
  statement {
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.SendPushNotification.arn]
  }
  # EventBridge: MediaDownloader
  statement {
    actions   = ["events:PutEvents"]
    resources = [aws_cloudwatch_event_bus.MediaDownloader.arn]
  }
}

resource "aws_iam_policy" "StartFileUpload_services" {
  name   = "StartFileUpload-services"
  policy = data.aws_iam_policy_document.StartFileUpload_services.json
  tags   = local.common_tags
}

resource "aws_iam_role_policy_attachment" "StartFileUpload_services" {
  role       = aws_iam_role.StartFileUpload.name
  policy_arn = aws_iam_policy.StartFileUpload_services.arn
}

# WebhookFeedly: SQS + EventBridge + DynamoDB permissions
data "aws_iam_policy_document" "WebhookFeedly_services" {
  # SQS: SendPushNotification
  statement {
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.SendPushNotification.arn]
  }
  # EventBridge: MediaDownloader
  statement {
    actions   = ["events:PutEvents"]
    resources = [aws_cloudwatch_event_bus.MediaDownloader.arn]
  }
  # DynamoDB: IdempotencyTable
  statement {
    actions   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem"]
    resources = [aws_dynamodb_table.IdempotencyTable.arn]
  }
}

resource "aws_iam_policy" "WebhookFeedly_services" {
  name   = "WebhookFeedly-services"
  policy = data.aws_iam_policy_document.WebhookFeedly_services.json
  tags   = local.common_tags
}

resource "aws_iam_role_policy_attachment" "WebhookFeedly_services" {
  role       = aws_iam_role.WebhookFeedly.name
  policy_arn = aws_iam_policy.WebhookFeedly_services.arn
}
