"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const S3 = require("aws-sdk/clients/s3");
const s3 = new S3({ apiVersion: '2006-03-01' });
function uploadToS3(params) {
    return new Promise((resolve, reject) => {
        const upload = new S3.ManagedUpload({
            params,
            partSize: 10 * 1024 * 1024,
            queueSize: 100
        });
        upload.on('httpUploadProgress', (progress) => console.debug('Progress', JSON.stringify(progress)));
        upload.send((err, data) => {
            if (err) {
                console.error(err);
                return reject(err);
            }
            else {
                console.debug('Upload complete', JSON.stringify(data));
                return resolve(data);
            }
        });
    });
}
exports.uploadToS3 = uploadToS3;
function createMultipartUpload(params) {
    return new Promise((resolve, reject) => {
        console.log('Creating multipart upload for:', params.Key);
        s3.createMultipartUpload(params, (error, multipart) => {
            if (error) {
                console.error(error);
                return reject(error);
            }
            console.log('Got upload ID', JSON.stringify(multipart));
            return resolve(multipart.UploadId);
        });
    });
}
exports.createMultipartUpload = createMultipartUpload;
function completeMultipartUpload(params) {
    return new Promise((resolve, reject) => {
        console.log('Completing multipart upload for:', params.Key);
        s3.completeMultipartUpload(params, (err, data) => {
            if (err) {
                console.log('An error occurred while completing the multipart upload');
                console.log(err);
                reject(err);
            }
            else {
                // const delta: number = +(new Date() - startTime) / 1000
                // console.log('Completed upload in', delta, 'seconds')
                console.log('Final upload data:', data);
                resolve(data);
            }
        });
    });
}
exports.completeMultipartUpload = completeMultipartUpload;
function uploadPart(partParams, tryNum) {
    return new Promise((resolve, reject) => {
        if (!tryNum) {
            tryNum = 1;
        }
        s3.uploadPart(partParams, (multiErr, mData) => {
            if (multiErr) {
                console.log('multiErr, upload part error:', multiErr);
                if (tryNum < 3) {
                    console.log('Retrying upload of part: #', partParams.PartNumber);
                    uploadPart(partParams, tryNum + 1);
                }
                else {
                    console.log('Failed uploading part: #', partParams.PartNumber);
                    return reject(multiErr);
                }
                return;
            }
            return resolve(mData);
        });
    });
}
exports.uploadPart = uploadPart;
function listObjects(params) {
    return new Promise((resolve, reject) => {
        s3.listObjectsV2(params, (error, data) => {
            if (error) {
                reject(error);
            }
            else {
                resolve(data);
            }
        });
    });
}
exports.listObjects = listObjects;
