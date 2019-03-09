"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ytdl = require("ytdl-core");
function fetchVideoInfo(uri) {
    return new Promise(async (resolve, reject) => {
        try {
            const info = await ytdl.getInfo(uri);
            resolve(info);
        }
        catch (error) {
            reject(error);
        }
    });
}
exports.fetchVideoInfo = fetchVideoInfo;
function filterFormats(info, filter) {
    return ytdl.filterFormats(info.formats, filter);
}
exports.filterFormats = filterFormats;
function chooseFormat(info, options) {
    return ytdl.chooseFormat(info.formats, options);
}
exports.chooseFormat = chooseFormat;
function fetchVideo(uri, options) {
    return ytdl(uri, options);
}
exports.fetchVideo = fetchVideo;
