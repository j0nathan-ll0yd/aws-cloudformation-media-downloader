# DynamoDB table for Powertools Idempotency
# Stores idempotency records to prevent duplicate processing
# TTL automatically cleans up expired records

resource "aws_dynamodb_table" "IdempotencyTable" {
  name         = "${var.resource_prefix}-MediaDownloader-Idempotency"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  ttl {
    attribute_name = "expiration"
    enabled        = true
  }

  tags = merge(local.common_tags, {
    Name    = "${var.resource_prefix}-MediaDownloader-Idempotency"
    Purpose = "Powertools idempotency storage"
  })
}

output "idempotency_table_name" {
  description = "Name of the Idempotency DynamoDB table"
  value       = aws_dynamodb_table.IdempotencyTable.name
}

output "idempotency_table_arn" {
  description = "ARN of the Idempotency DynamoDB table"
  value       = aws_dynamodb_table.IdempotencyTable.arn
}
