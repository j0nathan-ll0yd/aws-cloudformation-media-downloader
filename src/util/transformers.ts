import {videoFormat, videoInfo} from 'ytdl-core'
import {chooseFormat} from '../lib/vendor/YouTube'
import {Metadata} from '../types/main'

function getHighestVideoFormatFromVideoInfo(myVideoInfo: videoInfo): videoFormat {
    try {
        // quality 22 = highest quality MP4 format
        const highestVideoFormat = chooseFormat(myVideoInfo, {quality: '22'})
        if (highestVideoFormat instanceof Error) { throw highestVideoFormat } else { return highestVideoFormat }
    } catch (error) {
        throw new Error('Unable to find format')
    }
}

export function transformVideoInfoToMetadata(myVideoInfo: videoInfo): Metadata {
    const myVideoFormat: videoFormat = getHighestVideoFormatFromVideoInfo(myVideoInfo)
    //noinspection SpellCheckingInspection
    const {author, description, iurlmaxres, published, thumbnail_url, title, view_count} = myVideoInfo
    return {
        author,
        description,
        ext: myVideoFormat.container,
        formats: [myVideoFormat],
        imageUri: iurlmaxres || thumbnail_url,
        mimeType: myVideoFormat.type,
        published,
        title,
        viewCount: parseInt(view_count, 10)
    }
}

export function sourceFilenameFromVideoInfo(myVideoInfo: videoInfo): string {
    const myVideoFormat: videoFormat = getHighestVideoFormatFromVideoInfo(myVideoInfo)
    const {author: {user}, published, title} = myVideoInfo
    const date = new Date(published)
    const ext = myVideoFormat.container
    const uploadDate = date.toISOString().substr(0, 10).replace(/-/g, '')
    return `${uploadDate}-[${user}]-${title}.${ext}`
}

export function transformVideoIntoS3File(myVideoInfo: videoInfo, myBucket: string) {
    // const myVideoFormat: videoFormat = getHighestVideoFormatFromVideoInfo(myVideoInfo)
    const {video_url} = myVideoInfo
    return {
        Body: video_url,
        Bucket: myBucket,
        Key: sourceFilenameFromVideoInfo(myVideoInfo)
    }
}

export function objectKeysToLowerCase(input) {
  if (typeof input !== 'object') return input
  if (Array.isArray(input)) return input.map(objectKeysToLowerCase);
  return Object.keys(input).reduce(function (newObj, key) {
    let val = input[key]
    newObj[key.charAt(0).toLowerCase() + key.slice(1)] = (typeof val === 'object') ? objectKeysToLowerCase(val) : val
    return newObj
  }, {})
}
