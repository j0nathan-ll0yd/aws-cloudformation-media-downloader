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
    for (const key of ['author', 'description', 'published', 'title']) {
        if (!myVideoInfo[key]) {
            throw new Error(`myVideoInfo missing property ${key}`)
        }
    }
    //noinspection SpellCheckingInspection
    const {author, description, iurlmaxres, published, thumbnail_url, title} = myVideoInfo
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
    // NetworkingError: Invalid character in header content ["x-amz-meta-title"]
    // Must adhere to https://tools.ietf.org/html/rfc2616#section-4.2
    const escapedTitle = title.replace(/[\°\(\)\@\,\;\:\"\/\[\]\\\?\=\{\}\’]/g, '')
    return {
        Body: video_url,
        Bucket: myBucket,
        Key: sourceFilenameFromVideoInfo(myVideoInfo),
        Metadata: {title: escapedTitle}
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
        const newVal = (typeof val === 'object') ? objectKeysToLowerCase(val) : val
        newObj[newKey] = newVal
        return newObj
    }, {})
}
