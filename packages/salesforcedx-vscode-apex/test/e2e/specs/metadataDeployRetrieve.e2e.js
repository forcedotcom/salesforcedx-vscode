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
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
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
Object.defineProperty(exports, "__esModule", { value: true });
/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
var chai_1 = require("chai");
var mocha_steps_1 = require("mocha-steps");
var path_1 = require("path");
var vscode_extension_tester_1 = require("vscode-extension-tester");
var testSetup_1 = require("../testSetup");
var utilities = require("../utilities/index");
// In future we will merge the test together with deployAndRetrieve
describe('metadata mdDeployRetrieve', function () { return __awaiter(void 0, void 0, void 0, function () {
    var testSetup, testReqConfig, mdPath, textV1, textV2, textV2AfterRetrieve, runAndValidateCommand, validateCommand;
    return __generator(this, function (_a) {
        testReqConfig = {
            projectConfig: {
                projectShape: utilities.ProjectShapeOption.NAMED,
                githubRepoUrl: 'https://github.com/mingxuanzhangsfdx/DeployInv.git'
            },
            isOrgRequired: true,
            testSuiteSuffixName: 'mdDeployRetrieve'
        };
        (0, mocha_steps_1.step)('Set up the testing environment', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("mdDeployRetrieve - Set up the testing environment");
                        return [4 /*yield*/, testSetup_1.TestSetup.setUp(testReqConfig)];
                    case 1:
                        testSetup = _a.sent();
                        mdPath = path_1.default.join(testSetup.projectFolderPath, 'force-app/main/default/objects/Account/fields/Deploy_Test__c.field-meta.xml');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Open and deploy MD v1', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("mdDeployRetrieve - Open and deploy MD v1");
                        return [4 /*yield*/, utilities.openFile(mdPath)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, utilities.attemptToFindTextEditorText(mdPath)];
                    case 2:
                        textV1 = _a.sent();
                        return [4 /*yield*/, runAndValidateCommand('Deploy', 'to', 'ST')];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, utilities.clearOutputView()];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, utilities.closeAllEditors()];
                    case 5:
                        _a.sent(); // close editor to make sure editor is up to date
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Update MD v2 and deploy again', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("mdDeployRetrieve - Update MD v2 and deploy again");
                        return [4 /*yield*/, utilities.gitCheckout('updated-md', testSetup.projectFolderPath)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, utilities.openFile(mdPath)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, utilities.attemptToFindTextEditorText(mdPath)];
                    case 3:
                        textV2 = _a.sent();
                        (0, chai_1.expect)(textV1).not.to.equal(textV2); // MD file should be updated
                        return [4 /*yield*/, runAndValidateCommand('Deploy', 'to', 'ST')];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, utilities.clearOutputView()];
                    case 5:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Retrieve MD v2 and verify the text not changed', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("mdDeployRetrieve - Retrieve MD v2 and verify the text not changed");
                        return [4 /*yield*/, utilities.openFile(mdPath)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, runAndValidateCommand('Retrieve', 'from', 'ST')];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, utilities.attemptToFindTextEditorText(mdPath)];
                    case 3:
                        textV2AfterRetrieve = _a.sent();
                        (0, chai_1.expect)(textV2AfterRetrieve).to.contain(textV2); // should be same
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vscode_extension_tester_1.after)('Tear down and clean up the testing environment', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("mdDeployRetrieve - Tear down and clean up the testing environment");
                        return [4 /*yield*/, utilities.gitCheckout('main', testSetup.projectFolderPath)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (testSetup === null || testSetup === void 0 ? void 0 : testSetup.tearDown())];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        runAndValidateCommand = function (operation, fromTo, type) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("runAndValidateCommand()");
                        return [4 /*yield*/, utilities.executeQuickPick("SFDX: ".concat(operation, " This Source ").concat(fromTo, " Org"), utilities.Duration.seconds(5))];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, validateCommand(operation, fromTo, type)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); };
        validateCommand = function (operation, fromTo, type // Text to identify operation type (if it has source tracking enabled, disabled or if it was a deploy on save)
        ) { return __awaiter(void 0, void 0, void 0, function () {
            var successNotificationWasFound, outputPanelText, _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        utilities.log("validateCommand()");
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout("SFDX: ".concat(operation, " This Source ").concat(fromTo, " Org successfully ran"), utilities.Duration.TEN_MINUTES)];
                    case 1:
                        successNotificationWasFound = _d.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Salesforce CLI', "Starting SFDX: ".concat(operation, " This Source ").concat(fromTo), 10)];
                    case 2:
                        outputPanelText = _d.sent();
                        _b = (_a = utilities).log;
                        _c = "".concat(operation, " time ").concat(type, ": ");
                        return [4 /*yield*/, utilities.getOperationTime(outputPanelText)];
                    case 3:
                        _b.apply(_a, [_c + (_d.sent())]);
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        (0, chai_1.expect)(outputPanelText).to.contain("".concat(operation, "ed Source").replace('Retrieveed', 'Retrieved'));
                        (0, chai_1.expect)(outputPanelText).to.contain("Account.Deploy_Test__c  CustomField");
                        (0, chai_1.expect)(outputPanelText).to.contain("ended SFDX: ".concat(operation, " This Source ").concat(fromTo, " Org"));
                        return [2 /*return*/];
                }
            });
        }); };
        return [2 /*return*/];
    });
}); });
