import {DynamoDBFile, IdentityProviderApple, User, Device} from '../types/main'
import {FileStatus} from '../types/enums'
import {BatchGetCommand, DeleteCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand} from '@aws-sdk/lib-dynamodb'

function transformObjectToDynamoUpdateQuery(item: object) {
  let UpdateExpression = 'SET'
  const ExpressionAttributeNames: Record<string, string> = {}
  const ExpressionAttributeValues: Record<string, number | string> = {}
  for (const property in item) {
    if (property === 'fileId') {
      continue
    }
    /* istanbul ignore else */
    if (Object.prototype.hasOwnProperty.call(item, property)) {
      UpdateExpression += ` #${property} = :${property} ,`
      ExpressionAttributeNames['#' + property] = property
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      ExpressionAttributeValues[':' + property] = item[property]
    }
  }
  UpdateExpression = UpdateExpression.slice(0, -1)
  return {
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues
  }
}

export function updateCompletedFileParams(tableName: string, fileId: string, fileUrl: string) {
  const updateCommand = new UpdateCommand({
    ExpressionAttributeNames: {'#FN': 'url', '#S': 'status'},
    ExpressionAttributeValues: {':fn': fileUrl, ':s': FileStatus.Downloaded},
    Key: {fileId: fileId},
    ReturnValues: 'ALL_NEW',
    TableName: tableName,
    UpdateExpression: 'SET #FN = :fn, #S = :s'
  })
  return updateCommand.input
}

export function scanForFileParams(tableName: string) {
  const scanCommand = new ScanCommand({
    ExpressionAttributeNames: {
      '#AA': 'availableAt',
      '#FID': 'fileId',
      '#FN': 'url'
    },
    ExpressionAttributeValues: {
      ':aa': parseInt(Date.now().toString(), 10)
    },
    FilterExpression: '#AA <= :aa AND attribute_not_exists(#FN)',
    ProjectionExpression: '#AA, #FID',
    TableName: tableName
  })
  return scanCommand.input
}

export function getFileByKey(tableName: string, fileName: string) {
  const scanCommand = new ScanCommand({
    ExpressionAttributeNames: {'#key': 'key'},
    ExpressionAttributeValues: {':key': fileName},
    FilterExpression: '#key = :key',
    TableName: tableName
  })
  return scanCommand.input
}

export function getUsersByFileId(tableName: string, fileId: string) {
  const scanCommand = new ScanCommand({
    ExpressionAttributeValues: {':fileId': fileId},
    FilterExpression: 'contains (fileId, :fileId)',
    TableName: tableName
  })
  return scanCommand.input
}

export function getUsersByDeviceId(tableName: string, deviceId: string) {
  const scanCommand = new ScanCommand({
    ExpressionAttributeValues: {':deviceId': deviceId},
    FilterExpression: 'contains (devices, :deviceId)',
    TableName: tableName
  })
  return scanCommand.input
}

export function userFileParams(tableName: string, userId: string, fileId: string) {
  const updateCommand = new UpdateCommand({
    ExpressionAttributeNames: {'#FID': 'fileId'},
    ExpressionAttributeValues: {':fid': new Set([fileId])},
    Key: {userId: userId},
    ReturnValues: 'ALL_NEW',
    UpdateExpression: 'ADD #FID :fid',
    TableName: tableName
  })
  return updateCommand.input
}

export function userDevicesParams(tableName: string, userId: string, deviceId: string) {
  const updateCommand = new UpdateCommand({
    ExpressionAttributeNames: {'#DID': 'devices'},
    ExpressionAttributeValues: {':did': new Set([deviceId])},
    Key: {userId: userId},
    ReturnValues: 'NONE',
    UpdateExpression: 'ADD #DID :did',
    TableName: tableName
  })
  return updateCommand.input
}

export function deleteSingleUserDeviceParams(tableName: string, userId: string, deviceId: string) {
  const updateCommand = new UpdateCommand({
    TableName: tableName,
    Key: {userId},
    UpdateExpression: 'DELETE devices :deviceId',
    ExpressionAttributeValues: {':deviceId': new Set([deviceId])}
  })
  return updateCommand.input
}

export function upsertDeviceParams(tableName: string, device: Device) {
  const {deviceId, ...deviceSubset} = device
  const {UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues} = transformObjectToDynamoUpdateQuery(deviceSubset)
  const updateCommand = new UpdateCommand({
    Key: {deviceId},
    TableName: tableName,
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues
  })
  return updateCommand.input
}

export function queryUserDeviceParams(tableName: string, userId: string) {
  const queryCommand = new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {':userId': userId}
  })
  return queryCommand.input
}

export function queryFileParams(tableName: string, fileId: string) {
  const queryCommand = new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'fileId = :fileId',
    ExpressionAttributeValues: {':fileId': fileId}
  })
  return queryCommand.input
}

export function queryDeviceParams(tableName: string, deviceId: string) {
  const queryCommand = new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'deviceId = :deviceId',
    ExpressionAttributeValues: {':deviceId': deviceId}
  })
  return queryCommand.input
}

export function getUserDeviceByUserIdParams(tableName: string, userId: string) {
  const queryCommand = new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {':userId': userId}
  })
  return queryCommand.input
}

export function getDeviceParams(tableName: string, deviceId: string) {
  const queryCommand = new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'deviceId = :deviceId',
    ExpressionAttributeValues: {':deviceId': deviceId}
  })
  return queryCommand.input
}

export function deleteDeviceParams(tableName: string, deviceId: string) {
  const deleteCommand = new DeleteCommand({
    TableName: tableName,
    Key: {deviceId}
  })
  return deleteCommand.input
}

export function deleteUserParams(tableName: string, userId: string) {
  const deleteCommand = new DeleteCommand({
    TableName: tableName,
    Key: {userId}
  })
  return deleteCommand.input
}

export function deleteUserFilesParams(tableName: string, userId: string) {
  const deleteCommand = new DeleteCommand({
    TableName: tableName,
    Key: {userId}
  })
  return deleteCommand.input
}

export function deleteAllUserDeviceParams(tableName: string, userId: string) {
  const deleteCommand = new DeleteCommand({
    TableName: tableName,
    Key: {userId}
  })
  return deleteCommand.input
}

export function newFileParams(tableName: string, fileId: string) {
  const updateCommand = new UpdateCommand({
    ExpressionAttributeNames: {
      '#AA': 'availableAt',
      '#S': 'status'
    },
    ExpressionAttributeValues: {
      ':aa': parseInt(Date.now().toString(), 10),
      ':s': FileStatus.PendingMetadata
    },
    Key: {fileId: fileId},
    ReturnValues: 'ALL_OLD',
    UpdateExpression: 'SET #AA = :aa, #S = :s',
    TableName: tableName
  })
  return updateCommand.input
}

export function newUserParams(tableName: string, user: User, identityProviderApple: IdentityProviderApple) {
  const putCommand = new PutCommand({
    Item: {
      ...user,
      identityProviders: {...identityProviderApple}
    },
    TableName: tableName
  })
  return putCommand.input
}

export function updateFileMetadataParams(tableName: string, item: DynamoDBFile) {
  const {UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues} = transformObjectToDynamoUpdateQuery(item)
  const updateCommand = new UpdateCommand({
    Key: {fileId: item.fileId},
    TableName: tableName,
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues
  })
  return updateCommand.input
}

export function getUserFilesParams(tableName: string, userId: string) {
  const queryCommand = new QueryCommand({
    ExpressionAttributeValues: {
      ':uid': userId
    },
    ExpressionAttributeNames: {
      '#uid': 'userId'
    },
    KeyConditionExpression: '#uid = :uid',
    TableName: tableName
  })
  return queryCommand.input
}

export function getBatchFilesParams(tableName: string, files: string[]) {
  const Keys = []
  const mySet = new Set(files)
  for (const fileId of mySet.values()) {
    Keys.push({fileId})
  }

  const batchGetItemCommand = new BatchGetCommand({
    RequestItems: {
      [tableName]: {
        Keys
      }
    }
  })
  return batchGetItemCommand.input
}

export function getUserByAppleDeviceIdentifierParams(tableName: string, userId: string) {
  const scanCommand = new ScanCommand({
    ExpressionAttributeValues: {':userId': userId},
    FilterExpression: 'identityProviders.userId = :userId',
    TableName: tableName
  })
  return scanCommand.input
}
