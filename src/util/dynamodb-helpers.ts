import {DynamoDBFile, IdentityProviderApple, User, Device} from '../types/main'
import {FileStatus} from '../types/enums'
import {BatchGetItemInput, DeleteItemInput, PutItemInput, QueryInput, ScanInput, UpdateItemInput} from '@aws-sdk/client-dynamodb'

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
  return {
    ExpressionAttributeNames: {'#FN': 'url', '#S': 'status'},
    ExpressionAttributeValues: {':fn': fileUrl, ':s': FileStatus.Downloaded},
    Key: {fileId: fileId},
    ReturnValues: 'ALL_NEW',
    TableName: tableName,
    UpdateExpression: 'SET #FN = :fn, #S = :s'
  } as unknown as UpdateItemInput
}

export function scanForFileParams(tableName: string) {
  return {
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
  } as unknown as ScanInput
}

export function getFileByKey(tableName: string, fileName: string) {
  return {
    ExpressionAttributeNames: {'#key': 'key'},
    ExpressionAttributeValues: {':key': fileName},
    FilterExpression: '#key = :key',
    TableName: tableName
  } as unknown as ScanInput
}

export function getUsersByFileId(tableName: string, fileId: string) {
  return {
    ExpressionAttributeValues: {':fileId': fileId},
    FilterExpression: 'contains (fileId, :fileId)',
    TableName: tableName
  } as unknown as ScanInput
}

export function getUsersByDeviceId(tableName: string, deviceId: string) {
  return {
    ExpressionAttributeValues: {':deviceId': deviceId},
    FilterExpression: 'contains (devices, :deviceId)',
    TableName: tableName
  } as unknown as ScanInput
}

export function userFileParams(tableName: string, userId: string, fileId: string) {
  return {
    ExpressionAttributeNames: {'#FID': 'fileId'},
    ExpressionAttributeValues: {':fid': new Set([fileId])},
    Key: {userId: userId},
    ReturnValues: 'ALL_NEW',
    UpdateExpression: 'ADD #FID :fid',
    TableName: tableName
  } as unknown as UpdateItemInput
}

export function userDevicesParams(tableName: string, userId: string, deviceId: string) {
  return {
    ExpressionAttributeNames: {'#DID': 'devices'},
    ExpressionAttributeValues: {':did': new Set([deviceId])},
    Key: {userId: userId},
    ReturnValues: 'NONE',
    UpdateExpression: 'ADD #DID :did',
    TableName: tableName
  } as unknown as UpdateItemInput
}

export function deleteSingleUserDeviceParams(tableName: string, userId: string, deviceId: string) {
  return {
    TableName: tableName,
    Key: {userId},
    UpdateExpression: 'DELETE devices :deviceId',
    ExpressionAttributeValues: {':deviceId': new Set([deviceId])}
  } as unknown as UpdateItemInput
}

export function upsertDeviceParams(tableName: string, device: Device) {
  const {deviceId, ...deviceSubset} = device
  const {UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues} = transformObjectToDynamoUpdateQuery(deviceSubset)
  return {
    Key: {deviceId},
    TableName: tableName,
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues
  } as unknown as UpdateItemInput
}

export function queryUserDeviceParams(tableName: string, userId: string) {
  return {
    TableName: tableName,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {':userId': userId}
  } as unknown as QueryInput
}

export function queryFileParams(tableName: string, fileId: string) {
  return {
    TableName: tableName,
    KeyConditionExpression: 'fileId = :fileId',
    ExpressionAttributeValues: {':fileId': fileId}
  } as unknown as QueryInput
}

export function queryDeviceParams(tableName: string, deviceId: string) {
  return {
    TableName: tableName,
    KeyConditionExpression: 'deviceId = :deviceId',
    ExpressionAttributeValues: {':deviceId': deviceId}
  } as unknown as QueryInput
}

export function getUserDeviceByUserIdParams(tableName: string, userId: string) {
  return {
    TableName: tableName,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {':userId': userId}
  } as unknown as QueryInput
}

export function getDeviceParams(tableName: string, deviceId: string) {
  return {
    TableName: tableName,
    KeyConditionExpression: 'deviceId = :deviceId',
    ExpressionAttributeValues: {':deviceId': deviceId}
  } as unknown as QueryInput
}

export function deleteDeviceParams(tableName: string, deviceId: string) {
  return {
    TableName: tableName,
    Key: {deviceId}
  } as unknown as DeleteItemInput
}

export function deleteUserParams(tableName: string, userId: string) {
  return {
    TableName: tableName,
    Key: {userId}
  } as unknown as DeleteItemInput
}

export function deleteUserFilesParams(tableName: string, userId: string) {
  return {
    TableName: tableName,
    Key: {userId}
  } as unknown as DeleteItemInput
}

export function deleteAllUserDeviceParams(tableName: string, userId: string) {
  return {
    TableName: tableName,
    Key: {userId}
  } as unknown as DeleteItemInput
}

export function newFileParams(tableName: string, fileId: string) {
  return {
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
  } as unknown as UpdateItemInput
}

export function newUserParams(tableName: string, user: User, identityProviderApple: IdentityProviderApple) {
  return {
    Item: {
      ...user,
      identityProviders: {...identityProviderApple}
    },
    TableName: tableName
  } as unknown as PutItemInput
}

export function updateFileMetadataParams(tableName: string, item: DynamoDBFile) {
  const {UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues} = transformObjectToDynamoUpdateQuery(item)
  return {
    Key: {fileId: item.fileId},
    TableName: tableName,
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues
  } as unknown as UpdateItemInput
}

export function getUserFilesParams(tableName: string, userId: string) {
  return {
    ExpressionAttributeValues: {
      ':uid': userId
    },
    ExpressionAttributeNames: {
      '#uid': 'userId'
    },
    KeyConditionExpression: '#uid = :uid',
    TableName: tableName
  } as unknown as UpdateItemInput
}

export function getBatchFilesParams(tableName: string, files: string[]) {
  const Keys = []
  const mySet = new Set(files)
  for (const fileId of mySet.values()) {
    Keys.push({fileId})
  }

  return {
    RequestItems: {
      [tableName]: {
        Keys
      }
    }
  } as unknown as BatchGetItemInput
}

export function getUserByAppleDeviceIdentifierParams(tableName: string, userId: string) {
  return {
    ExpressionAttributeValues: {':userId': userId},
    FilterExpression: 'identityProviders.userId = :userId',
    TableName: tableName
  } as unknown as ScanInput
}
