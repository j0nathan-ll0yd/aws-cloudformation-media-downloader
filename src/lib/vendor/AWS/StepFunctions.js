"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const StepFunctions = require("../../../../node_modules/aws-sdk/clients/stepfunctions");
const stepfunctions = new StepFunctions({ apiVersion: '2016-11-23' });
function startExecution(params) {
    return new Promise((resolve, reject) => {
        stepfunctions.startExecution(params, (error, data) => {
            if (error) {
                reject(error);
            }
            else {
                resolve(data);
            }
        });
    });
}
exports.startExecution = startExecution;
