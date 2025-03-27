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
describe('Run LWC Tests', function () { return __awaiter(void 0, void 0, void 0, function () {
    var projectFolderPath, testSetup, testReqConfig;
    return __generator(this, function (_a) {
        testReqConfig = {
            projectConfig: {
                projectShape: utilities.ProjectShapeOption.NEW
            },
            isOrgRequired: false,
            testSuiteSuffixName: 'RunLWCTests'
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
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('SFDX: Run All Lightning Web Component Tests from Command Palette', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, terminalText, expectedTexts;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - SFDX: Run All Lightning Web Component Tests from Command Palette"));
                        // Run SFDX: Run All Lightning Web Component Tests.
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Run All Lightning Web Component Tests', utilities.Duration.seconds(1))];
                    case 1:
                        // Run SFDX: Run All Lightning Web Component Tests.
                        _a.sent();
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.getTerminalViewText(workbench, 10)];
                    case 2:
                        terminalText = _a.sent();
                        expectedTexts = [
                            'PASS  force-app/main/default/lwc/lwc1/__tests__/lwc1.test.js',
                            'PASS  force-app/main/default/lwc/lwc2/__tests__/lwc2.test.js',
                            'Test Suites: 2 passed, 2 total',
                            'Tests:       4 passed, 4 total',
                            'Snapshots:   0 total',
                            'Ran all test suites.'
                        ];
                        (0, chai_1.expect)(terminalText).to.not.be.undefined;
                        return [4 /*yield*/, utilities.verifyOutputPanelText(terminalText, expectedTexts)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('SFDX: Refresh Lightning Web Component Test Explorer', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, lwcTestsSection, lwcTestsItems, _i, lwcTestsItems_1, item, _a, lwcTestsItems_2, item;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - SFDX: Refresh Lightning Web Component Test Explorer"));
                        return [4 /*yield*/, utilities.executeQuickPick('Testing: Focus on LWC Tests View', utilities.Duration.seconds(1))];
                    case 1:
                        _b.sent();
                        // Run command SFDX: Refresh Lightning Web Component Test Explorer
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Refresh Lightning Web Component Test Explorer', utilities.Duration.seconds(2))];
                    case 2:
                        // Run command SFDX: Refresh Lightning Web Component Test Explorer
                        _b.sent();
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.getTestsSection(workbench, 'LWC Tests')];
                    case 3:
                        lwcTestsSection = _b.sent();
                        return [4 /*yield*/, lwcTestsSection.getVisibleItems()];
                    case 4:
                        lwcTestsItems = (_b.sent());
                        // Run command SFDX: Run All Lightning Web Component Tests
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Run All Lightning Web Component Tests', utilities.Duration.seconds(2))];
                    case 5:
                        // Run command SFDX: Run All Lightning Web Component Tests
                        _b.sent();
                        return [4 /*yield*/, lwcTestsSection.getVisibleItems()];
                    case 6:
                        // Get tree items again
                        lwcTestsItems = (_b.sent());
                        _i = 0, lwcTestsItems_1 = lwcTestsItems;
                        _b.label = 7;
                    case 7:
                        if (!(_i < lwcTestsItems_1.length)) return [3 /*break*/, 10];
                        item = lwcTestsItems_1[_i];
                        return [4 /*yield*/, utilities.verifyTestIconColor(item, 'testPass')];
                    case 8:
                        _b.sent();
                        _b.label = 9;
                    case 9:
                        _i++;
                        return [3 /*break*/, 7];
                    case 10: 
                    // Run command SFDX: Refresh Lightning Web Component Test Explorer again to reset status
                    return [4 /*yield*/, utilities.executeQuickPick('SFDX: Refresh Lightning Web Component Test Explorer', utilities.Duration.seconds(2))];
                    case 11:
                        // Run command SFDX: Refresh Lightning Web Component Test Explorer again to reset status
                        _b.sent();
                        return [4 /*yield*/, lwcTestsSection.getVisibleItems()];
                    case 12:
                        // Get tree items again
                        lwcTestsItems = (_b.sent());
                        _a = 0, lwcTestsItems_2 = lwcTestsItems;
                        _b.label = 13;
                    case 13:
                        if (!(_a < lwcTestsItems_2.length)) return [3 /*break*/, 16];
                        item = lwcTestsItems_2[_a];
                        return [4 /*yield*/, utilities.verifyTestIconColor(item, 'testNotRun')];
                    case 14:
                        _b.sent();
                        _b.label = 15;
                    case 15:
                        _a++;
                        return [3 /*break*/, 13];
                    case 16: return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Run All tests via Test Sidebar', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, lwcTestsSection, expectedItems, lwcTestsItems, runTestsAction, terminalText, expectedTexts, _i, lwcTestsItems_3, item;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Run All tests via Test Sidebar"));
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.getTestsSection(workbench, 'LWC Tests')];
                    case 1:
                        lwcTestsSection = _a.sent();
                        expectedItems = ['lwc1', 'lwc2', 'displays greeting', 'is defined'];
                        return [4 /*yield*/, utilities.verifyTestItemsInSideBar(lwcTestsSection, 'SFDX: Refresh Lightning Web Component Test Explorer', expectedItems, 6, 2)];
                    case 2:
                        lwcTestsItems = _a.sent();
                        // Click the run tests button on the top right corner of the Test sidebar
                        return [4 /*yield*/, lwcTestsSection.click()];
                    case 3:
                        // Click the run tests button on the top right corner of the Test sidebar
                        _a.sent();
                        return [4 /*yield*/, lwcTestsSection.getAction('SFDX: Run All Lightning Web Component Tests')];
                    case 4:
                        runTestsAction = _a.sent();
                        (0, chai_1.expect)(runTestsAction).to.not.be.undefined;
                        return [4 /*yield*/, runTestsAction.click()];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, utilities.getTerminalViewText(workbench, 10)];
                    case 6:
                        terminalText = _a.sent();
                        expectedTexts = [
                            'PASS  force-app/main/default/lwc/lwc1/__tests__/lwc1.test.js',
                            'PASS  force-app/main/default/lwc/lwc2/__tests__/lwc2.test.js',
                            'Test Suites: 2 passed, 2 total',
                            'Tests:       4 passed, 4 total',
                            'Snapshots:   0 total',
                            'Ran all test suites.'
                        ];
                        (0, chai_1.expect)(terminalText).to.not.be.undefined;
                        return [4 /*yield*/, utilities.verifyOutputPanelText(terminalText, expectedTexts)];
                    case 7:
                        _a.sent();
                        _i = 0, lwcTestsItems_3 = lwcTestsItems;
                        _a.label = 8;
                    case 8:
                        if (!(_i < lwcTestsItems_3.length)) return [3 /*break*/, 11];
                        item = lwcTestsItems_3[_i];
                        return [4 /*yield*/, utilities.verifyTestIconColor(item, 'testPass')];
                    case 9:
                        _a.sent();
                        _a.label = 10;
                    case 10:
                        _i++;
                        return [3 /*break*/, 8];
                    case 11: return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Run All Tests on a LWC via the Test Sidebar', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, terminalText, expectedTexts;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Run All Tests on a LWC via the Test Sidebar"));
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.runTestCaseFromSideBar(workbench, 'LWC Tests', 'lwc1', 'SFDX: Run Lightning Web Component Test File')];
                    case 1:
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
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, utilities.closeAllEditors()];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Run Single Test via the Test Sidebar', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, terminalText, expectedTexts;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Run Single Test via the Test Sidebar"));
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.runTestCaseFromSideBar(workbench, 'LWC Tests', 'displays greeting', 'SFDX: Run Lightning Web Component Test Case')];
                    case 1:
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
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('SFDX: Navigate to Lightning Web Component Test', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, editorView, activeTab, title;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: 
                    // Verify that having clicked the test case took us to the test file.
                    return [4 /*yield*/, utilities.reloadWindow()];
                    case 1:
                        // Verify that having clicked the test case took us to the test file.
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(10))];
                    case 2:
                        _a.sent();
                        workbench = utilities.getWorkbench();
                        editorView = workbench.getEditorView();
                        return [4 /*yield*/, editorView.getActiveTab()];
                    case 3:
                        activeTab = _a.sent();
                        return [4 /*yield*/, (activeTab === null || activeTab === void 0 ? void 0 : activeTab.getTitle())];
                    case 4:
                        title = _a.sent();
                        (0, chai_1.expect)(title).to.equal('lwc1.test.js');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('SFDX: Run Current Lightning Web Component Test File from Command Palette', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, terminalText, expectedTexts;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - SFDX: Run Current Lightning Web Component Test File"));
                        // Run SFDX: Run Current Lightning Web Component Test File
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Run Current Lightning Web Component Test File', utilities.Duration.seconds(1))];
                    case 1:
                        // Run SFDX: Run Current Lightning Web Component Test File
                        _a.sent();
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.getTerminalViewText(workbench, 10)];
                    case 2:
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
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.xstep)('Run All Tests via Code Lens action', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, textEditor, runAllTestsOption, terminalText, expectedTexts;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Skipping as this feature is currently not working
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Run All Tests via Code Lens action"));
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'lwc1.test.js')];
                    case 1:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.getCodeLens('Run')];
                    case 2:
                        runAllTestsOption = _a.sent();
                        if (!runAllTestsOption) {
                            (0, assert_1.fail)('Could not find run all tests action button');
                        }
                        return [4 /*yield*/, runAllTestsOption.click()];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, utilities.getTerminalViewText(workbench, 10)];
                    case 4:
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
                    case 5:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Run Single Test via Code Lens action', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, textEditor, runTestOption, terminalText, expectedTexts;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Run Single Test via Code Lens action"));
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'lwc2.test.js')];
                    case 1:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.getCodeLens('Run Test')];
                    case 2:
                        runTestOption = _a.sent();
                        if (!runTestOption) {
                            (0, assert_1.fail)('Could not find run test action button');
                        }
                        return [4 /*yield*/, runTestOption.click()];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, utilities.getTerminalViewText(workbench, 10)];
                    case 4:
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
                    case 5:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('SFDX: Run Current Lightning Web Component Test File from main toolbar', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, editorView, runTestButtonToolbar, terminalText, expectedTexts;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - SFDX: Run Current Lightning Web Component Test File from main toolbar"));
                        workbench = utilities.getWorkbench();
                        editorView = workbench.getEditorView();
                        return [4 /*yield*/, editorView.getAction('SFDX: Run Current Lightning Web Component Test File')];
                    case 1:
                        runTestButtonToolbar = _a.sent();
                        (0, chai_1.expect)(runTestButtonToolbar).to.not.be.undefined;
                        return [4 /*yield*/, (runTestButtonToolbar === null || runTestButtonToolbar === void 0 ? void 0 : runTestButtonToolbar.click())];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, utilities.getTerminalViewText(workbench, 10)];
                    case 3:
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
                    case 4:
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
