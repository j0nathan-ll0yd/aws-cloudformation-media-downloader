"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*
if (!ytdl.validateURL(youTubeVideoUrl)) {
    return {statusCode: 400, body: '\'ArticleURL\' is invalid YouTube video URL.'}
}
*/
const validate = require("validate.js");
const ytdl_core_1 = require("ytdl-core");
validate.validators.isYouTubeURL = (value, options, key, attributes) => {
    console.log(value);
    console.log(options);
    console.log(key);
    console.log(attributes);
    if (!ytdl_core_1.validateURL(value)) {
        return validate.format('^%{value} is not a valid YouTube URL', { value });
    }
    return null;
};
exports.feedlyEventConstraints = {
    ArticleURL: {
        isYouTubeURL: true,
        presence: true
    }
};
