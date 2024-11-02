import {AppleTokenResponse, ClientFile, DynamoDBFile, FileNotification, IdentityProviderApple, Metadata, SignInWithAppleVerifiedToken, User} from '../types/main'
import {logError} from './lambda-helpers'
import {v4 as uuidv4} from 'uuid'
import {UnexpectedError} from './errors'
import {PublishInput} from '@aws-sdk/client-sns'

export function createUserFromToken(verifiedToken: SignInWithAppleVerifiedToken, firstName: string, lastName: string): User {
  return {
    userId: uuidv4(),
    email: verifiedToken.email,
    emailVerified: verifiedToken.email_verified,
    firstName,
    lastName
  }
}

export function createIdentityProviderAppleFromTokens(appleToken: AppleTokenResponse, verifiedToken: SignInWithAppleVerifiedToken): IdentityProviderApple {
  return {
    accessToken: appleToken.access_token,
    refreshToken: appleToken.refresh_token,
    tokenType: appleToken.token_type,
    expiresAt: new Date(Date.now() + appleToken.expires_in).getTime(),
    userId: verifiedToken.sub,
    email: verifiedToken.email,
    emailVerified: verifiedToken.email_verified,
    isPrivateEmail: verifiedToken.is_private_email !== undefined ? verifiedToken.is_private_email : false
  }
}

export function transformDynamoDBFileToSQSMessageBodyAttributeMap(file: DynamoDBFile, userId: string) {
  return {
    fileId: {
      DataType: 'String',
      StringValue: file.fileId
    },
    key: {
      DataType: 'String',
      StringValue: file.key
    },
    publishDate: {
      DataType: 'String',
      StringValue: file.publishDate
    },
    size: {
      DataType: 'Number',
      StringValue: file.size.toString()
    },
    url: {
      DataType: 'String',
      StringValue: file.url
    },
    userId: {
      DataType: 'String',
      StringValue: userId
    }
  }
}

export function unknownErrorToString(unknownVariable: unknown): string {
  if (typeof unknownVariable === 'string') {
    return unknownVariable
  } else if (Array.isArray(unknownVariable)) {
    return unknownVariable
      .map(function (s) {
        return unknownErrorToString(s)
      })
      .join(', ')
  } else if (typeof unknownVariable === 'object') {
    return JSON.stringify(unknownVariable)
  } else {
    return 'Unknown error'
  }
}

export function transformFileNotificationToPushNotification(file: FileNotification, targetArn: string): PublishInput {
  const keys: (keyof typeof file)[] = ['fileId', 'key', 'publishDate', 'size', 'url']
  keys.forEach((key) => {
    if (!file[key] || !file[key].stringValue || typeof file[key].stringValue !== 'string') {
      throw new UnexpectedError(`Missing required value in FileNotification: ${key}`)
    }
  })

  const clientFile: ClientFile = {
    fileId: file.fileId.stringValue!,
    key: file.key.stringValue!,
    publishDate: file.publishDate.stringValue!,
    size: parseInt(file.size.stringValue!, 0),
    url: file.url.stringValue!
  }

  return {
    Message: JSON.stringify({
      APNS_SANDBOX: JSON.stringify({
        aps: {'content-available': 1},
        file: clientFile
      }),
      default: 'Default message'
    }),
    MessageAttributes: {
      'AWS.SNS.MOBILE.APNS.PRIORITY': {DataType: 'String', StringValue: '5'},
      'AWS.SNS.MOBILE.APNS.PUSH_TYPE': {
        DataType: 'String',
        StringValue: 'background'
      }
    },
    MessageStructure: 'json',
    TargetArn: targetArn
  }
}

export function transformVideoIntoDynamoItem(metadata: Metadata): DynamoDBFile {
  return {
    fileId: metadata.videoId,
    key: metadata.fileName,
    size: 0,
    availableAt: new Date().getTime() / 1000,
    authorName: metadata.authorName,
    authorUser: metadata.authorId,
    title: metadata.title,
    description: metadata.description
  } as DynamoDBFile
}

export function assertIsError(error: unknown): asserts error is Error {
  logError('error', error)
  if (!(error instanceof Error)) {
    throw error
  }
}
