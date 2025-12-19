/**
 * @fixture valid
 * @rule aws-sdk-encapsulation
 * @description Using vendor wrappers (allowed)
 * @expectedViolations 0
 */
import {queryItems} from '#lib/vendor/AWS/DynamoDB'
import {uploadToS3} from '#lib/vendor/AWS/S3'

export async function handler() {
	const items = await queryItems({TableName: 'test'})
	await uploadToS3({Bucket: 'test', Key: 'file.txt', Body: 'content'})
	return items
}
