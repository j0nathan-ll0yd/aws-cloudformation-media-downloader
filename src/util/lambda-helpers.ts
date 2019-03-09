export function response(context, statusCode, body, headers?) {
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
    } else {
        return {
            body: JSON.stringify({
                body,
                requestId: context.awsRequestId
            }),
            headers,
            statusCode
        }
    }
}
