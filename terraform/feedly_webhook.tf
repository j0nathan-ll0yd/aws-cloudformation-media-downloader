resource "aws_iam_role" "WebhookFeedlyRole" {
  name               = "WebhookFeedlyRole"
  assume_role_policy = data.aws_iam_policy_document.lambda-assume-role-policy.json
}

data "aws_iam_policy_document" "WebhookFeedlyRole" {
  statement {
    actions = [
      "sqs:SendMessage"
    ]
    resources = [
      aws_sqs_queue.SendPushNotification.arn
    ]
  }
  statement {
    actions   = ["dynamodb:UpdateItem", "dynamodb:Query"]
    resources = [aws_dynamodb_table.Files.arn, aws_dynamodb_table.UserFiles.arn]
  }
}

resource "aws_iam_policy" "WebhookFeedlyRolePolicy" {
  name   = "WebhookFeedlyRolePolicy"
  policy = data.aws_iam_policy_document.WebhookFeedlyRole.json
}

resource "aws_iam_role_policy_attachment" "WebhookFeedlyPolicy" {
  role       = aws_iam_role.WebhookFeedlyRole.name
  policy_arn = aws_iam_policy.WebhookFeedlyRolePolicy.arn
}

resource "aws_iam_role_policy_attachment" "WebhookFeedlyPolicyLogging" {
  role       = aws_iam_role.WebhookFeedlyRole.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}

resource "aws_lambda_permission" "WebhookFeedly" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.WebhookFeedly.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_cloudwatch_log_group" "WebhookFeedly" {
  name              = "/aws/lambda/${aws_lambda_function.WebhookFeedly.function_name}"
  retention_in_days = 14
}

data "archive_file" "WebhookFeedly" {
  type        = "zip"
  source_file = "./../build/lambdas/WebhookFeedly.js"
  output_path = "./../build/lambdas/WebhookFeedly.zip"
}

resource "aws_lambda_function" "WebhookFeedly" {
  description      = "A webhook from Feedly via IFTTT"
  function_name    = "WebhookFeedly"
  role             = aws_iam_role.WebhookFeedlyRole.arn
  handler          = "WebhookFeedly.handleFeedlyEvent"
  runtime          = "nodejs12.x"
  depends_on       = [aws_iam_role_policy_attachment.WebhookFeedlyPolicy]
  filename         = data.archive_file.WebhookFeedly.output_path
  source_code_hash = data.archive_file.WebhookFeedly.output_base64sha256

  environment {
    variables = {
      DynamoDBTableFiles     = aws_dynamodb_table.Files.name
      DynamoDBTableUserFiles = aws_dynamodb_table.UserFiles.name
      SNSQueueUrl            = aws_sqs_queue.SendPushNotification.id
      WebhookFeedlyEnvVar = "WebhookFeedly"
    }
  }
}

resource "aws_api_gateway_resource" "Feedly" {
  rest_api_id = aws_api_gateway_rest_api.Main.id
  parent_id   = aws_api_gateway_rest_api.Main.root_resource_id
  path_part   = "feedly"
}

resource "aws_api_gateway_method" "WebhookFeedlyPost" {
  rest_api_id      = aws_api_gateway_rest_api.Main.id
  resource_id      = aws_api_gateway_resource.Feedly.id
  http_method      = "POST"
  authorization    = "NONE"
  api_key_required = true
}

resource "aws_api_gateway_integration" "WebhookFeedlyPost" {
  rest_api_id             = aws_api_gateway_rest_api.Main.id
  resource_id             = aws_api_gateway_resource.Feedly.id
  http_method             = aws_api_gateway_method.WebhookFeedlyPost.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.WebhookFeedly.invoke_arn
}

resource "aws_dynamodb_table" "Files" {
  name           = "Files"
  billing_mode   = "PROVISIONED"
  read_capacity  = 5
  write_capacity = 5
  hash_key       = "fileId"

  attribute {
    name = "fileId"
    type = "S"
  }
}

data "aws_iam_policy_document" "MultipartUpload" {
  statement {
    actions   = ["dynamodb:UpdateItem"]
    resources = [aws_dynamodb_table.Files.arn]
  }
  statement {
    actions = [
      "s3:PutObject",
      "s3:PutObjectAcl",
      "s3:GetObject",
    ]
    resources = ["${aws_s3_bucket.Files.arn}/*"]
  }
  statement {
    actions = [
      "s3:ListBucket",
      "s3:AbortMultipartUpload",
      "s3:ListMultipartUploadParts",
      "s3:ListBucketMultipartUploads"
    ]
    resources = [aws_s3_bucket.Files.arn]
  }
}

resource "aws_iam_role" "MultipartUploadRole" {
  name               = "MultipartUploadRole"
  assume_role_policy = data.aws_iam_policy_document.lambda-assume-role-policy.json
}

resource "aws_iam_policy" "MultipartUploadRolePolicy" {
  name   = "MultipartUploadRolePolicy"
  policy = data.aws_iam_policy_document.MultipartUpload.json
}

resource "aws_iam_role_policy_attachment" "MultipartUploadPolicy" {
  role       = aws_iam_role.MultipartUploadRole.name
  policy_arn = aws_iam_policy.MultipartUploadRolePolicy.arn
}

resource "aws_iam_role_policy_attachment" "MultipartUploadPolicyLogging" {
  role       = aws_iam_role.MultipartUploadRole.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}

data "archive_file" "StartFileUpload" {
  type        = "zip"
  source_file = "./../build/lambdas/StartFileUpload.js"
  output_path = "./../build/lambdas/StartFileUpload.zip"
}

resource "aws_lambda_function" "StartFileUpload" {
  description      = "Starts the multipart upload"
  function_name    = "StartFileUpload"
  role             = aws_iam_role.MultipartUploadRole.arn
  handler          = "StartFileUpload.startFileUpload"
  runtime          = "nodejs12.x"
  depends_on       = [aws_iam_role_policy_attachment.MultipartUploadPolicy]
  timeout          = 900
  filename         = data.archive_file.StartFileUpload.output_path
  source_code_hash = data.archive_file.StartFileUpload.output_base64sha256

  environment {
    variables = {
      Bucket        = aws_s3_bucket.Files.id
      DynamoDBTable = aws_dynamodb_table.Files.name
      Static = "String"
    }
  }
}

resource "aws_lambda_permission" "StartFileUpload" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.StartFileUpload.function_name
  principal     = "events.amazonaws.com"
}

resource "aws_cloudwatch_log_group" "StartFileUpload" {
  name              = "/aws/lambda/${aws_lambda_function.StartFileUpload.function_name}"
  retention_in_days = 14
}

data "archive_file" "UploadPart" {
  type        = "zip"
  source_file = "./../build/lambdas/UploadPart.js"
  output_path = "./../build/lambdas/UploadPart.zip"
}

resource "aws_lambda_function" "UploadPart" {
  description      = "Uploads a part of a multipart upload"
  function_name    = "UploadPart"
  role             = aws_iam_role.MultipartUploadRole.arn
  handler          = "UploadPart.uploadFilePart"
  runtime          = "nodejs12.x"
  depends_on       = [aws_iam_role_policy_attachment.MultipartUploadPolicy]
  filename         = data.archive_file.UploadPart.output_path
  source_code_hash = data.archive_file.UploadPart.output_base64sha256
}

resource "aws_cloudwatch_log_group" "UploadPart" {
  name              = "/aws/lambda/${aws_lambda_function.UploadPart.function_name}"
  retention_in_days = 14
}

data "archive_file" "CompleteFileUpload" {
  type        = "zip"
  source_file = "./../build/lambdas/CompleteFileUpload.js"
  output_path = "./../build/lambdas/CompleteFileUpload.zip"
}

resource "aws_lambda_function" "CompleteFileUpload" {
  description      = "Completes the multipart upload"
  function_name    = "CompleteFileUpload"
  role             = aws_iam_role.MultipartUploadRole.arn
  handler          = "CompleteFileUpload.completeFileUpload"
  runtime          = "nodejs12.x"
  depends_on       = [aws_iam_role_policy_attachment.MultipartUploadPolicy]
  filename         = data.archive_file.CompleteFileUpload.output_path
  source_code_hash = data.archive_file.CompleteFileUpload.output_base64sha256

  environment {
    variables = {
      DynamoDBTable = aws_dynamodb_table.Files.name
    }
  }
}

resource "aws_cloudwatch_log_group" "CompleteFileUpload" {
  name              = "/aws/lambda/${aws_lambda_function.CompleteFileUpload.function_name}"
  retention_in_days = 14
}

resource "aws_iam_role" "MultipartUploadStateMachine" {
  name               = "MultipartUploadStateMachine"
  assume_role_policy = data.aws_iam_policy_document.states-assume-role-policy.json
}

data "aws_iam_policy_document" "MultipartUploadStateMachine" {
  statement {
    actions = ["lambda:InvokeFunction"]
    resources = [
      aws_lambda_function.StartFileUpload.arn,
      aws_lambda_function.UploadPart.arn,
      aws_lambda_function.CompleteFileUpload.arn,
    ]
  }
}

resource "aws_iam_policy" "MultipartUploadStateMachineRolePolicy" {
  name   = "MultipartUploadStateMachineRolePolicy"
  policy = data.aws_iam_policy_document.MultipartUploadStateMachine.json
}

resource "aws_iam_role_policy_attachment" "MultipartUploadStateMachinePolicy" {
  role       = aws_iam_role.MultipartUploadStateMachine.name
  policy_arn = aws_iam_policy.MultipartUploadStateMachineRolePolicy.arn
}

resource "aws_iam_role_policy_attachment" "MultipartUploadStateMachinePolicyLogging" {
  role       = aws_iam_role.MultipartUploadStateMachine.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}

resource "aws_sfn_state_machine" "MultipartUpload" {
  name     = "MultipartUpload"
  role_arn = aws_iam_role.MultipartUploadStateMachine.arn
  depends_on = [
    aws_lambda_function.StartFileUpload,
    aws_lambda_function.UploadPart,
    aws_lambda_function.CompleteFileUpload
  ]
  definition = <<EOF
{
  "Comment": "A multipart file upload via S3",
  "StartAt": "StartUpload",
  "States": {
    "StartUpload": {
      "Type" : "Task",
      "Resource": "${aws_lambda_function.StartFileUpload.arn}",
      "TimeoutSeconds": 900,
      "HeartbeatSeconds": 600,
      "Next": "UploadOrComplete"
    },
    "UploadPart": {
      "Type" : "Task",
      "Resource": "${aws_lambda_function.UploadPart.arn}",
      "Next": "UploadOrComplete"
    },
    "CompleteUpload": {
      "Type" : "Task",
      "Resource": "${aws_lambda_function.CompleteFileUpload.arn}",
      "End": true
    },
    "UploadOrComplete": {
      "Type": "Choice",
      "Choices": [
        {
          "Variable": "$.bytesRemaining",
          "NumericGreaterThan": 0,
          "Next": "UploadPart"
        },
        {
          "Variable": "$.bytesRemaining",
          "NumericEquals": 0,
          "Next": "CompleteUpload"
        }
      ]
    }
  }
}
EOF
}
