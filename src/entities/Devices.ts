import {documentClient, Entity} from '#lib/vendor/ElectroDB/entity'

/**
 * Devices Entity - iOS device registration for push notifications.
 *
 * Manages Apple Push Notification Service (APNS) endpoint associations.
 * Each device has a unique deviceToken from iOS and an SNS endpointArn for delivery.
 *
 * Lifecycle:
 * 1. Created when user registers device in iOS app (RegisterDevice Lambda)
 * 2. Updated when device token changes (app reinstall, iOS update)
 * 3. Deleted when user unregisters or device goes stale (PruneDevices Lambda)
 *
 * Device Token Flow:
 * - iOS app requests push notification permission
 * - iOS provides device token (hex string)
 * - App sends token to RegisterDevice Lambda
 * - Lambda creates SNS platform endpoint
 * - endpointArn stored for push notification delivery
 *
 * Staleness Detection:
 * - APNS returns "Unregistered" when token is invalid
 * - PruneDevices Lambda runs daily to clean stale endpoints
 * - Stale devices are unlinked from users and deleted
 *
 * Access Patterns:
 * - Primary: Get device by deviceId
 * - No secondary indexes (devices queried via UserDevices relationship)
 *
 * @see UserDevices for user-device associations
 * @see RegisterDevice Lambda for device registration
 * @see SendPushNotification Lambda for notification delivery
 * @see PruneDevices Lambda for stale device cleanup
 */
export const Devices = new Entity(
  {
    model: {entity: 'Device', version: '1', service: 'MediaDownloader'},
    attributes: {
      deviceId: {type: 'string', required: true, readOnly: true},
      name: {type: 'string', required: true},
      token: {type: 'string', required: true},
      systemVersion: {type: 'string', required: true},
      systemName: {type: 'string', required: true},
      endpointArn: {type: 'string', required: true}
    },
    indexes: {primary: {pk: {field: 'pk', composite: ['deviceId']}, sk: {field: 'sk', composite: []}}}
  } as const,
  {table: process.env.DYNAMODB_TABLE_NAME, client: documentClient}
)

// Type exports for use in application code
export type DeviceItem = ReturnType<typeof Devices.parse>
export type CreateDeviceInput = Parameters<typeof Devices.create>[0]
export type UpdateDeviceInput = Parameters<typeof Devices.update>[0]
export type UpsertDeviceInput = Parameters<typeof Devices.upsert>[0]
