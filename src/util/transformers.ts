import {videoFormat, videoInfo} from 'ytdl-core'
import {chooseFormat} from '../lib/vendor/YouTube'
import {Metadata} from '../types/main'
import {logDebug} from './lambda-helpers'

function getHighestVideoFormatFromVideoInfo(myVideoInfo: videoInfo): videoFormat {
    try {
        // quality 22 = highest quality MP4 format
        const highestVideoFormat = chooseFormat(myVideoInfo, {
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
    //noinspection SpellCheckingInspection
    const {author, description, iurlmaxres, published, thumbnail_url, title} = myVideoInfo
    // TODO: Strip non-alphanumeric characters in the title to avoid this AWS error:
    // NetworkingError: Invalid character in header content ["x-amz-meta-title"]
    return {
        author,
        description,
        ext: myVideoFormat.container,
        formats: [myVideoFormat],
        imageUri: iurlmaxres || thumbnail_url,
        mimeType: myVideoFormat.mimeType,
        published,
        title
    }
}

export function sourceFilenameFromVideoInfo(myVideoInfo: videoInfo): string {
    const myVideoFormat: videoFormat = getHighestVideoFormatFromVideoInfo(myVideoInfo)
    const {author: {name}, published} = myVideoInfo
    const date = new Date(published)
    const ext = myVideoFormat.container
    const uploadDate = date.toISOString().substr(0, 10).replace(/-/g, '')
    return `${uploadDate}-[${name}].${ext}`
}

export function transformVideoIntoS3File(myVideoInfo: videoInfo, myBucket: string) {
    // const myVideoFormat: videoFormat = getHighestVideoFormatFromVideoInfo(myVideoInfo)
    const {video_url, title} = myVideoInfo
    return {
        Body: video_url,
        Bucket: myBucket,
        Key: sourceFilenameFromVideoInfo(myVideoInfo),
        Metadata: {title}
    }
}

export function objectKeysToLowerCase(input) {
    console.log(`typeof = ${typeof input}, input = ${input}`)
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
        const newVal = (typeof val === 'object') ? objectKeysToLowerCase(val) : val
        newObj[newKey] = newVal
        return newObj
    }, {})
}
