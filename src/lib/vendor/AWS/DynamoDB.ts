/**
 * DynamoDB Vendor Wrapper - ElectroDB Implementation
 *
 * This module provides a compatibility layer that translates DynamoDB operations
 * to ElectroDB calls. It maintains the same API as the original DynamoDB wrapper
 * but uses ElectroDB's SQL-like syntax under the hood.
 *
 * This approach allows gradual migration without changing Lambda functions immediately.
 */

import {Files, Users, Devices, UserFiles, UserDevices, addFileToUser, removeDeviceFromUser} from '../ElectroDB/service'

// Re-export types for backward compatibility
export type {BatchGetCommandInput, DeleteCommandInput, PutCommandInput, QueryCommandInput, ScanCommandInput, UpdateCommandInput} from '@aws-sdk/lib-dynamodb'

// Type imports for internal use
import type {BatchGetCommandInput, DeleteCommandInput, PutCommandInput, QueryCommandInput, ScanCommandInput, UpdateCommandInput} from '@aws-sdk/lib-dynamodb'

/**
 * Helper function to determine which entity to use based on table name
 */
function getEntityByTableName(tableName: string) {
  // Match environment variable names to entities
  if (tableName === process.env.DynamoDBTableFiles) {
    return Files
  } else if (tableName === process.env.DynamoDBTableUsers) {
    return Users
  } else if (tableName === process.env.DynamoDBTableDevices) {
    return Devices
  } else if (tableName === process.env.DynamoDBTableUserFiles) {
    return UserFiles
  } else if (tableName === process.env.DynamoDBTableUserDevices) {
    return UserDevices
  }

  throw new Error(`Unknown table: ${tableName}`)
}

/**
 * Update an item using ElectroDB
 * Maintains backward compatibility with DynamoDB UpdateCommand
 */
export async function updateItem(params: UpdateCommandInput) {
  const tableName = params.TableName as string
  const entity = getEntityByTableName(tableName)

  // Special handling for different entities
  if (entity === Files) {
    const fileId = params.Key?.fileId as string
    if (!fileId) throw new Error('fileId required for Files table')

    // Parse UpdateExpression to extract fields
    const updates: any = {}

    if (params.ExpressionAttributeValues) {
      // Map expression values to field names
      const expressionNames = params.ExpressionAttributeNames || {}
      const expressionValues = params.ExpressionAttributeValues

      // Parse SET expression
      if (params.UpdateExpression) {
        const setMatch = params.UpdateExpression.match(/SET (.+)/i)
        if (setMatch) {
          const setPairs = setMatch[1].split(',').map((s) => s.trim())
          for (const pair of setPairs) {
            const [nameExpr, valueExpr] = pair.split('=').map((s) => s.trim())
            // Resolve the actual field name
            let fieldName = nameExpr
            if (nameExpr.startsWith('#')) {
              fieldName = expressionNames[nameExpr] || nameExpr.substring(1)
            }
            // Get the value
            if (valueExpr && valueExpr.startsWith(':')) {
              updates[fieldName] = expressionValues[valueExpr]
            }
          }
        }
      }
    }

    const result = await Files.update({fileId}).set(updates).go()
    return {
      Attributes: params.ReturnValues === 'ALL_NEW' ? result.data : undefined
    }
  }

  if (entity === Users) {
    const userId = params.Key?.userId as string
    if (!userId) throw new Error('userId required for Users table')

    // Parse UpdateExpression to extract fields (similar to Files)
    const updates: any = {}

    if (params.ExpressionAttributeValues) {
      const expressionNames = params.ExpressionAttributeNames || {}
      const expressionValues = params.ExpressionAttributeValues

      if (params.UpdateExpression) {
        const setMatch = params.UpdateExpression.match(/SET (.+)/i)
        if (setMatch) {
          const setPairs = setMatch[1].split(',').map((s) => s.trim())
          for (const pair of setPairs) {
            const [nameExpr, valueExpr] = pair.split('=').map((s) => s.trim())
            let fieldName = nameExpr
            if (nameExpr.startsWith('#')) {
              fieldName = expressionNames[nameExpr] || nameExpr.substring(1)
            }
            if (valueExpr && valueExpr.startsWith(':')) {
              updates[fieldName] = expressionValues[valueExpr]
            }
          }
        }
      }
    }

    const result = await Users.update({userId}).set(updates).go()
    return {
      Attributes: params.ReturnValues === 'ALL_NEW' ? result.data : undefined
    }
  }

  if (entity === Devices) {
    const deviceId = params.Key?.deviceId as string
    if (!deviceId) throw new Error('deviceId required for Devices table')

    const updates: any = {}
    if (params.ExpressionAttributeValues) {
      const expressionNames = params.ExpressionAttributeNames || {}
      const expressionValues = params.ExpressionAttributeValues

      if (params.UpdateExpression) {
        const setMatch = params.UpdateExpression.match(/SET (.+)/i)
        if (setMatch) {
          const setPairs = setMatch[1].split(',').map((s) => s.trim())
          for (const pair of setPairs) {
            const [nameExpr, valueExpr] = pair.split('=').map((s) => s.trim())
            let fieldName = nameExpr
            if (nameExpr.startsWith('#')) {
              fieldName = expressionNames[nameExpr] || nameExpr.substring(1)
            }
            if (valueExpr && valueExpr.startsWith(':')) {
              updates[fieldName] = expressionValues[valueExpr]
            }
          }
        }
      }
    }

    const result = await Devices.upsert({deviceId, ...updates}).go()
    return {
      Attributes: params.ReturnValues === 'ALL_NEW' ? result.data : undefined
    }
  }

  if (entity === UserFiles) {
    const userId = params.Key?.userId as string
    if (!userId) throw new Error('userId required for UserFiles table')

    // Handle ADD operations for Sets
    if (params.UpdateExpression?.includes('ADD')) {
      const fileIdSet = params.ExpressionAttributeValues?.[':fid'] as Set<string>
      if (fileIdSet && fileIdSet.values) {
        const fileId = Array.from(fileIdSet.values())[0]
        const result = await addFileToUser(userId, fileId)
        return {
          Attributes: params.ReturnValues === 'ALL_NEW' ? result.data : undefined
        }
      }
    }
  }

  if (entity === UserDevices) {
    const userId = params.Key?.userId as string
    if (!userId) throw new Error('userId required for UserDevices table')

    // Handle ADD operations for Sets
    if (params.UpdateExpression?.includes('ADD')) {
      const deviceIdSet = params.ExpressionAttributeValues?.[':did'] as Set<string>
      if (deviceIdSet && deviceIdSet.values) {
        const deviceId = Array.from(deviceIdSet.values())[0]
        // Import addDeviceToUser function
        const {addDeviceToUser} = await import('../ElectroDB/entities/UserDevices')
        const result = await addDeviceToUser(userId, deviceId)
        return {
          Attributes: params.ReturnValues === 'NONE' ? undefined : result.data
        }
      }
    }

    // Handle DELETE operations for Sets
    if (params.UpdateExpression?.includes('DELETE')) {
      const deviceIdSet = params.ExpressionAttributeValues?.[':deviceId'] as Set<string>
      if (deviceIdSet && deviceIdSet.values) {
        const deviceId = Array.from(deviceIdSet.values())[0]
        const result = await removeDeviceFromUser(userId, deviceId)
        return {
          Attributes: params.ReturnValues === 'NONE' ? undefined : result.data
        }
      }
    }
  }

  return {}
}

/**
 * Put (create) an item using ElectroDB
 */
export async function putItem(params: PutCommandInput) {
  const tableName = params.TableName as string
  const entity = getEntityByTableName(tableName)

  if (entity === Users && params.Item) {
    const result = await Users.create(params.Item as any).go()
    return {Attributes: result.data}
  }

  // Add other entity handling as needed
  return {}
}

/**
 * Scan a table using ElectroDB
 */
export async function scan(params: ScanCommandInput) {
  const tableName = params.TableName as string
  const entity = getEntityByTableName(tableName)

  // Handle different scan patterns
  if (params.FilterExpression) {
    // Special case: contains filter for Sets
    if (params.FilterExpression.includes('contains')) {
      if (entity === UserFiles) {
        const fileId = params.ExpressionAttributeValues?.[':fileId'] as string
        // ElectroDB doesn't support contains on sets natively, filter in memory
        const results = await UserFiles.scan.go()
        const filtered = results.data.filter((item) => item.fileId && (item.fileId as string[]).includes(fileId))
        return {Items: filtered, Count: filtered.length}
      }

      if (entity === UserDevices) {
        const deviceId = params.ExpressionAttributeValues?.[':deviceId'] as string
        // ElectroDB doesn't support contains on sets natively, filter in memory
        const results = await UserDevices.scan.go()
        const filtered = results.data.filter((item) => item.devices && (item.devices as string[]).includes(deviceId))
        return {Items: filtered, Count: filtered.length}
      }
    }

    // Special case: nested field query for identityProviders
    if (params.FilterExpression.includes('identityProviders.userId')) {
      const appleUserId = params.ExpressionAttributeValues?.[':userId'] as string
      // ElectroDB doesn't support nested field queries in scan easily, filter in memory
      const results = await Users.scan.go()
      const filtered = results.data.filter((item) => item.identityProviders?.userId === appleUserId)
      return {Items: filtered, Count: filtered.length}
    }

    // Special case: attribute_not_exists and comparison
    if (params.FilterExpression.includes('attribute_not_exists')) {
      if (entity === Files) {
        const now = params.ExpressionAttributeValues?.[':aa'] as number
        const results = await Files.scan
          .where(({availableAt}, {lte}) => lte(availableAt, now))
          .where(({url}, {notExists}) => notExists(url))
          .go({
            attributes: params.ProjectionExpression ? ['availableAt', 'fileId'] : undefined
          })
        return {Items: results.data, Count: results.data.length}
      }
    }

    // Special case: key equality filter
    if (params.FilterExpression.includes('#key = :key')) {
      const key = params.ExpressionAttributeValues?.[':key'] as string
      const results = await Files.scan.where(({key: fileKey}, {eq}) => eq(fileKey, key)).go()
      return {Items: results.data, Count: results.data.length}
    }
  }

  // Default scan without filter - handle each entity type explicitly
  if (entity === Files) {
    const results = await Files.scan.go()
    return {Items: results.data, Count: results.data.length}
  } else if (entity === Users) {
    const results = await Users.scan.go()
    return {Items: results.data, Count: results.data.length}
  } else if (entity === Devices) {
    const results = await Devices.scan.go()
    return {Items: results.data, Count: results.data.length}
  } else if (entity === UserFiles) {
    const results = await UserFiles.scan.go()
    return {Items: results.data, Count: results.data.length}
  } else if (entity === UserDevices) {
    const results = await UserDevices.scan.go()
    return {Items: results.data, Count: results.data.length}
  }

  return {Items: [], Count: 0}
}

/**
 * Batch get items using ElectroDB
 */
export async function batchGet(params: BatchGetCommandInput) {
  if (!params.RequestItems) return {Responses: {}}

  const responses: any = {}

  for (const [tableName, tableRequest] of Object.entries(params.RequestItems)) {
    const entity = getEntityByTableName(tableName)

    if (entity === Files && tableRequest.Keys) {
      const keys = tableRequest.Keys.map((k: any) => ({fileId: k.fileId}))
      const results = await Files.get(keys).go()
      responses[tableName] = Array.isArray(results.data) ? results.data : [results.data]
    }
  }

  return {Responses: responses}
}

/**
 * Query a table using ElectroDB
 */
export async function query(params: QueryCommandInput) {
  const tableName = params.TableName as string
  const entity = getEntityByTableName(tableName)

  // Parse the key condition expression
  const keyValue = Object.values(params.ExpressionAttributeValues || {})[0]

  if (entity === Files) {
    const fileId = keyValue as string
    const result = await Files.get({fileId}).go()
    return {Items: result.data ? [result.data] : [], Count: result.data ? 1 : 0}
  }

  if (entity === Users) {
    const userId = keyValue as string
    const result = await Users.get({userId}).go()
    return {Items: result.data ? [result.data] : [], Count: result.data ? 1 : 0}
  }

  if (entity === Devices) {
    const deviceId = keyValue as string
    const result = await Devices.get({deviceId}).go()
    return {Items: result.data ? [result.data] : [], Count: result.data ? 1 : 0}
  }

  if (entity === UserFiles) {
    const userId = keyValue as string
    const result = await UserFiles.get({userId}).go()
    return {Items: result.data ? [result.data] : [], Count: result.data ? 1 : 0}
  }

  if (entity === UserDevices) {
    const userId = keyValue as string
    const result = await UserDevices.get({userId}).go()
    return {Items: result.data ? [result.data] : [], Count: result.data ? 1 : 0}
  }

  return {Items: [], Count: 0}
}

/**
 * Delete an item using ElectroDB
 */
export async function deleteItem(params: DeleteCommandInput) {
  const tableName = params.TableName as string
  const entity = getEntityByTableName(tableName)

  if (entity === Users && params.Key?.userId) {
    const result = await Users.delete({userId: params.Key.userId as string}).go()
    return {Attributes: result.data}
  }

  if (entity === Devices && params.Key?.deviceId) {
    const result = await Devices.delete({deviceId: params.Key.deviceId as string}).go()
    return {Attributes: result.data}
  }

  if (entity === UserFiles && params.Key?.userId) {
    const result = await UserFiles.delete({userId: params.Key.userId as string}).go()
    return {Attributes: result.data}
  }

  if (entity === UserDevices && params.Key?.userId) {
    const result = await UserDevices.delete({userId: params.Key.userId as string}).go()
    return {Attributes: result.data}
  }

  return {}
}
