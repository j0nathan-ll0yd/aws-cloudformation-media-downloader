/**
 * Better Auth ElectroDB Adapter
 *
 * Custom database adapter for Better Auth that uses ElectroDB with DynamoDB single-table design.
 * Uses Better Auth's createAdapterFactory for proper integration.
 *
 * @see https://www.better-auth.com/docs/guides/create-a-db-adapter
 */

import {createAdapterFactory} from 'better-auth/adapters'
import {Users} from '#entities/Users'
import {Sessions} from '#entities/Sessions'
import {Accounts} from '#entities/Accounts'
import {VerificationTokens} from '#entities/VerificationTokens'
import {v4 as uuidv4} from 'uuid'
import {logDebug, logError} from '#lib/system/logging'
import {AccountSchema, SessionSchema, UserSchema, VerificationTokenSchema} from '#lib/domain/auth/validation'

type ModelName = 'user' | 'session' | 'account' | 'verification'

/**
 * Primary key field for each model
 */
const primaryKeyFields: Record<ModelName, string> = {user: 'userId', session: 'sessionId', account: 'accountId', verification: 'token'}

/**
 * Transform input data from Better Auth format to ElectroDB format
 */
function transformInputData(model: string, data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const pkField = primaryKeyFields[model as ModelName]

  for (const [key, value] of Object.entries(data)) {
    // Skip Better Auth's 'id' field - we always generate our own UUID
    // Better Auth uses nanoid format which doesn't match our UUID requirement
    if (key === 'id') {
      continue
    }

    // Convert Date objects or ISO strings to timestamps for ElectroDB
    if (value instanceof Date) {
      result[key] = value.getTime()
    } else if (typeof value === 'string' && (key === 'createdAt' || key === 'updatedAt' || key === 'expiresAt')) {
      // Handle ISO date strings from Better Auth
      const parsed = Date.parse(value)
      result[key] = isNaN(parsed) ? value : parsed
    } else {
      result[key] = value
    }
  }

  // Always generate our own UUID for primary key
  result[pkField] = uuidv4()

  // Handle user-specific fields
  if (model === 'user') {
    if (typeof result['name'] === 'string') {
      const parts = (result['name'] as string).split(' ')
      result['firstName'] = parts[0] || ''
      result['lastName'] = parts.slice(1).join(' ') || ''
      delete result['name']
    }
    if (!result['firstName']) {
      result['firstName'] = ''
    }
    if (!result['lastName']) {
      result['lastName'] = ''
    }
    if (!result['identityProviders']) {
      result['identityProviders'] = {
        userId: '',
        email: '',
        emailVerified: false,
        isPrivateEmail: false,
        accessToken: '',
        refreshToken: '',
        tokenType: '',
        expiresAt: 0
      }
    }
    // Set flattened appleDeviceId for GSI lookup (denormalized from identityProviders.userId)
    const identityProviders = result['identityProviders'] as {userId?: string} | undefined
    if (identityProviders?.userId) {
      result['appleDeviceId'] = identityProviders.userId
    }
  }

  // Handle account field mapping
  if (model === 'account' && result['accountId'] && !result['providerAccountId']) {
    result['providerAccountId'] = result['accountId']
  }

  return result
}

/**
 * Transform output data from ElectroDB format to Better Auth format
 */
function transformOutputData(model: string, data: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!data) {
    return null
  }

  const result: Record<string, unknown> = {...data}
  const pkField = primaryKeyFields[model as ModelName]

  // Map primary key back to 'id'
  if (pkField && result[pkField]) {
    result['id'] = result[pkField]
  }

  // Convert timestamps to Date objects
  if (typeof result['createdAt'] === 'number') {
    result['createdAt'] = new Date(result['createdAt'] as number)
  }
  if (typeof result['updatedAt'] === 'number') {
    result['updatedAt'] = new Date(result['updatedAt'] as number)
  }
  if (typeof result['expiresAt'] === 'number') {
    result['expiresAt'] = new Date(result['expiresAt'] as number)
  }

  // Combine firstName/lastName into name for user model
  if (model === 'user' && (result['firstName'] || result['lastName'])) {
    result['name'] = `${result['firstName'] || ''} ${result['lastName'] || ''}`.trim()
  }

  // Map account fields back
  if (model === 'account' && result['providerAccountId']) {
    result['accountId'] = result['providerAccountId']
  }

  return result
}

// Type for where clause
type WhereClause = Array<{field: string; value: unknown; operator?: string}>

/**
 * Creates a Better Auth adapter for ElectroDB/DynamoDB.
 */
export const electroDBAdapter = createAdapterFactory({
  config: {adapterId: 'electrodb', adapterName: 'ElectroDB', supportsJSON: true, supportsDates: false, supportsBooleans: true, supportsNumericIds: false},
  adapter: () => ({
    async create<T>({model, data}: {model: string; data: Record<string, unknown>}): Promise<T> {
      logDebug('ElectroDB Adapter: create', {model, data})
      const transformedData = transformInputData(model, data)

      try {
        let result: {data: Record<string, unknown>}

        switch (model) {
          case 'user': {
            const validData = UserSchema.parse(transformedData)
            result = await Users.create(validData).go()
            break
          }
          case 'session': {
            const validData = SessionSchema.parse(transformedData)
            result = await Sessions.create(validData).go()
            break
          }
          case 'account': {
            const validData = AccountSchema.parse(transformedData)
            result = await Accounts.create(validData).go()
            break
          }
          case 'verification': {
            const validData = VerificationTokenSchema.parse(transformedData)
            result = await VerificationTokens.create(validData).go()
            break
          }
          default:
            throw new Error(`Unknown model: ${model}`)
        }

        return transformOutputData(model, result.data) as T
      } catch (error) {
        logError('ElectroDB Adapter: create failed', {model, error})
        throw error
      }
    },

    async findOne<T>({model, where}: {model: string; where: WhereClause}): Promise<T | null> {
      logDebug('ElectroDB Adapter: findOne', {model, where})
      const pkField = primaryKeyFields[model as ModelName]
      const pkCondition = where.find((w) => w.field === 'id' || w.field === pkField)

      try {
        // Handle by model type
        switch (model) {
          case 'user': {
            if (pkCondition) {
              const result = await Users.get({userId: pkCondition.value as string}).go()
              if (!result.data) {
                return null
              }
              return transformOutputData(model, result.data as Record<string, unknown>) as T
            }
            const emailCondition = where.find((w) => w.field === 'email')
            if (emailCondition) {
              const result = await Users.query.byEmail({email: emailCondition.value as string}).go()
              if (!result.data || result.data.length === 0) {
                return null
              }
              return transformOutputData(model, result.data[0] as Record<string, unknown>) as T
            }
            break
          }
          case 'session': {
            if (pkCondition) {
              const result = await Sessions.get({sessionId: pkCondition.value as string}).go()
              if (!result.data) {
                return null
              }
              return transformOutputData(model, result.data as Record<string, unknown>) as T
            }
            const tokenCondition = where.find((w) => w.field === 'token')
            const userIdCondition = where.find((w) => w.field === 'userId')
            // Better Auth often looks up sessions by token alone
            if (tokenCondition) {
              const result = await Sessions.query.byToken({token: tokenCondition.value as string}).go()
              if (!result.data || result.data.length === 0) {
                return null
              }
              return transformOutputData(model, result.data[0] as Record<string, unknown>) as T
            }
            if (userIdCondition) {
              const result = await Sessions.query.byUser({userId: userIdCondition.value as string}).go()
              if (!result.data || result.data.length === 0) {
                return null
              }
              return transformOutputData(model, result.data[0] as Record<string, unknown>) as T
            }
            break
          }
          case 'account': {
            if (pkCondition) {
              const result = await Accounts.get({accountId: pkCondition.value as string}).go()
              if (!result.data) {
                return null
              }
              return transformOutputData(model, result.data as Record<string, unknown>) as T
            }
            const providerIdCondition = where.find((w) => w.field === 'providerId')
            const accountIdCondition = where.find((w) => w.field === 'accountId' || w.field === 'providerAccountId')
            if (providerIdCondition && accountIdCondition) {
              logDebug('ElectroDB Adapter: querying account by provider', {
                providerId: providerIdCondition.value,
                providerAccountId: accountIdCondition.value
              })
              const result = await Accounts.query.byProvider({
                providerId: providerIdCondition.value as string,
                providerAccountId: accountIdCondition.value as string
              }).go()
              logDebug('ElectroDB Adapter: account by provider result', {
                found: result.data?.length || 0,
                data: result.data?.[0] ? {accountId: result.data[0].accountId, providerId: result.data[0].providerId} : null
              })
              if (!result.data || result.data.length === 0) {
                return null
              }
              return transformOutputData(model, result.data[0] as Record<string, unknown>) as T
            }
            const userIdCondition = where.find((w) => w.field === 'userId')
            if (userIdCondition) {
              const result = await Accounts.query.byUser({userId: userIdCondition.value as string}).go()
              if (!result.data || result.data.length === 0) {
                return null
              }
              // Filter by other conditions if present
              if (providerIdCondition) {
                const match = result.data.find((a) => a.providerId === providerIdCondition.value)
                if (!match) {
                  return null
                }
                return transformOutputData(model, match as Record<string, unknown>) as T
              }
              return transformOutputData(model, result.data[0] as Record<string, unknown>) as T
            }
            break
          }
          case 'verification': {
            const tokenCondition = where.find((w) => w.field === 'token' || w.field === 'id')
            if (tokenCondition) {
              const result = await VerificationTokens.get({token: tokenCondition.value as string}).go()
              if (!result.data) {
                return null
              }
              return transformOutputData(model, result.data as Record<string, unknown>) as T
            }
            break
          }
        }

        logDebug('ElectroDB Adapter: findOne - no matching query pattern', {model, where})
        return null
      } catch (error) {
        logError('ElectroDB Adapter: findOne failed', {model, where, error})
        return null
      }
    },

    async findMany<T>({model, where}: {model: string; where?: WhereClause}): Promise<T[]> {
      logDebug('ElectroDB Adapter: findMany', {model, where})

      try {
        switch (model) {
          case 'session': {
            const userIdCondition = where?.find((w) => w.field === 'userId')
            if (userIdCondition) {
              const result = await Sessions.query.byUser({userId: userIdCondition.value as string}).go()
              return (result.data || []).map((item) => transformOutputData(model, item as Record<string, unknown>)).filter(Boolean) as T[]
            }
            break
          }
          case 'account': {
            const userIdCondition = where?.find((w) => w.field === 'userId')
            if (userIdCondition) {
              const result = await Accounts.query.byUser({userId: userIdCondition.value as string}).go()
              return (result.data || []).map((item) => transformOutputData(model, item as Record<string, unknown>)).filter(Boolean) as T[]
            }
            break
          }
        }

        return []
      } catch (error) {
        logError('ElectroDB Adapter: findMany failed', {model, where, error})
        return []
      }
    },

    async update<T>({model, where, update}: {model: string; where: WhereClause; update: T}): Promise<T | null> {
      logDebug('ElectroDB Adapter: update', {model, where, update})
      const pkField = primaryKeyFields[model as ModelName]
      const pkCondition = where.find((w) => w.field === 'id' || w.field === pkField)

      if (!pkCondition) {
        logError('ElectroDB Adapter: update requires id in where clause', {model, where})
        return null
      }

      const transformedUpdate = transformInputData(model, update as Record<string, unknown>)
      delete transformedUpdate[pkField] // Remove PK from update data

      try {
        let result: {data: Record<string, unknown>}

        switch (model) {
          case 'user':
            result = await Users.update({userId: pkCondition.value as string}).set(
              transformedUpdate as Parameters<ReturnType<typeof Users.update>['set']>[0]
            ).go()
            break
          case 'session':
            result = await Sessions.update({sessionId: pkCondition.value as string}).set(
              transformedUpdate as Parameters<ReturnType<typeof Sessions.update>['set']>[0]
            ).go()
            break
          case 'account':
            result = await Accounts.update({accountId: pkCondition.value as string}).set(
              transformedUpdate as Parameters<ReturnType<typeof Accounts.update>['set']>[0]
            ).go()
            break
          case 'verification':
            result = await VerificationTokens.update({token: pkCondition.value as string}).set(
              transformedUpdate as Parameters<ReturnType<typeof VerificationTokens.update>['set']>[0]
            ).go()
            break
          default:
            return null
        }

        return transformOutputData(model, result.data) as T
      } catch (error) {
        logError('ElectroDB Adapter: update failed', {model, where, error})
        return null
      }
    },

    async updateMany(): Promise<number> {
      // ElectroDB doesn't support batch updates directly
      return 0
    },

    async delete({model, where}: {model: string; where: WhereClause}): Promise<void> {
      logDebug('ElectroDB Adapter: delete', {model, where})
      const pkField = primaryKeyFields[model as ModelName]
      const pkCondition = where.find((w) => w.field === 'id' || w.field === pkField)

      if (!pkCondition) {
        logError('ElectroDB Adapter: delete requires id in where clause', {model, where})
        return
      }

      try {
        switch (model) {
          case 'user':
            await Users.delete({userId: pkCondition.value as string}).go()
            break
          case 'session':
            await Sessions.delete({sessionId: pkCondition.value as string}).go()
            break
          case 'account':
            await Accounts.delete({accountId: pkCondition.value as string}).go()
            break
          case 'verification':
            await VerificationTokens.delete({token: pkCondition.value as string}).go()
            break
        }
      } catch (error) {
        logError('ElectroDB Adapter: delete failed', {model, where, error})
      }
    },

    async deleteMany({model, where}: {model: string; where: WhereClause}): Promise<number> {
      logDebug('ElectroDB Adapter: deleteMany', {model, where})

      if (model === 'session') {
        const userIdCondition = where.find((w) => w.field === 'userId')
        if (userIdCondition) {
          const sessions = await Sessions.query.byUser({userId: userIdCondition.value as string}).go()
          let count = 0
          for (const session of sessions.data || []) {
            await Sessions.delete({sessionId: session.sessionId}).go()
            count++
          }
          return count
        }
      }

      return 0
    },

    async count({model, where}: {model: string; where?: WhereClause}): Promise<number> {
      logDebug('ElectroDB Adapter: count', {model, where})

      if (model === 'session' && where) {
        const userIdCondition = where.find((w) => w.field === 'userId')
        if (userIdCondition) {
          const sessions = await Sessions.query.byUser({userId: userIdCondition.value as string}).go()
          return sessions.data?.length || 0
        }
      }

      return 0
    }
  })
})

/**
 * Splits a full name into first and last name parts.
 */
export function splitFullName(fullName?: string): {firstName: string; lastName: string} {
  const parts = (fullName || '').split(' ')
  return {firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || ''}
}
