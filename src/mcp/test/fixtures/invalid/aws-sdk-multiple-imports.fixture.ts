/**
 * @fixture invalid
 * @rule aws-sdk-encapsulation
 * @severity CRITICAL
 * @description Multiple direct AWS SDK imports (forbidden)
 * @expectedViolations 3
 */
import {DynamoDBClient} from '@aws-sdk/client-dynamodb'
import {S3Client} from '@aws-sdk/client-s3'
import {SNSClient} from '@aws-sdk/client-sns'

const dynamoClient = new DynamoDBClient({})
const s3Client = new S3Client({})
const snsClient = new SNSClient({})

export {dynamoClient, s3Client, snsClient}
