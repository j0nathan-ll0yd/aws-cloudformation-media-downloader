import {PublishInput} from 'aws-sdk/clients/sns'
import {MessageBodyAttributeMap} from 'aws-sdk/clients/sqs'
import {videoFormat, videoInfo} from 'ytdl-core'
import {chooseVideoFormat} from '../lib/vendor/YouTube'
import {AppleTokenResponse, ClientFile, DynamoDBFile, FileNotification, IdentityProviderApple, Metadata, SignInWithAppleVerifiedToken, User} from '../types/main'
import {logDebug} from './lambda-helpers'
import {v4 as uuidv4} from 'uuid'
import {NotFoundError} from './errors'

function getHighestVideoFormatFromVideoInfo(myVideoInfo: videoInfo): videoFormat {
  try {
    // quality 22 = highest quality MP4 format
    const highestVideoFormat = chooseVideoFormat(myVideoInfo, {
      filter: (format) => format.container === 'mp4'
    })
    logDebug('getHighestVideoFormatFromVideoInfo', highestVideoFormat)
    if (highestVideoFormat instanceof Error) {
      throw highestVideoFormat
    } else {
      return highestVideoFormat
    }
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

export function transformDynamoDBFileToSQSMessageBodyAttributeMap(file: DynamoDBFile, userId: string): MessageBodyAttributeMap {
  return {
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

export function transformFileNotificationToPushNotification(file: FileNotification, targetArn: string): PublishInput {
  const clientFile: ClientFile = {
    key: file.key.stringValue,
    publishDate: file.publishDate.stringValue,
    size: parseInt(file.size.stringValue, 0),
    url: file.url.stringValue
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
  for (const key of ['author', 'description', 'publishDate', 'title']) {
    if (!(key in myVideoInfo.videoDetails)) {
      throw new NotFoundError(`myVideoInfo missing property ${key}`)
    }
  }

  const date = new Date(Date.parse(publishDate))
  const ext = myVideoFormat.container
  const uploadDate = date.toISOString().substr(0, 10).replace(/-/g, '')
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
  }
}

export function transformVideoIntoDynamoItem(metadata: Metadata): DynamoDBFile {
  return {
    fileId: metadata.videoId,
    key: metadata.fileName,
    size: 0,
    contentType: undefined,
    availableAt: new Date().getTime() / 1000,
    authorName: metadata.author.name,
    authorUser: metadata.author.user,
    title: metadata.title,
    publishDate: undefined,
    description: metadata.description
  }
}
