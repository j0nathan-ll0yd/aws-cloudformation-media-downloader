import {videoFormat, videoInfo} from 'ytdl-core'
import {chooseVideoFormat} from '../lib/vendor/YouTube'
import {AppleTokenResponse, ClientFile, DynamoDBFile, FileNotification, IdentityProviderApple, Metadata, SignInWithAppleVerifiedToken, User} from '../types/main'
import {logDebug, logError} from './lambda-helpers'
import {v4 as uuidv4} from 'uuid'
import {NotFoundError, UnexpectedError} from './errors'
import {PublishInput} from '@aws-sdk/client-sns'

function getHighestVideoFormatFromVideoInfo(myVideoInfo: videoInfo): videoFormat {
  try {
    const highestVideoFormat = chooseVideoFormat(myVideoInfo, {
      filter: (format) => format.container === 'mp4'
    })
    logDebug('getHighestVideoFormatFromVideoInfo', highestVideoFormat)
    return highestVideoFormat
  } catch (error) {
    throw new NotFoundError('Unable to find acceptable video format')
  }
}

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
    isPrivateEmail: verifiedToken.is_private_email
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

export function transformVideoInfoToMetadata(myVideoInfo: videoInfo): Metadata {
  const myVideoFormat: videoFormat = getHighestVideoFormatFromVideoInfo(myVideoInfo)
  logDebug('videoDetails', myVideoInfo.videoDetails)
  const {title, description, publishDate, author, thumbnails, videoId} = myVideoInfo.videoDetails
  logDebug('thumbnails', thumbnails)
  const keys: (keyof typeof myVideoInfo.videoDetails)[] = ['author', 'description', 'publishDate', 'title']
  keys.forEach((key) => {
    if (!myVideoInfo.videoDetails[key]) {
      throw new UnexpectedError(`Missing required value in videoDetails: ${key}`)
    }
  })

  logDebug('cleanup')
  const date = new Date(Date.parse(publishDate))
  const ext = myVideoFormat.container
  const uploadDate = date.toISOString().substring(0, 10).replace(/-/g, '')
  const fileName = `${uploadDate}-[${author.name}].${ext}`
  const escapedTitle = title.replace(/[°()@,;:"/[\]\\?={}’]/g, '')

  return {
    videoId,
    fileName,
    escapedTitle,
    author,
    description,
    ext: myVideoFormat.container,
    formats: [myVideoFormat],
    imageUri: thumbnails[thumbnails.length - 1].url,
    mimeType: myVideoFormat.mimeType,
    published: Date.parse(publishDate),
    title
  } as Metadata
}

export function transformVideoIntoDynamoItem(metadata: Metadata): DynamoDBFile {
  return {
    fileId: metadata.videoId,
    key: metadata.fileName,
    size: 0,
    availableAt: new Date().getTime() / 1000,
    authorName: metadata.author.name,
    authorUser: metadata.author.user || metadata.author.name.toLowerCase(),
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
