import {APIGatewayEvent} from 'aws-lambda'

export function response(context, statusCode, body?, headers?) {
    let code = 'custom-5XX-generic'
    let error = false
    if (/^4/.test(statusCode)) {
        code = 'custom-4XX-generic'
        error = true
    }
    if (/^3/.test(statusCode)) {
        code = 'custom-3XX-generic'
        error = true
    }
    else if (/^5/.test(statusCode)) {
        error = true
    }
    if (error) {
        const rawBody = {
            error: { code, message:  body },
            requestId: context.awsRequestId
        }
        logDebug('response ==', rawBody)
        return {
            body: JSON.stringify(rawBody),
            headers,
            statusCode
        }
    } else if (body) {
        const rawBody = {
            body,
            requestId: context.awsRequestId
        }
        logDebug('response ==', rawBody)
        return {
            body: JSON.stringify(rawBody),
            headers,
            statusCode
        }
    } else {
        logDebug('response ==', '')
        return {
            body: '',
            headers,
            statusCode
        }
    }
}

function stringify(stringOrObject) {
    if (typeof stringOrObject === 'object') {
        stringOrObject = JSON.stringify(stringOrObject, null, 2)
    }
    return stringOrObject
}

export function logInfo(message, stringOrObject?) {
    console.info(message, stringOrObject ? stringify(stringOrObject) : '')
}

export function logDebug(message, stringOrObject?) {
    console.log(message, stringOrObject ? stringify(stringOrObject) : '')
}

export function logError(message, stringOrObject?) {
    console.error(message, stringOrObject ? stringify(stringOrObject) : '')
}

export function getUserIdFromEvent(event: APIGatewayEvent) {
    const userId = event.headers['X-User-Id']
    if (!userId) {
        throw new Error('No X-User-Id in Header')
    }
    return userId
}
