import {videoFormat, videoInfo} from 'ytdl-core'
import {chooseVideoFormat} from '../lib/vendor/YouTube'
import {Metadata} from '../types/main'
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

export function transformVideoInfoToMetadata(myVideoInfo: videoInfo): Metadata {
    const myVideoFormat: videoFormat = getHighestVideoFormatFromVideoInfo(myVideoInfo)
    logDebug('videoDetails', myVideoInfo.videoDetails)
    // @ts-ignore
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
    const escapedTitle = title.replace(/[°()@,;:"\/\[\]\\?={}’]/g, '')

    return {
        videoId,
        fileName,
        escapedTitle,
        author,
        description,
        ext: myVideoFormat.container,
        formats: [myVideoFormat],
        // @ts-ignore
        imageUri: thumbnails[thumbnails.length-1].url,
        mimeType: myVideoFormat.mimeType,
        published: Date.parse(publishDate),
        title
    }
}

export function transformVideoIntoDynamoItem(metadata: Metadata) {
    return {
      fileId: metadata.videoId,
      fileKey: metadata.fileName,
      availableAt: Date.now().toString(),
      authorName: metadata.author.name,
      authorUser: metadata.author.user,
      title: metadata.title,
      description: metadata.description
    }
}

export function objectKeysToLowerCase(input) {
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
        newObj[newKey] = (typeof val === 'object') ? objectKeysToLowerCase(val) : val
        return newObj
    }, {})
}
