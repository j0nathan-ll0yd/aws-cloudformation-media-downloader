import * as validate from 'validate.js'
import {validateURL} from 'ytdl-core'

validate.validators.presence.message = '^is required'
validate.validators.isYouTubeURL = (value) => {
    if (value && !validateURL(value)) {
        return '^is not a valid YouTube URL'
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
