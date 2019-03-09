"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SNS = require("../../../../node_modules/aws-sdk/clients/sns");
const sns = new SNS({ apiVersion: '2010-03-31' });
function publishSnsEvent(params) {
    return new Promise((resolve, reject) => {
        sns.publish(params, (error, data) => {
            if (error) {
                reject(error);
            }
            else {
                resolve(data);
            }
        });
    });
}
exports.publishSnsEvent = publishSnsEvent;
