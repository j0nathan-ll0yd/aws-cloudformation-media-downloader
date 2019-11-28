// Helper function to generate an IAM policy
// https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-lambda-authorizer-output.html
import {CustomAuthorizerResult} from 'aws-lambda'

const generatePolicy = (principalId, effect, resource, usageIdentifierKey) => {
    return {
        context: {},
        policyDocument: {
            Statement: [
                {
                    Action: 'execute-api:Invoke',
                    Effect: effect,
                    Resource: resource
                }
            ],
            Version: '2012-10-17'
        },
        principalId,
        usageIdentifierKey
    }
}

export function generateAllow(principalId, resource, usageIdentifierKey?): CustomAuthorizerResult {
    return generatePolicy(principalId, 'Allow', resource, usageIdentifierKey)
}

export function generateDeny(principalId, resource, usageIdentifierKey?): CustomAuthorizerResult {
    return generatePolicy(principalId, 'Deny', resource, usageIdentifierKey)
}
