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
describe('Run Apex Tests', function () { return __awaiter(void 0, void 0, void 0, function () {
    var prompt, testSetup, testReqConfig;
    return __generator(this, function (_a) {
        testReqConfig = {
            projectConfig: {
                projectShape: utilities.ProjectShapeOption.NEW
            },
            isOrgRequired: true,
            testSuiteSuffixName: 'RunApexTests'
        };
        (0, mocha_steps_1.step)('Set up the testing environment', function () { return __awaiter(void 0, void 0, void 0, function () {
            var error_1, error_2, error_3, successPushNotificationWasFound, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("RunApexTests - Set up the testing environment");
                        return [4 /*yield*/, testSetup_1.TestSetup.setUp(testReqConfig)];
                    case 1:
                        testSetup = _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 6]);
                        return [4 /*yield*/, utilities.createApexClassWithTest('ExampleApexClass1')];
                    case 3:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 4:
                        error_1 = _a.sent();
                        return [4 /*yield*/, utilities.createApexClassWithTest('ExampleApexClass1')];
                    case 5:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 6:
                        _a.trys.push([6, 8, , 10]);
                        return [4 /*yield*/, utilities.createApexClassWithTest('ExampleApexClass2')];
                    case 7:
                        _a.sent();
                        return [3 /*break*/, 10];
                    case 8:
                        error_2 = _a.sent();
                        return [4 /*yield*/, utilities.createApexClassWithTest('ExampleApexClass2')];
                    case 9:
                        _a.sent();
                        return [3 /*break*/, 10];
                    case 10:
                        _a.trys.push([10, 12, , 14]);
                        return [4 /*yield*/, utilities.createApexClassWithTest('ExampleApexClass3')];
                    case 11:
                        _a.sent();
                        return [3 /*break*/, 14];
                    case 12:
                        error_3 = _a.sent();
                        return [4 /*yield*/, utilities.createApexClassWithTest('ExampleApexClass3')];
                    case 13:
                        _a.sent();
                        return [3 /*break*/, 14];
                    case 14: 
                    // Push source to org
                    return [4 /*yield*/, utilities.executeQuickPick('SFDX: Push Source to Default Org and Ignore Conflicts', utilities.Duration.seconds(1))];
                    case 15:
                        // Push source to org
                        _a.sent();
                        _a.label = 16;
                    case 16:
                        _a.trys.push([16, 18, , 21]);
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Push Source to Default Org and Ignore Conflicts successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 17:
                        successPushNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successPushNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 21];
                    case 18:
                        error_4 = _a.sent();
                        return [4 /*yield*/, utilities.getWorkbench().openNotificationsCenter()];
                    case 19:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Push Source to Default Org and Ignore Conflicts successfully ran', utilities.Duration.ONE_MINUTE)];
                    case 20:
                        successPushNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successPushNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 21];
                    case 21: return [2 /*return*/];
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
        (0, mocha_steps_1.step)('Run All Tests via Apex Class', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, textEditor, runAllTestsOption, successNotificationWasFound, error_5, outputPanelText, expectedTexts;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("RunApexTests - Run All Tests via Apex Class");
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'ExampleApexClass1Test.cls')];
                    case 1:
                        textEditor = _a.sent();
                        // Clear the Output view.
                        return [4 /*yield*/, utilities.dismissAllNotifications()];
                    case 2:
                        // Clear the Output view.
                        _a.sent();
                        return [4 /*yield*/, utilities.clearOutputView(utilities.Duration.seconds(2))];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, textEditor.getCodeLens('Run All Tests')];
                    case 4:
                        runAllTestsOption = _a.sent();
                        return [4 /*yield*/, runAllTestsOption.click()];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6:
                        _a.trys.push([6, 8, , 11]);
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Run Apex Tests successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 7:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 11];
                    case 8:
                        error_5 = _a.sent();
                        return [4 /*yield*/, workbench.openNotificationsCenter()];
                    case 9:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Run Apex Tests successfully ran', utilities.Duration.ONE_MINUTE)];
                    case 10:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 11];
                    case 11: return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10)];
                    case 12:
                        outputPanelText = _a.sent();
                        expectedTexts = [
                            '=== Test Summary',
                            'Outcome              Passed',
                            'Tests Ran            1',
                            'Pass Rate            100%',
                            'TEST NAME',
                            'ExampleApexClass1Test.validateSayHello  Pass',
                            'ended SFDX: Run Apex Tests'
                        ];
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        return [4 /*yield*/, utilities.verifyOutputPanelText(outputPanelText, expectedTexts)];
                    case 13:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Run Single Test via Apex Class', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, textEditor, runTestOption, successNotificationWasFound, error_6, outputPanelText, expectedTexts;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("RunApexTests - Run Single Test via Apex Class");
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'ExampleApexClass2Test.cls')];
                    case 1:
                        textEditor = _a.sent();
                        // Clear the Output view.
                        return [4 /*yield*/, utilities.dismissAllNotifications()];
                    case 2:
                        // Clear the Output view.
                        _a.sent();
                        return [4 /*yield*/, utilities.clearOutputView(utilities.Duration.seconds(2))];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, textEditor.getCodeLens('Run Test')];
                    case 4:
                        runTestOption = _a.sent();
                        return [4 /*yield*/, runTestOption.click()];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6:
                        _a.trys.push([6, 8, , 11]);
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Run Apex Tests successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 7:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 11];
                    case 8:
                        error_6 = _a.sent();
                        return [4 /*yield*/, workbench.openNotificationsCenter()];
                    case 9:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Run Apex Tests successfully ran', utilities.Duration.ONE_MINUTE)];
                    case 10:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 11];
                    case 11: return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10)];
                    case 12:
                        outputPanelText = _a.sent();
                        expectedTexts = [
                            '=== Test Summary',
                            'Outcome              Passed',
                            'Tests Ran            1',
                            'Pass Rate            100%',
                            'TEST NAME',
                            'ExampleApexClass2Test.validateSayHello  Pass',
                            'ended SFDX: Run Apex Tests'
                        ];
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        return [4 /*yield*/, utilities.verifyOutputPanelText(outputPanelText, expectedTexts)];
                    case 13:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Run All Tests via Command Palette', function () { return __awaiter(void 0, void 0, void 0, function () {
            var successNotificationWasFound, error_7, outputPanelText, expectedTexts;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("RunApexTests - Run All Tests via Command Palette");
                        // Clear the Output view.
                        return [4 /*yield*/, utilities.dismissAllNotifications()];
                    case 1:
                        // Clear the Output view.
                        _a.sent();
                        return [4 /*yield*/, utilities.clearOutputView(utilities.Duration.seconds(2))];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Run Apex Tests', utilities.Duration.seconds(1))];
                    case 3:
                        // Run SFDX: Run Apex tests.
                        prompt = _a.sent();
                        // Select the "All Tests" option
                        return [4 /*yield*/, prompt.selectQuickPick('All Tests')];
                    case 4:
                        // Select the "All Tests" option
                        _a.sent();
                        _a.label = 5;
                    case 5:
                        _a.trys.push([5, 7, , 10]);
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Run Apex Tests successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 6:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 10];
                    case 7:
                        error_7 = _a.sent();
                        return [4 /*yield*/, utilities.getWorkbench().openNotificationsCenter()];
                    case 8:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Run Apex Tests successfully ran', utilities.Duration.ONE_MINUTE)];
                    case 9:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 10];
                    case 10: return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10)];
                    case 11:
                        outputPanelText = _a.sent();
                        expectedTexts = [
                            '=== Test Summary',
                            'Outcome              Passed',
                            'Tests Ran            3',
                            'Pass Rate            100%',
                            'TEST NAME',
                            'ExampleApexClass1Test.validateSayHello  Pass',
                            'ExampleApexClass2Test.validateSayHello  Pass',
                            'ExampleApexClass3Test.validateSayHello  Pass',
                            'ended SFDX: Run Apex Tests'
                        ];
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        return [4 /*yield*/, utilities.verifyOutputPanelText(outputPanelText, expectedTexts)];
                    case 12:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Run Single Class via Command Palette', function () { return __awaiter(void 0, void 0, void 0, function () {
            var successNotificationWasFound, error_8, outputPanelText, expectedTexts;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("RunApexTests - Run Single Class via Command Palette");
                        // Clear the Output view.
                        return [4 /*yield*/, utilities.dismissAllNotifications()];
                    case 1:
                        // Clear the Output view.
                        _a.sent();
                        return [4 /*yield*/, utilities.clearOutputView(utilities.Duration.seconds(2))];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Run Apex Tests', utilities.Duration.seconds(1))];
                    case 3:
                        // Run SFDX: Run Apex tests.
                        prompt = _a.sent();
                        // Select the "ExampleApexClass1Test" file
                        return [4 /*yield*/, prompt.selectQuickPick('ExampleApexClass1Test')];
                    case 4:
                        // Select the "ExampleApexClass1Test" file
                        _a.sent();
                        _a.label = 5;
                    case 5:
                        _a.trys.push([5, 7, , 10]);
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Run Apex Tests successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 6:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 10];
                    case 7:
                        error_8 = _a.sent();
                        return [4 /*yield*/, utilities.getWorkbench().openNotificationsCenter()];
                    case 8:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Run Apex Tests successfully ran', utilities.Duration.ONE_MINUTE)];
                    case 9:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 10];
                    case 10: return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10)];
                    case 11:
                        outputPanelText = _a.sent();
                        expectedTexts = [
                            '=== Test Summary',
                            'Outcome              Passed',
                            'Tests Ran            1',
                            'Pass Rate            100%',
                            'TEST NAME',
                            'ExampleApexClass1Test.validateSayHello  Pass',
                            'ended SFDX: Run Apex Tests'
                        ];
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        return [4 /*yield*/, utilities.verifyOutputPanelText(outputPanelText, expectedTexts)];
                    case 12:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Run All tests via Test Sidebar', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, testingView, testingSideBarView, apexTestsSection, expectedItems, apexTestsItems, runTestsAction, successNotificationWasFound, error_9, outputPanelText, expectedTexts, _i, apexTestsItems_1, item;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("RunApexTests - Run All tests via Test Sidebar");
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, workbench.getActivityBar().getViewControl('Testing')];
                    case 1:
                        testingView = _a.sent();
                        (0, chai_1.expect)(testingView).to.not.be.undefined;
                        return [4 /*yield*/, (testingView === null || testingView === void 0 ? void 0 : testingView.openView())];
                    case 2:
                        testingSideBarView = _a.sent();
                        (0, chai_1.expect)(testingSideBarView).to.be.instanceOf(vscode_extension_tester_1.SideBarView);
                        return [4 /*yield*/, utilities.getTestsSection(workbench, 'Apex Tests')];
                    case 3:
                        apexTestsSection = _a.sent();
                        expectedItems = ['ExampleApexClass1Test', 'ExampleApexClass2Test', 'ExampleApexClass3Test'];
                        return [4 /*yield*/, utilities.verifyTestItemsInSideBar(apexTestsSection, 'Refresh Tests', expectedItems, 6, 3)];
                    case 4:
                        apexTestsItems = _a.sent();
                        // Clear the Output view.
                        return [4 /*yield*/, utilities.dismissAllNotifications()];
                    case 5:
                        // Clear the Output view.
                        _a.sent();
                        return [4 /*yield*/, utilities.clearOutputView(utilities.Duration.seconds(2))];
                    case 6:
                        _a.sent();
                        // Click the run tests button on the top right corner of the Test sidebar
                        return [4 /*yield*/, apexTestsSection.click()];
                    case 7:
                        // Click the run tests button on the top right corner of the Test sidebar
                        _a.sent();
                        return [4 /*yield*/, apexTestsSection.getAction('Run Tests')];
                    case 8:
                        runTestsAction = _a.sent();
                        return [4 /*yield*/, runTestsAction.click()];
                    case 9:
                        _a.sent();
                        _a.label = 10;
                    case 10:
                        _a.trys.push([10, 12, , 15]);
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Run Apex Tests successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 11:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 15];
                    case 12:
                        error_9 = _a.sent();
                        return [4 /*yield*/, workbench.openNotificationsCenter()];
                    case 13:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Run Apex Tests successfully ran', utilities.Duration.ONE_MINUTE)];
                    case 14:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 15];
                    case 15: return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10)];
                    case 16:
                        outputPanelText = _a.sent();
                        expectedTexts = [
                            '=== Test Summary',
                            'Outcome              Passed',
                            'Tests Ran            3',
                            'Pass Rate            100%',
                            'TEST NAME',
                            'ExampleApexClass1Test.validateSayHello  Pass',
                            'ExampleApexClass2Test.validateSayHello  Pass',
                            'ExampleApexClass3Test.validateSayHello  Pass',
                            'ended SFDX: Run Apex Tests'
                        ];
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        return [4 /*yield*/, utilities.verifyOutputPanelText(outputPanelText, expectedTexts)];
                    case 17:
                        _a.sent();
                        _i = 0, apexTestsItems_1 = apexTestsItems;
                        _a.label = 18;
                    case 18:
                        if (!(_i < apexTestsItems_1.length)) return [3 /*break*/, 21];
                        item = apexTestsItems_1[_i];
                        return [4 /*yield*/, utilities.verifyTestIconColor(item, 'testPass')];
                    case 19:
                        _a.sent();
                        _a.label = 20;
                    case 20:
                        _i++;
                        return [3 /*break*/, 18];
                    case 21: return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Run All Tests on a Class via the Test Sidebar', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, outputPanelText, expectedTexts;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("RunApexTests - Run All Tests on a Class via the Test Sidebar");
                        workbench = utilities.getWorkbench();
                        // Clear the Output view.
                        return [4 /*yield*/, utilities.dismissAllNotifications()];
                    case 1:
                        // Clear the Output view.
                        _a.sent();
                        return [4 /*yield*/, utilities.clearOutputView(utilities.Duration.seconds(2))];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, utilities.runTestCaseFromSideBar(workbench, 'Apex Tests', 'ExampleApexClass2Test', 'Run Tests')];
                    case 3:
                        outputPanelText = _a.sent();
                        expectedTexts = [
                            '=== Test Summary',
                            'Outcome              Passed',
                            'Tests Ran            1',
                            'Pass Rate            100%',
                            'TEST NAME',
                            'ExampleApexClass2Test.validateSayHello  Pass',
                            'ended SFDX: Run Apex Tests'
                        ];
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        return [4 /*yield*/, utilities.verifyOutputPanelText(outputPanelText, expectedTexts)];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Run Single Test via the Test Sidebar', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, outputPanelText, expectedTexts;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("RunApexTests - 'Run Single Test via the Test Sidebar");
                        workbench = utilities.getWorkbench();
                        // Clear the Output view.
                        return [4 /*yield*/, utilities.dismissAllNotifications()];
                    case 1:
                        // Clear the Output view.
                        _a.sent();
                        return [4 /*yield*/, utilities.clearOutputView(utilities.Duration.seconds(2))];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, utilities.runTestCaseFromSideBar(workbench, 'Apex Tests', 'validateSayHello', 'Run Single Test')];
                    case 3:
                        outputPanelText = _a.sent();
                        expectedTexts = [
                            '=== Test Summary',
                            'Outcome              Passed',
                            'Tests Ran            1',
                            'Pass Rate            100%',
                            'TEST NAME',
                            'ExampleApexClass1Test.validateSayHello  Pass',
                            'ended SFDX: Run Apex Tests'
                        ];
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        return [4 /*yield*/, utilities.verifyOutputPanelText(outputPanelText, expectedTexts)];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Run a test that fails and fix it', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, successPushNotificationWasFound, error_10, successNotificationWasFound, error_11, outputPanelText, expectedTexts, textEditor, successPushNotification2WasFound, error_12, successNotification2WasFound;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("RunApexTests - Run a test that fails and fix it");
                        // Create Apex class AccountService
                        return [4 /*yield*/, utilities.createApexClassWithBugs()];
                    case 1:
                        // Create Apex class AccountService
                        _a.sent();
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Push Source to Default Org and Ignore Conflicts', utilities.Duration.seconds(1))];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 8]);
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Push Source to Default Org and Ignore Conflicts successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 4:
                        successPushNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successPushNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 8];
                    case 5:
                        error_10 = _a.sent();
                        return [4 /*yield*/, utilities.getWorkbench().openNotificationsCenter()];
                    case 6:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Push Source to Default Org and Ignore Conflicts successfully ran', utilities.Duration.ONE_MINUTE)];
                    case 7:
                        successPushNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successPushNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 8];
                    case 8: 
                    // Clear the Output view.
                    return [4 /*yield*/, utilities.dismissAllNotifications()];
                    case 9:
                        // Clear the Output view.
                        _a.sent();
                        return [4 /*yield*/, utilities.clearOutputView(utilities.Duration.seconds(2))];
                    case 10:
                        _a.sent();
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Run Apex Tests', utilities.Duration.seconds(1))];
                    case 11:
                        // Run SFDX: Run Apex tests.
                        prompt = _a.sent();
                        // Select the "AccountServiceTest" file
                        return [4 /*yield*/, prompt.setText('AccountServiceTest')];
                    case 12:
                        // Select the "AccountServiceTest" file
                        _a.sent();
                        return [4 /*yield*/, prompt.confirm()];
                    case 13:
                        _a.sent();
                        _a.label = 14;
                    case 14:
                        _a.trys.push([14, 16, , 19]);
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Run Apex Tests successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 15:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 19];
                    case 16:
                        error_11 = _a.sent();
                        return [4 /*yield*/, workbench.openNotificationsCenter()];
                    case 17:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Run Apex Tests successfully ran', utilities.Duration.ONE_MINUTE)];
                    case 18:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 19];
                    case 19: return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10)];
                    case 20:
                        outputPanelText = _a.sent();
                        expectedTexts = ['Assertion Failed: incorrect ticker symbol', 'Expected: CRM, Actual: SFDC'];
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        return [4 /*yield*/, utilities.verifyOutputPanelText(outputPanelText, expectedTexts)];
                    case 21:
                        _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'AccountService.cls')];
                    case 22:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.setTextAtLine(6, '\t\t\tTickerSymbol = tickerSymbol')];
                    case 23:
                        _a.sent();
                        return [4 /*yield*/, textEditor.save()];
                    case 24:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(1))];
                    case 25:
                        _a.sent();
                        // Push source to org
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Push Source to Default Org and Ignore Conflicts', utilities.Duration.seconds(1))];
                    case 26:
                        // Push source to org
                        _a.sent();
                        _a.label = 27;
                    case 27:
                        _a.trys.push([27, 29, , 32]);
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Push Source to Default Org and Ignore Conflicts successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 28:
                        successPushNotification2WasFound = _a.sent();
                        (0, chai_1.expect)(successPushNotification2WasFound).to.equal(true);
                        return [3 /*break*/, 32];
                    case 29:
                        error_12 = _a.sent();
                        return [4 /*yield*/, utilities.getWorkbench().openNotificationsCenter()];
                    case 30:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Push Source to Default Org and Ignore Conflicts successfully ran', utilities.Duration.ONE_MINUTE)];
                    case 31:
                        successPushNotification2WasFound = _a.sent();
                        (0, chai_1.expect)(successPushNotification2WasFound).to.equal(true);
                        return [3 /*break*/, 32];
                    case 32: 
                    // Clear the Output view.
                    return [4 /*yield*/, utilities.dismissAllNotifications()];
                    case 33:
                        // Clear the Output view.
                        _a.sent();
                        return [4 /*yield*/, utilities.clearOutputView(utilities.Duration.seconds(2))];
                    case 34:
                        _a.sent();
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Run Apex Tests', utilities.Duration.seconds(1))];
                    case 35:
                        // Run SFDX: Run Apex tests to verify fix
                        prompt = _a.sent();
                        // Select the "AccountServiceTest" file
                        return [4 /*yield*/, prompt.setText('AccountServiceTest')];
                    case 36:
                        // Select the "AccountServiceTest" file
                        _a.sent();
                        return [4 /*yield*/, prompt.confirm()];
                    case 37:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Run Apex Tests successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 38:
                        successNotification2WasFound = _a.sent();
                        (0, chai_1.expect)(successNotification2WasFound).to.equal(true);
                        return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10)];
                    case 39:
                        // Verify test results are listed on vscode's Output section
                        outputPanelText = _a.sent();
                        expectedTexts = [
                            '=== Test Summary',
                            'Outcome              Passed',
                            'Tests Ran            1',
                            'Pass Rate            100%',
                            'TEST NAME',
                            'AccountServiceTest.should_create_account  Pass',
                            'ended SFDX: Run Apex Tests'
                        ];
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        return [4 /*yield*/, utilities.verifyOutputPanelText(outputPanelText, expectedTexts)];
                    case 40:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Create Apex Test Suite', function () { return __awaiter(void 0, void 0, void 0, function () {
            var checkbox, successNotificationWasFound;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("RunApexTests - Create Apex Test Suite");
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Create Apex Test Suite', utilities.Duration.seconds(2))];
                    case 1:
                        // Run SFDX: Create Apex Test Suite.
                        prompt = _a.sent();
                        // Set the name of the new Apex Test Suite
                        return [4 /*yield*/, prompt.setText('ApexTestSuite')];
                    case 2:
                        // Set the name of the new Apex Test Suite
                        _a.sent();
                        return [4 /*yield*/, prompt.confirm()];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(2))];
                    case 4:
                        _a.sent();
                        // Choose tests that will belong to the new Apex Test Suite
                        return [4 /*yield*/, prompt.setText('ExampleApexClass1Test')];
                    case 5:
                        // Choose tests that will belong to the new Apex Test Suite
                        _a.sent();
                        return [4 /*yield*/, prompt.findElement(vscode_extension_tester_1.By.css('input.quick-input-list-checkbox'))];
                    case 6:
                        checkbox = _a.sent();
                        return [4 /*yield*/, checkbox.click()];
                    case 7:
                        _a.sent();
                        return [4 /*yield*/, utilities.clickFilePathOkButton()];
                    case 8:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Build Apex Test Suite successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 9:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Add test to Apex Test Suite', function () { return __awaiter(void 0, void 0, void 0, function () {
            var checkbox, successNotificationWasFound;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("RunApexTests - Add test to Apex Test Suite");
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Add Tests to Apex Test Suite', utilities.Duration.seconds(1))];
                    case 1:
                        // Run SFDX: Add Tests to Apex Test Suite.
                        prompt = _a.sent();
                        // Select the suite recently created called ApexTestSuite
                        return [4 /*yield*/, prompt.selectQuickPick('ApexTestSuite')];
                    case 2:
                        // Select the suite recently created called ApexTestSuite
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(2))];
                    case 3:
                        _a.sent();
                        // Choose tests that will belong to the already created Apex Test Suite
                        return [4 /*yield*/, prompt.setText('ExampleApexClass2Test')];
                    case 4:
                        // Choose tests that will belong to the already created Apex Test Suite
                        _a.sent();
                        return [4 /*yield*/, prompt.findElement(vscode_extension_tester_1.By.css('input.quick-input-list-checkbox'))];
                    case 5:
                        checkbox = _a.sent();
                        return [4 /*yield*/, checkbox.click()];
                    case 6:
                        _a.sent();
                        return [4 /*yield*/, utilities.clickFilePathOkButton()];
                    case 7:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Build Apex Test Suite successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 8:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Run Apex Test Suite', function () { return __awaiter(void 0, void 0, void 0, function () {
            var successNotificationWasFound, error_13, outputPanelText, expectedTexts;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("RunApexTests - Run Apex Test Suite");
                        // Clear the Output view.
                        return [4 /*yield*/, utilities.dismissAllNotifications()];
                    case 1:
                        // Clear the Output view.
                        _a.sent();
                        return [4 /*yield*/, utilities.clearOutputView(utilities.Duration.seconds(2))];
                    case 2:
                        _a.sent();
                        // Run SFDX: Run Apex Test Suite.
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Run Apex Test Suite', utilities.Duration.seconds(1))];
                    case 3:
                        // Run SFDX: Run Apex Test Suite.
                        _a.sent();
                        // Select the suite recently created called ApexTestSuite
                        return [4 /*yield*/, prompt.selectQuickPick('ApexTestSuite')];
                    case 4:
                        // Select the suite recently created called ApexTestSuite
                        _a.sent();
                        _a.label = 5;
                    case 5:
                        _a.trys.push([5, 7, , 10]);
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Run Apex Tests successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 6:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 10];
                    case 7:
                        error_13 = _a.sent();
                        return [4 /*yield*/, utilities.getWorkbench().openNotificationsCenter()];
                    case 8:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Run Apex Tests successfully ran', utilities.Duration.ONE_MINUTE)];
                    case 9:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 10];
                    case 10: return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10)];
                    case 11:
                        outputPanelText = _a.sent();
                        expectedTexts = [
                            '=== Test Summary',
                            'TEST NAME',
                            'ended SFDX: Run Apex Tests',
                            'Outcome              Passed',
                            'Tests Ran            2',
                            'Pass Rate            100%',
                            'TEST NAME',
                            'ExampleApexClass1Test.validateSayHello  Pass',
                            'ExampleApexClass2Test.validateSayHello  Pass',
                            'ended SFDX: Run Apex Tests'
                        ];
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        return [4 /*yield*/, utilities.verifyOutputPanelText(outputPanelText, expectedTexts)];
                    case 12:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vscode_extension_tester_1.after)('Tear down and clean up the testing environment', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("RunApexTests - Tear down and clean up the testing environment");
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
