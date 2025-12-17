export interface User {
  userId: string
  email: string
  emailVerified: boolean
  firstName: string
  lastName?: string
}

export interface Device {
  name: string
  token: string
  systemVersion: string
  deviceId: string
  systemName: string
  endpointArn: string
}

export interface IdentityProvider {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresAt: number
}
