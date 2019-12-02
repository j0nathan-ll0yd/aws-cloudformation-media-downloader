
/*
if (!ytdl.validateURL(youTubeVideoUrl)) {
    return {statusCode: 400, body: '\'ArticleURL\' is invalid YouTube video URL.'}
}
*/
import * as validate from 'validate.js'
import {validateURL} from 'ytdl-core'

validate.validators.isYouTubeURL = (value) => {
    if (value && !validateURL(value)) {
        return validate.format('^%{value} is not a valid YouTube URL', {value})
    }
    return
}

export const feedlyEventConstraints = {
    ArticleURL: {
        isYouTubeURL: true,
        presence: true
    }
}

export const registerDeviceConstraints = {
    Token: {
        presence: true
    }
}
