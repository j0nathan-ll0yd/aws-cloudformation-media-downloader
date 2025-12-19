/**
 * @fixture invalid
 * @rule env-validation
 * @severity CRITICAL
 * @description Multiple direct process.env accesses (forbidden)
 * @expectedViolations 3
 */
const region = process.env.AWS_REGION
const bucket = process.env.S3_BUCKET_NAME
const table = process.env.DYNAMODB_TABLE_NAME
