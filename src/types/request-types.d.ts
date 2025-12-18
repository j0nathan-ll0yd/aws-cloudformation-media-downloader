export interface UserRegistrationInput {
  idToken: string
  email: string
  firstName?: string
  lastName?: string
}

export interface UserLoginInput {
  idToken: string
}

export interface DeviceRegistrationRequest {
  name: string
  token: string
  systemVersion: string
  deviceId: string
  systemName: string
}

export interface UserSubscribeInput {
  endpointArn: string
  topicArn: string
}
