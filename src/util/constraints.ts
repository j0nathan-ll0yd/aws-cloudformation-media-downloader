import * as validate from 'validate.js'
import {validateURL} from 'ytdl-core'
import {logDebug} from './lambda-helpers'

// A custom function is needed; because default logic mangles attribute names
// https://validatejs.org/#utilities-prettify
const prettify = (str) => {
  if (validate.isNumber(str)) {
    logDebug('str is Number')
    // If there are more than 2 decimals round it to two
    if ((str * 100) % 1 === 0) {
      return '' + str
    } else {
      return parseFloat(String(Math.round(str * 100) / 100)).toFixed(2)
    }
  }

  if (validate.isArray(str)) {
    logDebug('str is Array')
    return str
      .map(function (s) {
        return validate.prettify(s)
      })
      .join(', ')
  }

  if (validate.isObject(str)) {
    logDebug('str is Object')
    if (!validate.isDefined(str.toString)) {
      return JSON.stringify(str)
    }
    return str.toString()
  }

  // Ensure the string is actually a string
  str = '' + str
  logDebug('str is ' + str)
  logDebug('str is Good')
  return str
}

export const validateOptions = {
  format: 'grouped',
  fullMessages: false,
  prettify
}

// TODO: Remove this logic on this issue is resolved: https://github.com/ansman/validate.js/issues/69#issuecomment-567200324
// In order for the attribute name to be included in the error message, it is automatically capitalized, so we have to override
// https://validatejs.org/docs/validate.html#section-47
const defaultPresenceConstraint = {
  allowEmpty: false,
  message: (_value, attribute) => {
    return `^${attribute} is required`
  }
}

validate.validators.isYouTubeURL = (value) => {
  if (value && !validateURL(value)) {
    return '^is not a valid YouTube URL'
  }
  return undefined
}

export const feedlyEventConstraints = {
  articleURL: {
    isYouTubeURL: true,
    presence: defaultPresenceConstraint
  }
}

export const registerDeviceConstraints = {
  token: {
    presence: defaultPresenceConstraint
  }
}

export const userSubscribeConstraints = {
  endpointArn: {
    presence: defaultPresenceConstraint
  },
  topicArn: {
    presence: defaultPresenceConstraint
  }
}

export const registerUserConstraints = {
  authorizationCode: {
    presence: defaultPresenceConstraint
  },
  firstName: {
    presence: defaultPresenceConstraint
  },
  lastName: {
    presence: defaultPresenceConstraint
  }
}

export const loginUserConstraints = {
  authorizationCode: {
    presence: defaultPresenceConstraint
  }
}
