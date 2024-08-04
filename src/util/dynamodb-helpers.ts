import {DynamoDBFile, IdentityProviderApple, User, Device} from '../types/main'
import {FileStatus} from '../types/enums.js'
import {DeleteItemInput, QueryInput, UpdateItemInput, PutItemInput, ScanInput, BatchGetItemInput} from '@aws-sdk/client-dynamodb'
import {marshall} from '@aws-sdk/util-dynamodb'

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

export function updateCompletedFileParams(tableName: string, fileId: string, fileUrl: string): UpdateItemInput {
  return {
    ExpressionAttributeNames: {'#FN': 'url', '#S': 'status'},
    ExpressionAttributeValues: marshall({':fn': fileUrl, ':s': FileStatus.Downloaded}),
    Key: marshall({fileId: fileId}),
    ReturnValues: 'ALL_NEW',
    TableName: tableName,
    UpdateExpression: 'SET #FN = :fn, #S = :s'
  } as UpdateItemInput
}

export function scanForFileParams(tableName: string): ScanInput {
  return {
    ExpressionAttributeNames: {
      '#AA': 'availableAt',
      '#FID': 'fileId',
      '#FN': 'url'
    },
    ExpressionAttributeValues: marshall({
      ':aa': parseInt(Date.now().toString(), 10)
    }),
    FilterExpression: '#AA <= :aa AND attribute_not_exists(#FN)',
    ProjectionExpression: '#AA, #FID',
    TableName: tableName
  } as ScanInput
}

export function getFileByKey(tableName: string, fileName: string): ScanInput {
  return {
    ExpressionAttributeNames: {'#key': 'key'},
    ExpressionAttributeValues: marshall({':key': fileName}),
    FilterExpression: '#key = :key',
    TableName: tableName
  } as ScanInput
}

export function getUsersByFileId(tableName: string, fileId: string): ScanInput {
  return {
    ExpressionAttributeValues: marshall({':fileId': fileId}),
    FilterExpression: 'contains (fileId, :fileId)',
    TableName: tableName
  } as ScanInput
}

export function getUsersByDeviceId(tableName: string, deviceId: string): ScanInput {
  return {
    ExpressionAttributeValues: marshall({':deviceId': deviceId}),
    FilterExpression: 'contains (devices, :deviceId)',
    TableName: tableName
  } as ScanInput
}

export function userFileParams(tableName: string, userId: string, fileId: string): UpdateItemInput {
  return {
    ExpressionAttributeNames: {'#FID': 'fileId'},
    ExpressionAttributeValues: marshall({':fid': new Set([fileId])}),
    Key: marshall({userId: userId}),
    ReturnValues: 'NONE',
    UpdateExpression: 'ADD #FID :fid',
    TableName: tableName
  } as UpdateItemInput
}

export function userDevicesParams(tableName: string, userId: string, deviceId: string): UpdateItemInput {
  return {
    ExpressionAttributeNames: {'#DID': 'devices'},
    ExpressionAttributeValues: marshall({':did': new Set([deviceId])}),
    Key: marshall({userId: userId}),
    ReturnValues: 'NONE',
    UpdateExpression: 'ADD #DID :did',
    TableName: tableName
  } as UpdateItemInput
}

export function deleteSingleUserDeviceParams(tableName: string, userId: string, deviceId: string): UpdateItemInput {
  return {
    TableName: tableName,
    Key: marshall({userId}),
    UpdateExpression: 'DELETE devices :deviceId',
    ExpressionAttributeValues: marshall({':deviceId': new Set([deviceId])})
  } as UpdateItemInput
}

export function upsertDeviceParams(tableName: string, device: Device): UpdateItemInput {
  const {deviceId, ...deviceSubset} = device
  const {UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues} = transformObjectToDynamoUpdateQuery(deviceSubset)
  return {
    Key: marshall({deviceId}),
    TableName: tableName,
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues: marshall(ExpressionAttributeValues)
  } as UpdateItemInput
}

export function queryUserDeviceParams(tableName: string, userId: string): QueryInput {
  return {
    TableName: tableName,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: marshall({':userId': userId})
  } as QueryInput
}

export function queryFileParams(tableName: string, fileId: string): QueryInput {
  return {
    TableName: tableName,
    KeyConditionExpression: 'fileId = :fileId',
    ExpressionAttributeValues: marshall({':fileId': fileId})
  } as QueryInput
}

export function queryDeviceParams(tableName: string, deviceId: string): QueryInput {
  return {
    TableName: tableName,
    KeyConditionExpression: 'deviceId = :deviceId',
    ExpressionAttributeValues: marshall({':deviceId': deviceId})
  } as QueryInput
}

export function getUserDeviceByUserIdParams(tableName: string, userId: string): QueryInput {
  return {
    TableName: tableName,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: marshall({':userId': userId})
  } as QueryInput
}

export function getDeviceParams(tableName: string, deviceId: string): QueryInput {
  return {
    TableName: tableName,
    KeyConditionExpression: 'deviceId = :deviceId',
    ExpressionAttributeValues: marshall({':deviceId': deviceId})
  } as QueryInput
}

export function deleteDeviceParams(tableName: string, deviceId: string): DeleteItemInput {
  return {
    TableName: tableName,
    Key: marshall({deviceId})
  } as DeleteItemInput
}

export function deleteUserParams(tableName: string, userId: string): DeleteItemInput {
  return {
    TableName: tableName,
    Key: marshall({userId})
  } as DeleteItemInput
}

export function deleteUserFilesParams(tableName: string, userId: string): DeleteItemInput {
  return {
    TableName: tableName,
    Key: marshall({userId})
  } as DeleteItemInput
}

export function deleteAllUserDeviceParams(tableName: string, userId: string): DeleteItemInput {
  return {
    TableName: tableName,
    Key: marshall({userId})
  } as DeleteItemInput
}

export function newFileParams(tableName: string, fileId: string): UpdateItemInput {
  return {
    ExpressionAttributeNames: {
      '#AA': 'availableAt',
      '#S': 'status'
    },
    ExpressionAttributeValues: marshall({
      ':aa': parseInt(Date.now().toString(), 10),
      ':s': FileStatus.PendingMetadata
    }),
    Key: marshall({fileId: fileId}),
    ReturnValues: 'ALL_OLD',
    UpdateExpression: 'SET #AA = :aa, #S = :s',
    TableName: tableName
  } as UpdateItemInput
}

export function newUserParams(tableName: string, user: User, identityProviderApple: IdentityProviderApple): PutItemInput {
  return {
    Item: marshall({
      ...user,
      identityProviders: {...identityProviderApple}
    }),
    TableName: tableName
  } as PutItemInput
}

export function updateFileMetadataParams(tableName: string, item: DynamoDBFile): UpdateItemInput {
  const {UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues} = transformObjectToDynamoUpdateQuery(item)
  return {
    Key: marshall({fileId: item.fileId}),
    TableName: tableName,
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues: marshall(ExpressionAttributeValues)
  } as UpdateItemInput
}

export function getUserFilesParams(tableName: string, userId: string): QueryInput {
  return {
    ExpressionAttributeValues: marshall({
      ':uid': userId
    }),
    ExpressionAttributeNames: {
      '#uid': 'userId'
    },
    KeyConditionExpression: '#uid = :uid',
    TableName: tableName
  } as QueryInput
}

export function getBatchFilesParams(tableName: string, files: string[]): BatchGetItemInput {
  const Keys = []
  const mySet = new Set(files)
  for (const fileId of mySet.values()) {
    Keys.push(marshall({fileId}))
  }

  return {
    RequestItems: {
      [tableName]: {
        Keys
      }
    }
  } as BatchGetItemInput
}

export function getUserByAppleDeviceIdentifierParams(tableName: string, userId: string): ScanInput {
  return {
    ExpressionAttributeValues: marshall({':userId': userId}),
    FilterExpression: 'identityProviders.userId = :userId',
    TableName: tableName
  } as ScanInput
}
