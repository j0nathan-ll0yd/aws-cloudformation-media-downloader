import {GetSecretValueCommand, PutSecretValueCommand} from '@aws-sdk/client-secrets-manager'
import type {
  GetSecretValueCommandInput,
  GetSecretValueCommandOutput,
  PutSecretValueCommandInput,
  PutSecretValueCommandOutput
} from '@aws-sdk/client-secrets-manager'
import {createSecretsManagerClient} from './clients'

const secretsManagerClient = createSecretsManagerClient()

// Re-export types for application code to use
export type { GetSecretValueCommandInput, PutSecretValueCommandInput }

/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
export function getSecretValue(params: GetSecretValueCommandInput): Promise<GetSecretValueCommandOutput> {
  const command = new GetSecretValueCommand(params)
  return secretsManagerClient.send(command)
}
/* c8 ignore stop */

/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
export function putSecretValue(params: PutSecretValueCommandInput): Promise<PutSecretValueCommandOutput> {
  const command = new PutSecretValueCommand(params)
  return secretsManagerClient.send(command)
}
/* c8 ignore stop */
