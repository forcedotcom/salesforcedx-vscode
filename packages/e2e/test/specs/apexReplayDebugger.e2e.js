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
var mocha_steps_1 = require("mocha-steps");
var path_1 = require("path");
var testSetup_1 = require("../testSetup");
var utilities = require("../utilities/index");
var chai_1 = require("chai");
describe('Apex Replay Debugger', function () { return __awaiter(void 0, void 0, void 0, function () {
    var prompt, testSetup, projectFolderPath, logFileTitle, testReqConfig;
    return __generator(this, function (_a) {
        testReqConfig = {
            projectConfig: {
                projectShape: utilities.ProjectShapeOption.NEW
            },
            isOrgRequired: true,
            testSuiteSuffixName: 'ApexReplayDebugger'
        };
        (0, mocha_steps_1.step)('Set up the testing environment', function () { return __awaiter(void 0, void 0, void 0, function () {
            var successPushNotificationWasFound, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("ApexReplayDebugger - Set up the testing environment");
                        return [4 /*yield*/, testSetup_1.TestSetup.setUp(testReqConfig)];
                    case 1:
                        testSetup = _a.sent();
                        projectFolderPath = testSetup.projectFolderPath;
                        // Create Apex class file
                        return [4 /*yield*/, utilities.createApexClassWithTest('ExampleApexClass')];
                    case 2:
                        // Create Apex class file
                        _a.sent();
                        // Push source to org
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Push Source to Default Org and Ignore Conflicts', utilities.Duration.seconds(1))];
                    case 3:
                        // Push source to org
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        _a.trys.push([4, 6, , 9]);
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Push Source to Default Org and Ignore Conflicts successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 5:
                        successPushNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successPushNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 9];
                    case 6:
                        error_1 = _a.sent();
                        return [4 /*yield*/, utilities.getWorkbench().openNotificationsCenter()];
                    case 7:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Push Source to Default Org and Ignore Conflicts successfully ran', utilities.Duration.ONE_MINUTE)];
                    case 8:
                        successPushNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successPushNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 9];
                    case 9: return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Verify LSP finished indexing', function () { return __awaiter(void 0, void 0, void 0, function () {
            var statusBar, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        utilities.log("ApexReplayDebugger - Verify LSP finished indexing");
                        return [4 /*yield*/, utilities.getStatusBarItemWhichIncludes('Editor Language Status')];
                    case 1:
                        statusBar = _b.sent();
                        return [4 /*yield*/, statusBar.click()];
                    case 2:
                        _b.sent();
                        _a = chai_1.expect;
                        return [4 /*yield*/, statusBar.getAttribute('aria-label')];
                    case 3:
                        _a.apply(void 0, [_b.sent()]).to.contain('Indexing complete');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('SFDX: Turn On Apex Debug Log for Replay Debugger', function () { return __awaiter(void 0, void 0, void 0, function () {
            var successNotificationWasFound, error_2, outputPanelText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("ApexReplayDebugger - SFDX: Turn On Apex Debug Log for Replay Debugger");
                        // Clear output before running the command
                        return [4 /*yield*/, utilities.clearOutputView()];
                    case 1:
                        // Clear output before running the command
                        _a.sent();
                        // Run SFDX: Turn On Apex Debug Log for Replay Debugger
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Turn On Apex Debug Log for Replay Debugger', utilities.Duration.seconds(10))];
                    case 2:
                        // Run SFDX: Turn On Apex Debug Log for Replay Debugger
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 8]);
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Turn On Apex Debug Log for Replay Debugger successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 4:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 8];
                    case 5:
                        error_2 = _a.sent();
                        return [4 /*yield*/, utilities.getWorkbench().openNotificationsCenter()];
                    case 6:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Turn On Apex Debug Log for Replay Debugger successfully ran', utilities.Duration.ONE_MINUTE)];
                    case 7:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 8];
                    case 8: return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Salesforce CLI', 'Starting SFDX: Turn On Apex Debug Log for Replay Debugger', 10)];
                    case 9:
                        outputPanelText = _a.sent();
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        (0, chai_1.expect)(outputPanelText).to.contain('SFDX: Turn On Apex Debug Log for Replay Debugger ');
                        (0, chai_1.expect)(outputPanelText).to.contain('ended with exit code 0');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Run the Anonymous Apex Debugger with Currently Selected Text', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, textEditor, findWidget, successNotificationWasFound, outputPanelText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("ApexReplayDebugger - Run the Anonymous Apex Debugger with Currently Selected Text");
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'ExampleApexClassTest.cls')];
                    case 1:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.openFindWidget()];
                    case 2:
                        findWidget = _a.sent();
                        return [4 /*yield*/, findWidget.setSearchText("ExampleApexClass.SayHello('Cody');")];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(1))];
                    case 4:
                        _a.sent();
                        // Close finder tool
                        return [4 /*yield*/, findWidget.close()];
                    case 5:
                        // Close finder tool
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(1))];
                    case 6:
                        _a.sent();
                        // Clear output before running the command
                        return [4 /*yield*/, utilities.clearOutputView()];
                    case 7:
                        // Clear output before running the command
                        _a.sent();
                        // Run SFDX: Launch Apex Replay Debugger with Currently Selected Text.
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Execute Anonymous Apex with Currently Selected Text', utilities.Duration.seconds(1))];
                    case 8:
                        // Run SFDX: Launch Apex Replay Debugger with Currently Selected Text.
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('Execute Anonymous Apex successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 9:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Apex', 'Starting Execute Anonymous Apex', 10)];
                    case 10:
                        outputPanelText = _a.sent();
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        (0, chai_1.expect)(outputPanelText).to.contain('Compiled successfully.');
                        (0, chai_1.expect)(outputPanelText).to.contain('Executed successfully.');
                        (0, chai_1.expect)(outputPanelText).to.contain('|EXECUTION_STARTED');
                        (0, chai_1.expect)(outputPanelText).to.contain('|EXECUTION_FINISHED');
                        (0, chai_1.expect)(outputPanelText).to.contain('ended Execute Anonymous Apex');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('SFDX: Get Apex Debug Logs', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, quickPicks, successNotificationWasFound, outputPanelText, editorView, activeTab, title, textEditor, executionStarted, executionFinished;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("ApexReplayDebugger - SFDX: Get Apex Debug Logs");
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.clearOutputView()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(2))];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Get Apex Debug Logs', utilities.Duration.seconds(0))];
                    case 3:
                        prompt = _a.sent();
                        // Wait for the command to execute
                        return [4 /*yield*/, utilities.waitForNotificationToGoAway('Getting Apex debug logs', utilities.Duration.TEN_MINUTES)];
                    case 4:
                        // Wait for the command to execute
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(2))];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, prompt.getQuickPicks()];
                    case 6:
                        quickPicks = _a.sent();
                        (0, chai_1.expect)(quickPicks).to.not.be.undefined;
                        (0, chai_1.expect)(quickPicks.length).to.be.greaterThanOrEqual(0);
                        return [4 /*yield*/, prompt.selectQuickPick('User User - Api')];
                    case 7:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Get Apex Debug Logs successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 8:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Apex', 'Starting SFDX: Get Apex Debug Logs', 10)];
                    case 9:
                        outputPanelText = _a.sent();
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        (0, chai_1.expect)(outputPanelText).to.contain('|EXECUTION_STARTED');
                        (0, chai_1.expect)(outputPanelText).to.contain('|EXECUTION_FINISHED');
                        (0, chai_1.expect)(outputPanelText).to.contain('ended SFDX: Get Apex Debug Logs');
                        editorView = workbench.getEditorView();
                        return [4 /*yield*/, editorView.getActiveTab()];
                    case 10:
                        activeTab = _a.sent();
                        return [4 /*yield*/, (activeTab === null || activeTab === void 0 ? void 0 : activeTab.getTitle())];
                    case 11:
                        title = _a.sent();
                        return [4 /*yield*/, editorView.openEditor(title)];
                    case 12:
                        textEditor = (_a.sent());
                        return [4 /*yield*/, textEditor.getLineOfText('|EXECUTION_STARTED')];
                    case 13:
                        executionStarted = _a.sent();
                        return [4 /*yield*/, textEditor.getLineOfText('|EXECUTION_FINISHED')];
                    case 14:
                        executionFinished = _a.sent();
                        (0, chai_1.expect)(executionStarted).to.be.greaterThanOrEqual(1);
                        (0, chai_1.expect)(executionFinished).to.be.greaterThanOrEqual(1);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('SFDX: Launch Apex Replay Debugger with Last Log File', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, editorView, activeTab, title, logFilePath;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("ApexReplayDebugger - SFDX: Launch Apex Replay Debugger with Last Log File");
                        workbench = utilities.getWorkbench();
                        editorView = workbench.getEditorView();
                        return [4 /*yield*/, editorView.getActiveTab()];
                    case 1:
                        activeTab = _a.sent();
                        (0, chai_1.expect)(activeTab).to.not.be.undefined;
                        return [4 /*yield*/, (activeTab === null || activeTab === void 0 ? void 0 : activeTab.getTitle())];
                    case 2:
                        title = _a.sent();
                        if (title)
                            logFileTitle = title;
                        logFilePath = path_1.default.join(projectFolderPath, '.sfdx', 'tools', 'debug', 'logs', logFileTitle);
                        console.log('*** logFilePath = ' + logFilePath);
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Launch Apex Replay Debugger with Last Log File', utilities.Duration.seconds(1))];
                    case 3:
                        // Run SFDX: Launch Apex Replay Debugger with Last Log File
                        prompt = _a.sent();
                        return [4 /*yield*/, prompt.setText(logFilePath)];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, prompt.confirm()];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause()];
                    case 6:
                        _a.sent();
                        // Continue with the debug session
                        return [4 /*yield*/, utilities.continueDebugging(2, 30)];
                    case 7:
                        // Continue with the debug session
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('SFDX: Launch Apex Replay Debugger with Current File - log file', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("ApexReplayDebugger - SFDX: Launch Apex Replay Debugger with Current File - log file");
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, logFileTitle)];
                    case 1:
                        _a.sent();
                        // Run SFDX: Launch Apex Replay Debugger with Current File
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Launch Apex Replay Debugger with Current File', utilities.Duration.seconds(3))];
                    case 2:
                        // Run SFDX: Launch Apex Replay Debugger with Current File
                        _a.sent();
                        // Continue with the debug session
                        return [4 /*yield*/, utilities.continueDebugging(2, 30)];
                    case 3:
                        // Continue with the debug session
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('SFDX: Launch Apex Replay Debugger with Current File - test class', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, successNotificationWasFound;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("ApexReplayDebugger - SFDX: Launch Apex Replay Debugger with Current File - test class");
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'ExampleApexClassTest.cls')];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Launch Apex Replay Debugger with Current File', utilities.Duration.seconds(3))];
                    case 2:
                        _a.sent();
                        // Continue with the debug session
                        return [4 /*yield*/, utilities.continueDebugging(2, 30)];
                    case 3:
                        // Continue with the debug session
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('Debug Test(s) successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 4:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Run the Anonymous Apex Debugger using the Command Palette', function () { return __awaiter(void 0, void 0, void 0, function () {
            var successNotificationWasFound, outputPanelText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("ApexReplayDebugger - Run the Anonymous Apex Debugger using the Command Palette");
                        // Create anonymous apex file
                        return [4 /*yield*/, utilities.createAnonymousApexFile()];
                    case 1:
                        // Create anonymous apex file
                        _a.sent();
                        // Clear output before running the command
                        return [4 /*yield*/, utilities.clearOutputView()];
                    case 2:
                        // Clear output before running the command
                        _a.sent();
                        // Run SFDX: Launch Apex Replay Debugger with Editor Contents", using the Command Palette.
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Execute Anonymous Apex with Editor Contents', utilities.Duration.seconds(10))];
                    case 3:
                        // Run SFDX: Launch Apex Replay Debugger with Editor Contents", using the Command Palette.
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('Execute Anonymous Apex successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 4:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Apex', 'Starting Execute Anonymous Apex', 10)];
                    case 5:
                        outputPanelText = _a.sent();
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        (0, chai_1.expect)(outputPanelText).to.contain('Compiled successfully.');
                        (0, chai_1.expect)(outputPanelText).to.contain('Executed successfully.');
                        (0, chai_1.expect)(outputPanelText).to.contain('|EXECUTION_STARTED');
                        (0, chai_1.expect)(outputPanelText).to.contain('|EXECUTION_FINISHED');
                        (0, chai_1.expect)(outputPanelText).to.contain('ended Execute Anonymous Apex');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('SFDX: Turn Off Apex Debug Log for Replay Debugger', function () { return __awaiter(void 0, void 0, void 0, function () {
            var successNotificationWasFound, outputPanelText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("ApexReplayDebugger - SFDX: Turn Off Apex Debug Log for Replay Debugger");
                        // Run SFDX: Turn Off Apex Debug Log for Replay Debugger
                        return [4 /*yield*/, utilities.clearOutputView()];
                    case 1:
                        // Run SFDX: Turn Off Apex Debug Log for Replay Debugger
                        _a.sent();
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Turn Off Apex Debug Log for Replay Debugger', utilities.Duration.seconds(1))];
                    case 2:
                        prompt = _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Turn Off Apex Debug Log for Replay Debugger successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 3:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Salesforce CLI', 'Starting SFDX: Turn Off Apex Debug Log for Replay Debugger', 10)];
                    case 4:
                        outputPanelText = _a.sent();
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        (0, chai_1.expect)(outputPanelText).to.contain('Deleting Record...');
                        (0, chai_1.expect)(outputPanelText).to.contain('Success');
                        (0, chai_1.expect)(outputPanelText).to.contain('Successfully deleted record:');
                        (0, chai_1.expect)(outputPanelText).to.contain('ended with exit code 0');
                        return [2 /*return*/];
                }
            });
        }); });
        after('Tear down and clean up the testing environment', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("ApexReplayDebugger - Tear down and clean up the testing environment");
                        return [4 /*yield*/, (testSetup === null || testSetup === void 0 ? void 0 : testSetup.tearDown())];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        return [2 /*return*/];
    });
}); });
