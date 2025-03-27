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
var testSetup_1 = require("../testSetup");
var utilities = require("../utilities/index");
var vscode_extension_tester_1 = require("vscode-extension-tester");
var chai_1 = require("chai");
describe('Debug Apex Tests', function () { return __awaiter(void 0, void 0, void 0, function () {
    var testSetup, testReqConfig;
    return __generator(this, function (_a) {
        testReqConfig = {
            projectConfig: {
                projectShape: utilities.ProjectShapeOption.NEW
            },
            isOrgRequired: true,
            testSuiteSuffixName: 'DebugApexTests'
        };
        (0, mocha_steps_1.step)('Set up the testing environment', function () { return __awaiter(void 0, void 0, void 0, function () {
            var error_1, error_2, successPushNotificationWasFound, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("DebugApexTests - Set up the testing environment");
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
                    // Push source to org
                    return [4 /*yield*/, utilities.executeQuickPick('SFDX: Push Source to Default Org and Ignore Conflicts', utilities.Duration.seconds(1))];
                    case 11:
                        // Push source to org
                        _a.sent();
                        _a.label = 12;
                    case 12:
                        _a.trys.push([12, 14, , 17]);
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Push Source to Default Org and Ignore Conflicts successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 13:
                        successPushNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successPushNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 17];
                    case 14:
                        error_3 = _a.sent();
                        return [4 /*yield*/, utilities.getWorkbench().openNotificationsCenter()];
                    case 15:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Push Source to Default Org and Ignore Conflicts successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 16:
                        successPushNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successPushNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 17];
                    case 17: return [2 /*return*/];
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
        (0, mocha_steps_1.step)('Debug All Tests via Apex Class', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, textEditor, debugAllTestsOption, successNotificationWasFound, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("DebugApexTests - Debug All Tests via Apex Class");
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'ExampleApexClass1Test.cls')];
                    case 1:
                        textEditor = _a.sent();
                        // Clear the Output view.
                        return [4 /*yield*/, utilities.dismissAllNotifications()];
                    case 2:
                        // Clear the Output view.
                        _a.sent();
                        return [4 /*yield*/, textEditor.getCodeLens('Debug All Tests')];
                    case 3:
                        debugAllTestsOption = _a.sent();
                        return [4 /*yield*/, debugAllTestsOption.click()];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(20))];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6:
                        _a.trys.push([6, 8, , 11]);
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('Debug Test(s) successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 7:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 11];
                    case 8:
                        error_4 = _a.sent();
                        return [4 /*yield*/, workbench.openNotificationsCenter()];
                    case 9:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('Debug Test(s) successfully ran', utilities.Duration.ONE_MINUTE)];
                    case 10:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 11];
                    case 11: 
                    // Continue with the debug session
                    return [4 /*yield*/, utilities.continueDebugging(2, 30)];
                    case 12:
                        // Continue with the debug session
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Debug Single Test via Apex Class', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, textEditor, debugTestOption, successNotificationWasFound, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("DebugApexTests - Debug Single Test via Apex Class");
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'ExampleApexClass2Test.cls')];
                    case 1:
                        textEditor = _a.sent();
                        // Clear the Output view.
                        return [4 /*yield*/, utilities.dismissAllNotifications()];
                    case 2:
                        // Clear the Output view.
                        _a.sent();
                        return [4 /*yield*/, textEditor.getCodeLens('Debug Test')];
                    case 3:
                        debugTestOption = _a.sent();
                        return [4 /*yield*/, debugTestOption.click()];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(20))];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6:
                        _a.trys.push([6, 8, , 11]);
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('Debug Test(s) successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 7:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 11];
                    case 8:
                        error_5 = _a.sent();
                        return [4 /*yield*/, workbench.openNotificationsCenter()];
                    case 9:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('Debug Test(s) successfully ran', utilities.Duration.ONE_MINUTE)];
                    case 10:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 11];
                    case 11: 
                    // Continue with the debug session
                    return [4 /*yield*/, utilities.continueDebugging(2, 30)];
                    case 12:
                        // Continue with the debug session
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Debug all Apex Methods on a Class via the Test Sidebar', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, apexTestsSection, expectedItems, apexTestItem, debugTestsAction, successNotificationWasFound, error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("DebugApexTests - Debug All Apex Methods on a Class via the Test Sidebar");
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.executeQuickPick('Testing: Focus on Apex Tests View', utilities.Duration.seconds(1))];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, utilities.getTestsSection(workbench, 'Apex Tests')];
                    case 2:
                        apexTestsSection = _a.sent();
                        expectedItems = ['ExampleApexClass1Test', 'ExampleApexClass2Test'];
                        return [4 /*yield*/, utilities.verifyTestItemsInSideBar(apexTestsSection, 'Refresh Tests', expectedItems, 4, 2)];
                    case 3:
                        _a.sent();
                        // Click the debug tests button that is shown to the right when you hover a test class name on the Test sidebar
                        return [4 /*yield*/, apexTestsSection.click()];
                    case 4:
                        // Click the debug tests button that is shown to the right when you hover a test class name on the Test sidebar
                        _a.sent();
                        return [4 /*yield*/, apexTestsSection.findItem('ExampleApexClass1Test')];
                    case 5:
                        apexTestItem = (_a.sent());
                        return [4 /*yield*/, apexTestItem.select()];
                    case 6:
                        _a.sent();
                        return [4 /*yield*/, apexTestItem.getActionButton('Debug Tests')];
                    case 7:
                        debugTestsAction = _a.sent();
                        (0, chai_1.expect)(debugTestsAction).to.not.be.undefined;
                        return [4 /*yield*/, (debugTestsAction === null || debugTestsAction === void 0 ? void 0 : debugTestsAction.click())];
                    case 8:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(20))];
                    case 9:
                        _a.sent();
                        _a.label = 10;
                    case 10:
                        _a.trys.push([10, 12, , 15]);
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('Debug Test(s) successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 11:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 15];
                    case 12:
                        error_6 = _a.sent();
                        return [4 /*yield*/, workbench.openNotificationsCenter()];
                    case 13:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('Debug Test(s) successfully ran', utilities.Duration.ONE_MINUTE)];
                    case 14:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 15];
                    case 15: 
                    // Continue with the debug session
                    return [4 /*yield*/, utilities.continueDebugging(2, 30)];
                    case 16:
                        // Continue with the debug session
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Debug a Single Apex Test Method via the Test Sidebar', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, apexTestsSection, apexTestItem, debugTestAction, successNotificationWasFound, error_7;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("DebugApexTests - 'Debug Single Apex Test Method via the Test Sidebar");
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.executeQuickPick('Testing: Focus on Apex Tests View', utilities.Duration.seconds(1))];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, utilities.getTestsSection(workbench, 'Apex Tests')];
                    case 2:
                        apexTestsSection = _a.sent();
                        // Hover a test name under one of the test class sections and click the debug button that is shown to the right of the test name on the Test sidebar
                        return [4 /*yield*/, apexTestsSection.click()];
                    case 3:
                        // Hover a test name under one of the test class sections and click the debug button that is shown to the right of the test name on the Test sidebar
                        _a.sent();
                        return [4 /*yield*/, apexTestsSection.findItem('validateSayHello')];
                    case 4:
                        apexTestItem = (_a.sent());
                        return [4 /*yield*/, apexTestItem.select()];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, apexTestItem.getActionButton('Debug Single Test')];
                    case 6:
                        debugTestAction = _a.sent();
                        (0, chai_1.expect)(debugTestAction).to.not.be.undefined;
                        return [4 /*yield*/, (debugTestAction === null || debugTestAction === void 0 ? void 0 : debugTestAction.click())];
                    case 7:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(20))];
                    case 8:
                        _a.sent();
                        _a.label = 9;
                    case 9:
                        _a.trys.push([9, 11, , 14]);
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('Debug Test(s) successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 10:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 14];
                    case 11:
                        error_7 = _a.sent();
                        return [4 /*yield*/, workbench.openNotificationsCenter()];
                    case 12:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('Debug Test(s) successfully ran', utilities.Duration.ONE_MINUTE)];
                    case 13:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [3 /*break*/, 14];
                    case 14: 
                    // Continue with the debug session
                    return [4 /*yield*/, utilities.continueDebugging(2, 30)];
                    case 15:
                        // Continue with the debug session
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vscode_extension_tester_1.after)('Tear down and clean up the testing environment', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("DebugApexTests - Tear down and clean up the testing environment");
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
