import * as AWS from 'aws-sdk'
import { GetSecretValueRequest, GetSecretValueResponse } from 'aws-sdk/clients/secretsmanager'
const asm = new AWS.SecretsManager({ apiVersion: '2017-10-17' })
export function getSecretValue(params: GetSecretValueRequest): Promise<GetSecretValueResponse> {
  return asm.getSecretValue(params).promise()
}
