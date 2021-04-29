"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
exports.__esModule = true;
var child_process_1 = require("child_process");
var fs = require("fs");
var chai_1 = require("chai");
var expect = chai_1["default"].expect;
// TODO: This would need to run POST-deploy, because only then is the status updated
describe('#Terraform', function () {
    var environmentVariableRegex = /process.env.(\w+)/g;
    var jsonFilePath = __dirname + "/../../build/terraform.json";
    child_process_1.execSync("cd " + __dirname + "/../../terraform && terraform show -json > " + jsonFilePath);
    var jsonFile = fs.readFileSync(jsonFilePath, 'utf8');
    var terraformPlan = JSON.parse(jsonFile);
    beforeEach(function () {
        // comment
    });
    afterEach(function () {
        // comment
    });
    // TODO: Handle handleLoginUser and registerUser methods; because of underlying ENV variables
    var environmentVariablesTerraformCount = 0;
    var environmentVariablesSourceCount = 0;
    var environmentVariablesTerraform = [];
    var environmentVariablesSource = [];
    var _loop_1 = function (resource) {
        if (resource.type !== 'aws_lambda_function') {
            return "continue";
        }
        // TODO: Make adjustments for a Cloudfront Lambda
        var functionName = resource.name;
        if (functionName === 'CloudfrontMiddleware' || functionName === 'LoginUser' || functionName === 'RegisterUser') {
            return "continue";
        }
        var functionPath = __dirname + "/../../src/lambdas/" + functionName + "/src/index.ts";
        it("should match environment variables for lambda " + functionName, function () { return __awaiter(void 0, void 0, void 0, function () {
            var functionSource, matches;
            return __generator(this, function (_a) {
                if (resource.values.environment && resource.values.environment.length > 0) {
                    if (resource.values.environment.length > 1) {
                        throw new Error('Invalid environment structure in Terraform output');
                    }
                    console.log('EVV!' + JSON.stringify(resource.values.environment, null, 2));
                    environmentVariablesTerraform = Object.keys(resource.values.environment[0].variables);
                    environmentVariablesTerraformCount = environmentVariablesTerraform.length;
                    console.log("environmentVariablesTerraform = " + environmentVariablesTerraform);
                }
                functionSource = fs.readFileSync(functionPath, 'utf8');
                matches = functionSource.match(environmentVariableRegex);
                if (!matches || matches.length === 0) {
                    return [2 /*return*/];
                }
                environmentVariablesSource = __spreadArray([], new Set(matches.map(function (match) { return match.substring(12); })));
                console.log("environmentVariablesSource = " + environmentVariablesSource);
                environmentVariablesSourceCount = environmentVariablesSource.length;
                console.log(JSON.stringify(matches, null, 2));
                console.log(JSON.stringify(resource, null, 2));
                console.log("Terraform ENV (" + environmentVariablesTerraformCount + ") vs. Source ENV (" + environmentVariablesSourceCount + ")");
                expect(environmentVariablesTerraform.sort()).to.eql(environmentVariablesSource.sort());
                expect(environmentVariablesTerraformCount).to.equal(environmentVariablesSourceCount);
                return [2 /*return*/];
            });
        }); });
    };
    for (var _i = 0, _a = terraformPlan.values.root_module.resources; _i < _a.length; _i++) {
        var resource = _a[_i];
        _loop_1(resource);
    }
});
