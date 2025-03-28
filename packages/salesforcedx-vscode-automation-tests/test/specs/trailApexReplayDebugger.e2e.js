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
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
var mocha_steps_1 = require("mocha-steps");
var vscode_extension_tester_1 = require("vscode-extension-tester");
var testSetup_1 = require("../testSetup");
var utilities = require("../utilities/index");
var chai_1 = require("chai");
/**
 * This test suite walks through the same steps performed in the "Find and Fix Bugs with Apex Replay Debugger" Trailhead Module;
 * which can be found with the following link:
 * https://trailhead.salesforce.com/content/learn/projects/find-and-fix-bugs-with-apex-replay-debugger
 */
describe('"Find and Fix Bugs with Apex Replay Debugger" Trailhead Module', function () { return __awaiter(void 0, void 0, void 0, function () {
    var prompt, testSetup, testReqConfig;
    return __generator(this, function (_a) {
        testReqConfig = {
            projectConfig: {
                projectShape: utilities.ProjectShapeOption.NEW
            },
            isOrgRequired: true,
            testSuiteSuffixName: 'TrailApexReplayDebugger'
        };
        (0, mocha_steps_1.step)('Set up the testing environment', function () { return __awaiter(void 0, void 0, void 0, function () {
            var successPushNotificationWasFound, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("TrailApexReplayDebugger - Set up the testing environment");
                        return [4 /*yield*/, testSetup_1.TestSetup.setUp(testReqConfig)];
                    case 1:
                        testSetup = _a.sent();
                        // Create Apex class AccountService
                        return [4 /*yield*/, utilities.createApexClassWithBugs()];
                    case 2:
                        // Create Apex class AccountService
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
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Verify LSP finished indexing"));
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
        (0, mocha_steps_1.step)('Run Apex Tests', function () { return __awaiter(void 0, void 0, void 0, function () {
            var successNotificationWasFound, error_2, outputPanelText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("TrailApexReplayDebugger - Run Apex Tests");
                        // Run SFDX: Run Apex tests.
                        return [4 /*yield*/, utilities.clearOutputView()];
                    case 1:
                        // Run SFDX: Run Apex tests.
                        _a.sent();
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Run Apex Tests', utilities.Duration.seconds(1))];
                    case 2:
                        prompt = _a.sent();
                        // Select the "AccountServiceTest" file
                        return [4 /*yield*/, prompt.selectQuickPick('AccountServiceTest')];
                    case 3:
                        // Select the "AccountServiceTest" file
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        _a.trys.push([4, 6, , 9]);
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Run Apex Tests successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 5:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 9];
                    case 6:
                        error_2 = _a.sent();
                        return [4 /*yield*/, utilities.getWorkbench().openNotificationsCenter()];
                    case 7:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Run Apex Tests successfully ran', utilities.Duration.ONE_MINUTE)];
                    case 8:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 9];
                    case 9: return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10)];
                    case 10:
                        outputPanelText = _a.sent();
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        (0, chai_1.expect)(outputPanelText).to.contain('Assertion Failed: incorrect ticker symbol');
                        (0, chai_1.expect)(outputPanelText).to.contain('Expected: CRM, Actual: SFDC');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Set Breakpoints and Checkpoints', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, textEditor, breakpoints, outputPanelText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("TrailApexReplayDebugger - Set Breakpoints and Checkpoints");
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'AccountService.cls')];
                    case 1:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.moveCursor(8, 5)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(1))];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Toggle Checkpoint', utilities.Duration.seconds(1))];
                    case 4:
                        // Run SFDX: Toggle Checkpoint.
                        prompt = _a.sent();
                        return [4 /*yield*/, workbench.findElements(vscode_extension_tester_1.By.css('div.codicon-debug-breakpoint-conditional'))];
                    case 5:
                        breakpoints = _a.sent();
                        (0, chai_1.expect)(breakpoints.length).to.equal(1);
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Update Checkpoints in Org', utilities.Duration.seconds(20))];
                    case 6:
                        // Run SFDX: Update Checkpoints in Org.
                        prompt = _a.sent();
                        return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Apex Replay Debugger', 'Starting SFDX: Update Checkpoints in Org', 10)];
                    case 7:
                        outputPanelText = _a.sent();
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        (0, chai_1.expect)(outputPanelText).to.contain('SFDX: Update Checkpoints in Org, Step 6 of 6: Confirming successful checkpoint creation');
                        (0, chai_1.expect)(outputPanelText).to.contain('Ending SFDX: Update Checkpoints in Org');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('SFDX: Turn On Apex Debug Log for Replay Debugger', function () { return __awaiter(void 0, void 0, void 0, function () {
            var successNotificationWasFound, outputPanelText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("TrailApexReplayDebugger - SFDX: Turn On Apex Debug Log for Replay Debugger");
                        // Run SFDX: Turn On Apex Debug Log for Replay Debugger
                        return [4 /*yield*/, utilities.clearOutputView()];
                    case 1:
                        // Run SFDX: Turn On Apex Debug Log for Replay Debugger
                        _a.sent();
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Turn On Apex Debug Log for Replay Debugger', utilities.Duration.seconds(10))];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Turn On Apex Debug Log for Replay Debugger successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 3:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Salesforce CLI', 'Starting SFDX: Turn On Apex Debug Log for Replay Debugger', 10)];
                    case 4:
                        outputPanelText = _a.sent();
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        (0, chai_1.expect)(outputPanelText).to.contain('SFDX: Turn On Apex Debug Log for Replay Debugger ');
                        (0, chai_1.expect)(outputPanelText).to.contain('ended with exit code 0');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Run Apex Tests', function () { return __awaiter(void 0, void 0, void 0, function () {
            var successNotificationWasFound, error_3, outputPanelText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("TrailApexReplayDebugger - Run Apex Tests");
                        // Run SFDX: Run Apex tests.
                        return [4 /*yield*/, utilities.clearOutputView()];
                    case 1:
                        // Run SFDX: Run Apex tests.
                        _a.sent();
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Run Apex Tests', utilities.Duration.seconds(1))];
                    case 2:
                        prompt = _a.sent();
                        // Select the "AccountServiceTest" file
                        return [4 /*yield*/, prompt.selectQuickPick('AccountServiceTest')];
                    case 3:
                        // Select the "AccountServiceTest" file
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        _a.trys.push([4, 6, , 9]);
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Run Apex Tests successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 5:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 9];
                    case 6:
                        error_3 = _a.sent();
                        return [4 /*yield*/, utilities.getWorkbench().openNotificationsCenter()];
                    case 7:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Run Apex Tests successfully ran', utilities.Duration.ONE_MINUTE)];
                    case 8:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 9];
                    case 9: return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10)];
                    case 10:
                        outputPanelText = _a.sent();
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        (0, chai_1.expect)(outputPanelText).to.contain('Assertion Failed: incorrect ticker symbol');
                        (0, chai_1.expect)(outputPanelText).to.contain('Expected: CRM, Actual: SFDC');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('SFDX: Get Apex Debug Logs', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, quickPicks, successNotificationWasFound, outputPanelText, editorView, activeTab, title, textEditor, executionStarted, executionFinished;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("TrailApexReplayDebugger - SFDX: Get Apex Debug Logs");
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Get Apex Debug Logs', utilities.Duration.seconds(0))];
                    case 1:
                        prompt = _a.sent();
                        // Wait for the command to execute
                        return [4 /*yield*/, utilities.waitForNotificationToGoAway('Getting Apex debug logs', utilities.Duration.TEN_MINUTES)];
                    case 2:
                        // Wait for the command to execute
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(2))];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, prompt.getQuickPicks()];
                    case 4:
                        quickPicks = _a.sent();
                        (0, chai_1.expect)(quickPicks).to.not.be.undefined;
                        (0, chai_1.expect)(quickPicks.length).to.be.greaterThan(0);
                        return [4 /*yield*/, prompt.selectQuickPick('User User - ApexTestHandler')];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Get Apex Debug Logs successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 6:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Apex', 'Starting SFDX: Get Apex Debug Logs', 10)];
                    case 7:
                        outputPanelText = _a.sent();
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        (0, chai_1.expect)(outputPanelText).to.contain('|EXECUTION_STARTED');
                        (0, chai_1.expect)(outputPanelText).to.contain('|EXECUTION_FINISHED');
                        (0, chai_1.expect)(outputPanelText).to.contain('ended SFDX: Get Apex Debug Logs');
                        editorView = workbench.getEditorView();
                        return [4 /*yield*/, editorView.getActiveTab()];
                    case 8:
                        activeTab = _a.sent();
                        return [4 /*yield*/, (activeTab === null || activeTab === void 0 ? void 0 : activeTab.getTitle())];
                    case 9:
                        title = _a.sent();
                        return [4 /*yield*/, editorView.openEditor(title)];
                    case 10:
                        textEditor = (_a.sent());
                        return [4 /*yield*/, textEditor.getLineOfText('|EXECUTION_STARTED')];
                    case 11:
                        executionStarted = _a.sent();
                        return [4 /*yield*/, textEditor.getLineOfText('|EXECUTION_FINISHED')];
                    case 12:
                        executionFinished = _a.sent();
                        (0, chai_1.expect)(executionStarted).to.be.greaterThan(0);
                        (0, chai_1.expect)(executionFinished).to.be.greaterThan(0);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Replay an Apex Debug Log', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("TrailApexReplayDebugger - Replay an Apex Debug Log");
                        // Run SFDX: Launch Apex Replay Debugger with Current File
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Launch Apex Replay Debugger with Current File', utilities.Duration.seconds(30))];
                    case 1:
                        // Run SFDX: Launch Apex Replay Debugger with Current File
                        _a.sent();
                        // Continue with the debug session
                        return [4 /*yield*/, utilities.continueDebugging(2, 30)];
                    case 2:
                        // Continue with the debug session
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Push Fixed Metadata to Org', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, textEditor, successPushNotificationWasFound, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(process.platform === 'darwin')) return [3 /*break*/, 11];
                        utilities.log("TrailApexReplayDebugger - Push Fixed Metadata to Org");
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'AccountService.cls')];
                    case 1:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.setTextAtLine(6, '\t\t\tTickerSymbol = tickerSymbol')];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, textEditor.save()];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(2))];
                    case 4:
                        _a.sent();
                        // Push source to org
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Push Source to Default Org and Ignore Conflicts', utilities.Duration.seconds(10))];
                    case 5:
                        // Push source to org
                        _a.sent();
                        successPushNotificationWasFound = void 0;
                        _a.label = 6;
                    case 6:
                        _a.trys.push([6, 8, , 11]);
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Push Source to Default Org and Ignore Conflicts successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 7:
                        successPushNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successPushNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 11];
                    case 8:
                        error_4 = _a.sent();
                        return [4 /*yield*/, utilities.getWorkbench().openNotificationsCenter()];
                    case 9:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Push Source to Default Org and Ignore Conflicts successfully ran', utilities.Duration.ONE_MINUTE)];
                    case 10:
                        successPushNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successPushNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 11];
                    case 11: return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Run Apex Tests to Verify Fix', function () { return __awaiter(void 0, void 0, void 0, function () {
            var successNotificationWasFound, error_5, outputPanelText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(process.platform === 'darwin')) return [3 /*break*/, 11];
                        utilities.log("TrailApexReplayDebugger - Run Apex Tests to Verify Fix");
                        // Run SFDX: Run Apex tests.
                        return [4 /*yield*/, utilities.clearOutputView()];
                    case 1:
                        // Run SFDX: Run Apex tests.
                        _a.sent();
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Run Apex Tests', utilities.Duration.seconds(1))];
                    case 2:
                        prompt = _a.sent();
                        // Select the "AccountServiceTest" file
                        return [4 /*yield*/, prompt.selectQuickPick('AccountServiceTest')];
                    case 3:
                        // Select the "AccountServiceTest" file
                        _a.sent();
                        successNotificationWasFound = void 0;
                        _a.label = 4;
                    case 4:
                        _a.trys.push([4, 6, , 9]);
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Run Apex Tests successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 5:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 9];
                    case 6:
                        error_5 = _a.sent();
                        return [4 /*yield*/, utilities.getWorkbench().openNotificationsCenter()];
                    case 7:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Run Apex Tests successfully ran', utilities.Duration.ONE_MINUTE)];
                    case 8:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 9];
                    case 9: return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10)];
                    case 10:
                        outputPanelText = _a.sent();
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        (0, chai_1.expect)(outputPanelText).to.contain('AccountServiceTest.should_create_account');
                        (0, chai_1.expect)(outputPanelText).to.contain('Pass');
                        _a.label = 11;
                    case 11: return [2 /*return*/];
                }
            });
        }); });
        (0, vscode_extension_tester_1.after)('Tear down and clean up the testing environment', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("TrailApexReplayDebugger - Tear down and clean up the testing environment");
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
