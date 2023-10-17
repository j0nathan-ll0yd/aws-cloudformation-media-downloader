
resource "aws_secretsmanager_secret" "ApnsSigningKey" {
  name                    = "ApnsSigningKey"
  description             = "The private signing key for APNS"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "ApnsSigningKey" {
  secret_id     = aws_secretsmanager_secret.ApnsSigningKey.id
  secret_string = file(var.apnsSigningKey)
}

resource "aws_sns_topic" "PushNotifications" {
  name = "PushNotifications"
}

resource "aws_sns_platform_application" "OfflineMediaDownloader" {
  count                     = fileexists(var.apnsPrivateKeyPath) && fileexists(var.apnsCertificatePath) ? 1 : 0
  name                      = "OfflineMediaDownloader"
  platform                  = "APNS_SANDBOX"
  platform_credential       = file(var.apnsPrivateKeyPath)  # APNS PRIVATE KEY
  platform_principal        = file(var.apnsCertificatePath) # APNS CERTIFICATE
  success_feedback_role_arn = aws_iam_role.SNSLoggingRole.arn
  failure_feedback_role_arn = aws_iam_role.SNSLoggingRole.arn
}

data "aws_iam_policy_document" "SNSAssumeRole" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["sns.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "SNSLoggingRole" {
  name               = "SNSLoggingRole"
  assume_role_policy = data.aws_iam_policy_document.SNSAssumeRole.json
}

data "aws_iam_policy_document" "CommonLambdaLogging" {
  statement {
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = ["arn:aws:logs:*:*:*"]
  }
}

resource "aws_iam_policy" "CommonLambdaLogging" {
  name        = "CommonLambdaLogging"
  description = "Allows Lambda functions to write to ALL CloudWatch logs"
  policy      = data.aws_iam_policy_document.CommonLambdaLogging.json
}

resource "aws_iam_role_policy_attachment" "SNSLoggingRolePolicy" {
  role       = aws_iam_role.SNSLoggingRole.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}

resource "aws_dynamodb_table" "UserDevices" {
  name           = "UserDevices"
  billing_mode   = "PROVISIONED"
  read_capacity  = 5
  write_capacity = 5
  hash_key       = "userId"

  attribute {
    name = "userId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "Devices" {
  name           = "Devices"
  billing_mode   = "PROVISIONED"
  read_capacity  = 5
  write_capacity = 5
  hash_key       = "deviceId"

  attribute {
    name = "deviceId"
    type = "S"
  }
}
