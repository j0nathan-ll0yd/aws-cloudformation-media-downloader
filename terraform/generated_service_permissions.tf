# Auto-generated Lambda IAM policies from @RequiresServices and @RequiresDynamoDB decorators
# Generated at: 2026-01-20T05:30:09.793Z
# Source: build/service-permissions.json, build/dynamodb-permissions.json
#
# DO NOT EDIT - regenerate with: pnpm run generate:service-iam-policies
#
# This file creates IAM policies based on the @RequiresServices and @RequiresDynamoDB
# decorator declarations in Lambda handler code. Each Lambda gets a policy document,
# an IAM policy, and a role policy attachment.

# ApiGatewayAuthorizer: API Gateway permissions
data "aws_iam_policy_document" "ApiGatewayAuthorizer_services" {
  # API Gateway: *
  statement {
    actions   = ["apigateway:GET:/apikeys", "apigateway:GET:/usageplans", "apigateway:GET:/usageplans/*/usage"]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "ApiGatewayAuthorizer_services" {
  name   = "ApiGatewayAuthorizer-services"
  policy = data.aws_iam_policy_document.ApiGatewayAuthorizer_services.json
  tags   = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ApiGatewayAuthorizer_services" {
  role       = aws_iam_role.ApiGatewayAuthorizer.name
  policy_arn = aws_iam_policy.ApiGatewayAuthorizer_services.arn
}

# RegisterDevice: SNS permissions
data "aws_iam_policy_document" "RegisterDevice_services" {
  # SNS: OfflineMediaDownloader
  statement {
    actions   = ["sns:CreatePlatformEndpoint", "sns:DeleteEndpoint", "sns:Publish"]
    resources = [aws_sns_platform_application.OfflineMediaDownloader[0].arn]
  }
  # SNS: PushNotifications
  statement {
    actions   = ["sns:ListSubscriptionsByTopic", "sns:Subscribe", "sns:Unsubscribe"]
    resources = [aws_sns_topic.PushNotifications.arn]
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
    actions   = ["sns:CreatePlatformEndpoint", "sns:DeleteEndpoint", "sns:Publish"]
    resources = [aws_sns_platform_application.OfflineMediaDownloader[0].arn]
  }
  # SNS: PushNotifications
  statement {
    actions   = ["sns:ListSubscriptionsByTopic", "sns:Subscribe", "sns:Unsubscribe"]
    resources = [aws_sns_topic.PushNotifications.arn]
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

# StartFileUpload: EventBridge + S3 + SQS permissions
data "aws_iam_policy_document" "StartFileUpload_services" {
  # EventBridge: MediaDownloader
  statement {
    actions   = ["events:PutEvents"]
    resources = [aws_cloudwatch_event_bus.MediaDownloader.arn]
  }
  # S3: Files/*
  statement {
    actions   = ["s3:AbortMultipartUpload", "s3:HeadObject", "s3:ListMultipartUploadParts", "s3:PutObject"]
    resources = ["${aws_s3_bucket.Files.arn}/*"]
  }
  # SQS: SendPushNotification
  statement {
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.SendPushNotification.arn]
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

# WebhookFeedly: EventBridge + SQS + DynamoDB permissions
data "aws_iam_policy_document" "WebhookFeedly_services" {
  # EventBridge: MediaDownloader
  statement {
    actions   = ["events:PutEvents"]
    resources = [aws_cloudwatch_event_bus.MediaDownloader.arn]
  }
  # SQS: SendPushNotification
  statement {
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.SendPushNotification.arn]
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
