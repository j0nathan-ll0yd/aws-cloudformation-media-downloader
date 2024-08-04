import {SecretsManager, GetSecretValueRequest, GetSecretValueResponse} from '@aws-sdk/client-secrets-manager'
const asm = new SecretsManager()
export function getSecretValue(params: GetSecretValueRequest): Promise<GetSecretValueResponse> {
  return asm.getSecretValue(params)
}
