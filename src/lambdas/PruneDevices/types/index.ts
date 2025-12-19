/**
 * Result of the PruneDevices operation
 */
export interface PruneDevicesResult {
  devicesChecked: number
  devicesPruned: number
  errors: string[]
}

export interface ApplePushNotificationResponse {
  statusCode: number
  reason?: string
}
