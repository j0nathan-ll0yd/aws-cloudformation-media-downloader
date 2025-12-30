# DynamoDB table for Powertools Idempotency
# Stores idempotency records to prevent duplicate processing
# TTL automatically cleans up expired records

resource "aws_dynamodb_table" "IdempotencyTable" {
  name         = "MediaDownloader-Idempotency"
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
    Name    = "MediaDownloader-Idempotency"
    Purpose = "Powertools idempotency storage"
  })
}
