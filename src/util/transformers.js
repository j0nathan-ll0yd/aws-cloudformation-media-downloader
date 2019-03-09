"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const YouTube_1 = require("../lib/vendor/YouTube");
function getHighestVideoFormatFromVideoInfo(myVideoInfo) {
    try {
        const highestVideoFormat = YouTube_1.chooseFormat(myVideoInfo, { quality: 'highestvideo' });
        if (highestVideoFormat instanceof Error) {
            throw highestVideoFormat;
        }
        else {
            return highestVideoFormat;
        }
    }
    catch (error) {
        throw new Error('Unable to find format');
    }
}
function transformVideoInfoToMetadata(myVideoInfo) {
    const myVideoFormat = getHighestVideoFormatFromVideoInfo(myVideoInfo);
    //noinspection SpellCheckingInspection
    const { author, description, iurlmaxres, published, thumbnail_url, title, view_count } = myVideoInfo;
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
    };
}
exports.transformVideoInfoToMetadata = transformVideoInfoToMetadata;
function sourceFilenameFromVideoInfo(myVideoInfo) {
    const myVideoFormat = getHighestVideoFormatFromVideoInfo(myVideoInfo);
    const { author: { user }, published, title } = myVideoInfo;
    const date = new Date(published);
    const ext = myVideoFormat.container;
    const uploadDate = date.toISOString().substr(0, 10).replace(/-/g, '');
    return `${uploadDate}-[${user}]-${title}.${ext}`;
}
exports.sourceFilenameFromVideoInfo = sourceFilenameFromVideoInfo;
function transformVideoIntoS3File(myVideoInfo, myBucket) {
    // const myVideoFormat: videoFormat = getHighestVideoFormatFromVideoInfo(myVideoInfo)
    const { video_url } = myVideoInfo;
    return {
        Body: video_url,
        Bucket: myBucket,
        Key: sourceFilenameFromVideoInfo(myVideoInfo)
    };
}
exports.transformVideoIntoS3File = transformVideoIntoS3File;
function objectKeysToLowerCase(input) {
    if (typeof input !== 'object')
        return input;
    if (Array.isArray(input))
        return input.map(objectKeysToLowerCase);
    return Object.keys(input).reduce(function (newObj, key) {
        let val = input[key];
        newObj[key.charAt(0).toLowerCase() + key.slice(1)] = (typeof val === 'object') ? objectKeysToLowerCase(val) : val;
        return newObj;
    }, {});
}
exports.objectKeysToLowerCase = objectKeysToLowerCase;
