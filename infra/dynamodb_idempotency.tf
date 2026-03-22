# DynamoDB Table for Powertools Idempotency
#
# Stores idempotency records to prevent duplicate processing.
# TTL automatically cleans up expired records.

resource "aws_dynamodb_table" "idempotency" {
  name         = "${module.core.name_prefix}-MediaDownloader-Idempotency"
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

  tags = module.core.common_tags
}
