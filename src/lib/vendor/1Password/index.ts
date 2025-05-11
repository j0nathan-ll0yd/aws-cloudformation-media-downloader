import sdk from '@1password/sdk'
import { logDebug } from '../../../util/lambda-helpers'

// Mapping for secret names to 1Password paths
const secretPathMap: Record<string, string> = {
  'GithubPersonalToken': 'op://AWS/GithubPersonalToken/credential',
  'ApnsSigningKey': 'op://AWS/ApnsSigningKey/credential',
  'ApplePushNotificationServiceKey': 'op://AWS/ApplePushNotificationServiceKey/credential',
  'ApplePushNotificationServiceCert': 'op://AWS/ApplePushNotificationServiceCert/credential',
  'PrivateEncryptionKey': 'op://AWS/PrivateEncryptionKey/credential',
  'prod/SignInWithApple/Config': 'op://AWS/6rocnkruqbz74rdl2gyc2cxe5y/credential',
  'prod/SignInWithApple/AuthKey': 'op://AWS/3wf2hes3b62foviwmwvedju2s4/credential',
}

// Initialize the 1Password client
let onePasswordClient: Awaited<ReturnType<typeof sdk.createClient>> | null = null

/**
 * Gets or creates the 1Password client
 * @returns The 1Password client
 */
async function getOnePasswordClient() {
  if (onePasswordClient) {
    return onePasswordClient
  }
  
  if (!process.env.OP_SERVICE_ACCOUNT_TOKEN) {
    throw new Error('OP_SERVICE_ACCOUNT_TOKEN environment variable is not set')
  }
  
  onePasswordClient = await sdk.createClient({
    auth: process.env.OP_SERVICE_ACCOUNT_TOKEN,
    integrationName: 'AWS Media Downloader',
    integrationVersion: '1.0.0'
  })
  
  return onePasswordClient
}

/**
 * Get a secret value from 1Password
 * @param params Object containing the name of the secret to fetch
 * @returns Response object with the secret value
 */
export async function getSecretValue(params: { SecretId: string }): Promise<{ SecretString?: string }> {
  const secretName = params.SecretId
  
  if (!secretName) {
    throw new Error('Secret name is required')
  }
  
  const opPath = secretPathMap[secretName]
  
  if (!opPath) {
    throw new Error(`No 1Password path mapping found for secret: ${secretName}`)
  }
  
  logDebug(`Fetching secret from 1Password: ${opPath}`)
  
  try {
    const client = await getOnePasswordClient()
    const secretValue = await client.secrets.resolve(opPath)
    
    return {
      SecretString: secretValue
    }
  } catch (error) {
    logDebug(`Error fetching secret from 1Password: ${error}`)
    throw error
  }
}