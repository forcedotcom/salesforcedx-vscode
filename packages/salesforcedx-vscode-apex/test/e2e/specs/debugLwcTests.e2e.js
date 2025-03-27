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
var assert_1 = require("assert");
var chai_1 = require("chai");
var mocha_steps_1 = require("mocha-steps");
var path_1 = require("path");
var vscode_extension_tester_1 = require("vscode-extension-tester");
var testSetup_1 = require("../testSetup");
var utilities = require("../utilities/index");
describe('Debug LWC Tests', function () { return __awaiter(void 0, void 0, void 0, function () {
    var testSetup, projectFolderPath, testReqConfig;
    return __generator(this, function (_a) {
        testReqConfig = {
            projectConfig: {
                projectShape: utilities.ProjectShapeOption.NEW
            },
            isOrgRequired: false,
            testSuiteSuffixName: 'DebugLWCTests'
        };
        (0, mocha_steps_1.step)('Set up the testing environment', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, testSetup_1.TestSetup.setUp(testReqConfig)];
                    case 1:
                        testSetup = _a.sent();
                        projectFolderPath = testSetup.projectFolderPath;
                        // Close both Welcome and Running Extensions tabs
                        return [4 /*yield*/, utilities.closeAllEditors()];
                    case 2:
                        // Close both Welcome and Running Extensions tabs
                        _a.sent();
                        // Create LWC1 and test
                        return [4 /*yield*/, utilities.createLwc('lwc1')];
                    case 3:
                        // Create LWC1 and test
                        _a.sent();
                        // Create LWC2 and test
                        return [4 /*yield*/, utilities.createLwc('lwc2')];
                    case 4:
                        // Create LWC2 and test
                        _a.sent();
                        // Install Jest unit testing tools for LWC
                        return [4 /*yield*/, utilities.installJestUTToolsForLwc(testSetup.projectFolderPath)];
                    case 5:
                        // Install Jest unit testing tools for LWC
                        _a.sent();
                        return [4 /*yield*/, utilities.reloadWindow(utilities.Duration.seconds(30))];
                    case 6:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Debug All Tests on a LWC via the Test Sidebar', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, lwcTestsSection, expectedItems, lwcTestsItems, debugTestsAction, terminalText, expectedTexts;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Debug All tests on a LWC via the Test Sidebar"));
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.executeQuickPick('Testing: Focus on LWC Tests View', utilities.Duration.seconds(3))];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, utilities.getTestsSection(workbench, 'LWC Tests')];
                    case 2:
                        lwcTestsSection = _a.sent();
                        expectedItems = ['lwc1', 'lwc2', 'displays greeting', 'is defined'];
                        return [4 /*yield*/, utilities.verifyTestItemsInSideBar(lwcTestsSection, 'SFDX: Refresh Lightning Web Component Test Explorer', expectedItems, 6, 2)];
                    case 3:
                        lwcTestsItems = _a.sent();
                        // Click the debug test button that is shown to the right when you hover a test class name on the Test sidebar
                        return [4 /*yield*/, lwcTestsItems[0].select()];
                    case 4:
                        // Click the debug test button that is shown to the right when you hover a test class name on the Test sidebar
                        _a.sent();
                        return [4 /*yield*/, lwcTestsItems[0].getActionButton('SFDX: Debug Lightning Web Component Test File')];
                    case 5:
                        debugTestsAction = _a.sent();
                        (0, chai_1.expect)(debugTestsAction).to.not.be.undefined;
                        return [4 /*yield*/, debugTestsAction.click()];
                    case 6:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(15))];
                    case 7:
                        _a.sent();
                        // Continue with the debug session
                        return [4 /*yield*/, utilities.continueDebugging(2)];
                    case 8:
                        // Continue with the debug session
                        _a.sent();
                        return [4 /*yield*/, utilities.getTerminalViewText(workbench, 10)];
                    case 9:
                        terminalText = _a.sent();
                        expectedTexts = [
                            'PASS  force-app/main/default/lwc/lwc1/__tests__/lwc1.test.js',
                            'Test Suites: 1 passed, 1 total',
                            'Tests:       2 passed, 2 total',
                            'Snapshots:   0 total',
                            'Ran all test suites within paths',
                            "".concat(path_1.default.join('force-app', 'main', 'default', 'lwc', 'lwc1', '__tests__', 'lwc1.test.js'))
                        ];
                        (0, chai_1.expect)(terminalText).to.not.be.undefined;
                        return [4 /*yield*/, utilities.verifyOutputPanelText(terminalText, expectedTexts)];
                    case 10:
                        _a.sent();
                        // Verify the tests that are passing are labeled with a green dot on the Test sidebar
                        return [4 /*yield*/, utilities.executeQuickPick('Testing: Focus on LWC Tests View', utilities.Duration.seconds(3))];
                    case 11:
                        // Verify the tests that are passing are labeled with a green dot on the Test sidebar
                        _a.sent();
                        return [4 /*yield*/, utilities.verifyTestIconColor(lwcTestsItems[0], 'testPass')];
                    case 12:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Debug Single Test via the Test Sidebar', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, testingView, testingSideBarView, lwcTestsSection, lwcTestItem, debugTestAction, terminalText, expectedTexts;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Debug Single Test via the Test Sidebar"));
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, workbench.getActivityBar().getViewControl('Testing')];
                    case 1:
                        testingView = _a.sent();
                        (0, chai_1.expect)(testingView).to.not.be.undefined;
                        return [4 /*yield*/, (testingView === null || testingView === void 0 ? void 0 : testingView.openView())];
                    case 2:
                        testingSideBarView = _a.sent();
                        (0, chai_1.expect)(testingSideBarView).to.be.instanceOf(vscode_extension_tester_1.SideBarView);
                        return [4 /*yield*/, utilities.getTestsSection(workbench, 'LWC Tests')];
                    case 3:
                        lwcTestsSection = _a.sent();
                        return [4 /*yield*/, lwcTestsSection.findItem('displays greeting')];
                    case 4:
                        lwcTestItem = (_a.sent());
                        return [4 /*yield*/, lwcTestItem.select()];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, lwcTestItem.getActionButton('SFDX: Debug Lightning Web Component Test Case')];
                    case 6:
                        debugTestAction = _a.sent();
                        (0, chai_1.expect)(debugTestAction).to.not.be.undefined;
                        return [4 /*yield*/, debugTestAction.click()];
                    case 7:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(15))];
                    case 8:
                        _a.sent();
                        // Continue with the debug session
                        return [4 /*yield*/, utilities.continueDebugging(1)];
                    case 9:
                        // Continue with the debug session
                        _a.sent();
                        return [4 /*yield*/, utilities.getTerminalViewText(workbench, 10)];
                    case 10:
                        terminalText = _a.sent();
                        expectedTexts = [
                            'PASS  force-app/main/default/lwc/lwc1/__tests__/lwc1.test.js',
                            'Test Suites: 1 passed, 1 total',
                            'Tests:       1 skipped, 1 passed, 2 total',
                            'Snapshots:   0 total',
                            'Ran all test suites within paths',
                            "".concat(path_1.default.join('force-app', 'main', 'default', 'lwc', 'lwc1', '__tests__', 'lwc1.test.js'))
                        ];
                        (0, chai_1.expect)(terminalText).to.not.be.undefined;
                        return [4 /*yield*/, utilities.verifyOutputPanelText(terminalText, expectedTexts)];
                    case 11:
                        _a.sent();
                        // Verify the tests that are passing are labeled with a green dot on the Test sidebar
                        return [4 /*yield*/, utilities.runCommandFromCommandPrompt(workbench, 'Testing: Focus on LWC Tests View', utilities.Duration.seconds(3))];
                    case 12:
                        // Verify the tests that are passing are labeled with a green dot on the Test sidebar
                        _a.sent();
                        return [4 /*yield*/, utilities.verifyTestIconColor(lwcTestItem, 'testPass')];
                    case 13:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('SFDX: Debug Current Lightning Web Component Test File from Command Palette', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, terminalText, expectedTexts;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - SFDX: Debug Current Lightning Web Component Test File from Command Palette"));
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Debug Current Lightning Web Component Test File', utilities.Duration.seconds(15))];
                    case 1:
                        _a.sent();
                        // Continue with the debug session
                        return [4 /*yield*/, utilities.continueDebugging(2)];
                    case 2:
                        // Continue with the debug session
                        _a.sent();
                        return [4 /*yield*/, utilities.getTerminalViewText(workbench, 10)];
                    case 3:
                        terminalText = _a.sent();
                        expectedTexts = [
                            'PASS  force-app/main/default/lwc/lwc1/__tests__/lwc1.test.js',
                            'Test Suites: 1 passed, 1 total',
                            'Tests:       2 passed, 2 total',
                            'Snapshots:   0 total',
                            'Ran all test suites within paths',
                            "".concat(path_1.default.join('force-app', 'main', 'default', 'lwc', 'lwc1', '__tests__', 'lwc1.test.js'))
                        ];
                        (0, chai_1.expect)(terminalText).to.not.be.undefined;
                        return [4 /*yield*/, utilities.verifyOutputPanelText(terminalText, expectedTexts)];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.xstep)('Debug All Tests via Code Lens action', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, textEditor, debugAllTestsOption, terminalText, expectedTexts;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'lwc1.test.js')];
                    case 1:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.getCodeLens('Debug')];
                    case 2:
                        debugAllTestsOption = _a.sent();
                        if (!debugAllTestsOption) {
                            (0, assert_1.fail)('Could not find debug test action button');
                        }
                        return [4 /*yield*/, debugAllTestsOption.click()];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(15))];
                    case 4:
                        _a.sent();
                        // Continue with the debug session
                        return [4 /*yield*/, utilities.continueDebugging(2)];
                    case 5:
                        // Continue with the debug session
                        _a.sent();
                        return [4 /*yield*/, utilities.getTerminalViewText(workbench, 10)];
                    case 6:
                        terminalText = _a.sent();
                        expectedTexts = [
                            'PASS  force-app/main/default/lwc/lwc1/__tests__/lwc1.test.js',
                            'Test Suites: 1 passed, 1 total',
                            'Tests:       2 passed, 2 total',
                            'Snapshots:   0 total',
                            'Ran all test suites within paths',
                            "".concat(path_1.default.join('force-app', 'main', 'default', 'lwc', 'lwc1', '__tests__', 'lwc1.test.js'))
                        ];
                        (0, chai_1.expect)(terminalText).to.not.be.undefined;
                        return [4 /*yield*/, utilities.verifyOutputPanelText(terminalText, expectedTexts)];
                    case 7:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Debug Single Test via Code Lens action', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, textEditor, debugTestOption, terminalText, expectedTexts;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Debug Single Test via Code Lens action"));
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'lwc2.test.js')];
                    case 1:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.getCodeLens('Debug Test')];
                    case 2:
                        debugTestOption = _a.sent();
                        if (!debugTestOption) {
                            (0, assert_1.fail)('Could not find debug test action button');
                        }
                        return [4 /*yield*/, debugTestOption.click()];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(15))];
                    case 4:
                        _a.sent();
                        // Continue with the debug session
                        return [4 /*yield*/, utilities.continueDebugging(1)];
                    case 5:
                        // Continue with the debug session
                        _a.sent();
                        return [4 /*yield*/, utilities.getTerminalViewText(workbench, 10)];
                    case 6:
                        terminalText = _a.sent();
                        expectedTexts = [
                            'PASS  force-app/main/default/lwc/lwc2/__tests__/lwc2.test.js',
                            'Test Suites: 1 passed, 1 total',
                            'Tests:       1 skipped, 1 passed, 2 total',
                            'Snapshots:   0 total',
                            'Ran all test suites within paths',
                            "".concat(path_1.default.join('force-app', 'main', 'default', 'lwc', 'lwc2', '__tests__', 'lwc2.test.js'))
                        ];
                        (0, chai_1.expect)(terminalText).to.not.be.undefined;
                        return [4 /*yield*/, utilities.verifyOutputPanelText(terminalText, expectedTexts)];
                    case 7:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('SFDX: Debug Current Lightning Web Component Test File from main toolbar', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, editorView, debugTestButtonToolbar, terminalText, expectedTexts;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - SFDX: Debug Current Lightning Web Component Test File from main toolbar"));
                        workbench = utilities.getWorkbench();
                        editorView = workbench.getEditorView();
                        return [4 /*yield*/, editorView.getAction('SFDX: Debug Current Lightning Web Component Test File')];
                    case 1:
                        debugTestButtonToolbar = _a.sent();
                        (0, chai_1.expect)(debugTestButtonToolbar).to.not.be.undefined;
                        return [4 /*yield*/, (debugTestButtonToolbar === null || debugTestButtonToolbar === void 0 ? void 0 : debugTestButtonToolbar.click())];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(15))];
                    case 3:
                        _a.sent();
                        // Continue with the debug session
                        return [4 /*yield*/, utilities.continueDebugging(2)];
                    case 4:
                        // Continue with the debug session
                        _a.sent();
                        return [4 /*yield*/, utilities.getTerminalViewText(workbench, 10)];
                    case 5:
                        terminalText = _a.sent();
                        expectedTexts = [
                            'PASS  force-app/main/default/lwc/lwc2/__tests__/lwc2.test.js',
                            'Test Suites: 1 passed, 1 total',
                            'Tests:       2 passed, 2 total',
                            'Snapshots:   0 total',
                            'Ran all test suites within paths',
                            "".concat(path_1.default.join('force-app', 'main', 'default', 'lwc', 'lwc2', '__tests__', 'lwc2.test.js'))
                        ];
                        (0, chai_1.expect)(terminalText).to.not.be.undefined;
                        return [4 /*yield*/, utilities.verifyOutputPanelText(terminalText, expectedTexts)];
                    case 6:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vscode_extension_tester_1.after)('Tear down and clean up the testing environment', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (testSetup === null || testSetup === void 0 ? void 0 : testSetup.tearDown())];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        return [2 /*return*/];
    });
}); });
