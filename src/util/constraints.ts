
/*
if (!ytdl.validateURL(youTubeVideoUrl)) {
    return {statusCode: 400, body: '\'ArticleURL\' is invalid YouTube video URL.'}
}
*/
import * as validate from 'validate.js'
import {validateURL} from 'ytdl-core'

validate.validators.isYouTubeURL = (value, options, key, attributes) => {
    console.log(value)
    console.log(options)
    console.log(key)
    console.log(attributes)
    if (!validateURL(value)) {
        return validate.format('^%{value} is not a valid YouTube URL', {value})
    }
    return null
}

export const feedlyEventConstraints = {
    ArticleURL: {
        isYouTubeURL: true,
        presence: true
    }
}
