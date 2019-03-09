"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = require("axios");
const validate_js_1 = require("validate.js");
const ApiGateway_1 = require("./lib/vendor/AWS/ApiGateway");
const S3_1 = require("./lib/vendor/AWS/S3");
const StepFunctions_1 = require("./lib/vendor/AWS/StepFunctions");
const YouTube_1 = require("./lib/vendor/YouTube");
const constraints_1 = require("./util/constraints");
const lambda_helpers_1 = require("./util/lambda-helpers");
const transformers_1 = require("./util/transformers");
if (process.env.AWS_SAM_LOCAL) {
    process.env.TopicArn = 'arn:aws:sns:us-west-1:203465012143:lifegames-app-UploadFileTopic-1ICLDFSFGDLF4';
    process.env.Bucket = 'lifegames-app-s3bucket-pq2lluyi2i12';
    process.env.StateMachineArn = 'arn:aws:states:us-west-1:203465012143:stateMachine:LambdaStateMachine';
}
exports.handleAuthorization = async (event) => {
    console.debug('Received event: ', JSON.stringify(event, null, 2));
    console.debug('Received EV:', JSON.stringify(process.env, null, 2));
    try {
        const queryStringParameters = event.queryStringParameters;
        // This should always be defined, because it's governed by the API Gateway
        const apiKeyValue = queryStringParameters.ApiKey;
        const apiKeyResponse = await ApiGateway_1.getApiKeys({ includeValues: true });
        console.log('API Key data', JSON.stringify(apiKeyResponse, null, 2));
        const matchedApiKeys = apiKeyResponse.items.filter((item) => item.value === apiKeyValue);
        console.log('Matched API Key data', JSON.stringify(matchedApiKeys, null, 2));
        console.log('Matched API Key data', matchedApiKeys.length);
        if (matchedApiKeys.length > 0) {
            const apiKey = matchedApiKeys[0];
            if (apiKey.enabled === false) {
                return ApiGateway_1.generateDeny('me', event.methodArn);
            }
            console.log('Getting usage plans');
            const usagePlansResponse = await ApiGateway_1.getUsagePlans({ keyId: apiKey.id });
            console.log('Usage plans', JSON.stringify(usagePlansResponse, null, 2));
            let responseObject = ApiGateway_1.generateAllow('me', event.methodArn);
            if (usagePlansResponse.items) {
                const usagePlanId = usagePlansResponse.items[0].id;
                // MyUsagePlan: k9i2ri
                // iOSApiKey: tfmmf65cag
                // MyUsagePlanKey: tfmmf65cag:k9i2ri
                const usageIdentifierKey = `${apiKey.id}:${usagePlansResponse.items[0].id}`;
                console.log(`usageIdentifierKey = ${usageIdentifierKey}`);
                // does NOT work: apiKeyValue ? Testing now
                // does NOT work: apiKey.id (aka keyId)
                // does NOT work: usagePlanId
                // TO TEST: usageIdentifierKey
                responseObject = ApiGateway_1.generateAllow('me', event.methodArn, apiKeyValue);
                const usageDate = (new Date()).toISOString().split('T')[0];
                const params = {
                    endDate: usageDate,
                    keyId: apiKey.id,
                    startDate: usageDate,
                    usagePlanId
                };
                console.log('Getting usage data with params ', JSON.stringify(params, null, 2));
                const usageResponse = await ApiGateway_1.getUsage(params);
                console.log('Usage data', JSON.stringify(usageResponse, null, 2));
            }
            console.log('Responding with ', JSON.stringify(responseObject, null, 2));
            return responseObject;
        }
        console.log('Responding with ', JSON.stringify(ApiGateway_1.generateDeny('me', event.methodArn), null, 2));
        return ApiGateway_1.generateDeny('me', event.methodArn);
    }
    catch (error) {
        console.error(error);
        return ApiGateway_1.generateDeny('me', event.methodArn);
    }
};
exports.handleFeedlyEvent = async (event, context) => {
    console.debug('Received event: ', JSON.stringify(event, null, 2));
    console.debug('Received EV:', JSON.stringify(process.env, null, 2));
    // TODO: verify that the body is actually JSON via API Gateway
    const body = JSON.parse(event.body);
    const invalidAttributes = validate_js_1.validate(body, constraints_1.feedlyEventConstraints);
    if (invalidAttributes) {
        return lambda_helpers_1.response(context, 400, invalidAttributes);
    }
    try {
        console.info('Fetching VideoInfo');
        const myVideoInfo = await YouTube_1.fetchVideoInfo(body.ArticleURL);
        const myMetadata = transformers_1.transformVideoInfoToMetadata(myVideoInfo);
        const myS3File = transformers_1.transformVideoIntoS3File(myVideoInfo, process.env.Bucket);
        const url = myMetadata.formats[0].url;
        const options = {
            method: 'head',
            timeout: 1000,
            url
        };
        console.info('Requesting ', url);
        const fileInfo = await axios_1.default(options);
        // console.log(response.data)
        console.log(fileInfo.status);
        console.log(fileInfo.statusText);
        console.log(fileInfo.headers);
        // check for Accept-Ranges: bytes header
        // check for Content-Length header
        console.log(fileInfo.config);
        const params = {
            input: JSON.stringify({
                bucket: process.env.Bucket,
                bytesTotal: parseInt(fileInfo.headers['content-length'], 10),
                contentType: fileInfo.headers['content-type'],
                key: myS3File.Key,
                url
            }),
            name: (new Date()).getTime().toString(),
            stateMachineArn: process.env.StateMachineArn
        };
        console.log('Executing stepfunction ', JSON.stringify(params, null, 2));
        const data = await StepFunctions_1.startExecution(params);
        console.log('Complete execution', JSON.stringify(data, null, 2));
        return lambda_helpers_1.response(context, 202, myMetadata);
    }
    catch (error) {
        console.error(error);
        return lambda_helpers_1.response(context, 500, error.message);
    }
};
exports.listFiles = async (event, context) => {
    console.debug('Received event: ', JSON.stringify(event, null, 2));
    console.debug('Received EV:', JSON.stringify(process.env, null, 2));
    try {
        const files = await S3_1.listObjects({ Bucket: process.env.Bucket, MaxKeys: 1000 });
        files.Contents.forEach((file) => {
            // https://lifegames-app-s3bucket-pq2lluyi2i12.s3.amazonaws.com/20150402-%5Bcondenasttraveler%5D-Shorties%20Winner%3A%20One%20Year%20of%20Travel%20in%20One%20Minute.mp4
            file.FileUrl = `https://${files.Name}.s3.amazonaws.com/${encodeURIComponent(file.Key)}`;
            return file;
        });
        return lambda_helpers_1.response(context, 200, files);
    }
    catch (error) {
        console.error(error);
        throw new Error(error.message);
    }
};
exports.startFileUpload = async (event) => {
    console.debug('Received event: ', JSON.stringify(event, null, 2));
    try {
        const partSize = 1024 * 1024 * 5;
        // Minimum 5MB per chunk (except the last part)
        // http://docs.aws.amazon.com/AmazonS3/latest/API/mpUploadComplete.html
        const { bucket, key, url, contentType, bytesTotal } = event;
        const params = { Bucket: bucket, ContentType: contentType, Key: key };
        console.log('Creating Multipart Upload', JSON.stringify(params, null, 2));
        const uploadId = await S3_1.createMultipartUpload(params);
        const newPartEnd = Math.min(partSize, bytesTotal);
        return {
            bucket,
            bytesRemaining: parseInt(bytesTotal, 10),
            bytesTotal: parseInt(bytesTotal, 10),
            key,
            partBeg: 0,
            partEnd: newPartEnd - 1,
            partNumber: 1,
            partSize,
            partTags: [],
            uploadId,
            url
        };
    }
    catch (error) {
        console.log(error);
    }
};
exports.uploadPart = async (event) => {
    console.debug('Received event: ', JSON.stringify(event, null, 2));
    try {
        const { bucket, bytesRemaining, bytesTotal, key, partBeg, partEnd, partNumber, partSize, partTags, uploadId, url } = event;
        const options = {
            headers: { Range: `bytes=${partBeg}-${partEnd}` },
            method: 'get',
            responseType: 'stream',
            url
        };
        console.info('Requesting ', url);
        const fileInfo = await axios_1.default(options);
        console.log('Fileinfo Status', fileInfo.status, fileInfo.statusText);
        console.log('Fileinfo Headers', JSON.stringify(fileInfo.headers, null, 2));
        const params = {
            Body: fileInfo.data,
            Bucket: bucket,
            ContentLength: fileInfo.headers['content-length'],
            Key: key,
            PartNumber: partNumber,
            UploadId: uploadId
        };
        const partData = await S3_1.uploadPart(params);
        console.log('Completed part', partNumber);
        console.log('partData', JSON.stringify(partData, null, 2));
        partTags.push({ ETag: partData.ETag, PartNumber: partNumber });
        const newPartEnd = Math.min(partEnd + partSize, bytesTotal);
        const newBytesRemaining = bytesRemaining - partSize;
        const nextPart = {
            bucket,
            bytesRemaining: newBytesRemaining,
            bytesTotal,
            key,
            partBeg: partEnd + 1,
            partEnd: newPartEnd,
            partNumber: partNumber + 1,
            partSize,
            partTags,
            uploadId,
            url
        };
        if (partEnd === bytesTotal) {
            return {
                bucket,
                bytesRemaining: 0,
                key,
                partTags,
                uploadId
            };
        }
        else {
            return nextPart;
        }
    }
    catch (error) {
        console.log(error);
    }
};
exports.completeFileUpload = async (event) => {
    console.debug('Received event: ', JSON.stringify(event, null, 2));
    try {
        const { bucket, key, partTags, uploadId } = event;
        const params = {
            Bucket: bucket,
            Key: key,
            MultipartUpload: { Parts: partTags },
            UploadId: uploadId
        };
        console.log('Completing Multipart Upload', JSON.stringify(params, null, 2));
        const data = await S3_1.completeMultipartUpload(params);
        console.log('Completed Multipart Upload', JSON.stringify(data, null, 2));
        return;
    }
    catch (error) {
        console.log(error);
    }
};
