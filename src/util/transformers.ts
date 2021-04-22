import {PublishInput} from 'aws-sdk/clients/sns'
import {MessageBodyAttributeMap} from 'aws-sdk/clients/sqs'
import {videoFormat, videoInfo} from 'ytdl-core'
import {chooseVideoFormat} from '../lib/vendor/YouTube'
import {ClientFile, DynamoDBFile, FileNotification, Metadata} from '../types/main'
import {logDebug} from './lambda-helpers'

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
    throw new Error('Unable to find format')
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
        file: objectKeysToLowerCase(clientFile)
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
    if (!myVideoInfo.videoDetails[key]) {
      throw new Error(`myVideoInfo missing property ${key}`)
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

// eslint-disable-next-line @typescript-eslint/ban-types
export function objectKeysToLowerCase(input: object): object {
  if (typeof input !== 'object') {
    return input
  }
  if (Array.isArray(input)) {
    return input.map(objectKeysToLowerCase)
  }
  if (Object.prototype.toString.call(input) === '[object Date]') {
    return input
  }
  return Object.keys(input).reduce((newObj, key) => {
    const val = input[key]
    const newKey = (key.charAt(0).toLowerCase() + key.slice(1) || key).toString()
    newObj[newKey] = typeof val === 'object' ? objectKeysToLowerCase(val) : val
    return newObj
  }, {})
}
