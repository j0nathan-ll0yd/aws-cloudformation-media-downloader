export function response(context, statusCode, body?, headers?) {
    let code = 'custom-5XX-generic'
    let error = false
    if (/^4/.test(statusCode)) {
        code = 'custom-4XX-generic'
        error = true
    } else if (/^5/.test(statusCode)) {
        error = true
    }
    if (error) {
        return {
            body: JSON.stringify({
                error: { code, message:  body },
                requestId: context.awsRequestId
            }),
            headers,
            statusCode
        }
    } else if (body) {
        return {
            body: JSON.stringify({
                body,
                requestId: context.awsRequestId
            }),
            headers,
            statusCode
        }
    } else {
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