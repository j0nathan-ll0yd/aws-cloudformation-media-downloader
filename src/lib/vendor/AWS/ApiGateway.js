"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const APIGateway = require("../../../../node_modules/aws-sdk/clients/apigateway");
const apigateway = new APIGateway({ apiVersion: '2016-11-23' });
function getApiKey(apiKey) {
    return new Promise((resolve, reject) => {
        const params = {
            apiKey,
            includeValue: true
        };
        apigateway.getApiKey(params, (error, data) => {
            if (error) {
                reject(error);
            }
            else {
                resolve(data);
            }
        });
    });
}
exports.getApiKey = getApiKey;
function getApiKeys(params) {
    return new Promise((resolve, reject) => {
        apigateway.getApiKeys(params, (error, data) => {
            if (error) {
                reject(error);
            }
            else {
                resolve(data);
            }
        });
    });
}
exports.getApiKeys = getApiKeys;
function getUsage(params) {
    return new Promise((resolve, reject) => {
        apigateway.getUsage(params, (error, data) => {
            if (error) {
                reject(error);
            }
            else {
                resolve(data);
            }
        });
    });
}
exports.getUsage = getUsage;
function getUsagePlans(params) {
    return new Promise((resolve, reject) => {
        apigateway.getUsagePlans(params, (error, data) => {
            if (error) {
                reject(error);
            }
            else {
                resolve(data);
            }
        });
    });
}
exports.getUsagePlans = getUsagePlans;
// Help function to generate an IAM policy
const generatePolicy = (principalId, effect, resource, usageIdentifierKey) => {
    const authResponse = { context: {}, policyDocument: {}, principalId, usageIdentifierKey };
    if (effect && resource) {
        const policyDocument = { Statement: [], Version: '2012-10-17' };
        const statementOne = {
            Action: 'execute-api:Invoke',
            Effect: effect,
            Resource: resource
        };
        statementOne.Resource = resource;
        policyDocument.Statement[0] = statementOne;
        authResponse.policyDocument = policyDocument;
    }
    // Optional output with custom properties of the String, Number or Boolean type.
    authResponse.context = {
        booleanKey: true,
        numberKey: 123,
        stringKey: 'stringval'
    };
    return authResponse;
};
function generateAllow(principalId, resource, usageIdentifierKey) {
    return generatePolicy(principalId, 'Allow', resource, usageIdentifierKey);
}
exports.generateAllow = generateAllow;
function generateDeny(principalId, resource, usageIdentifierKey) {
    return generatePolicy(principalId, 'Deny', resource, usageIdentifierKey);
}
exports.generateDeny = generateDeny;
