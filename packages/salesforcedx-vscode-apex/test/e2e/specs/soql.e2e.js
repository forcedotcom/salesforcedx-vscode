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
var vscode_extension_tester_1 = require("vscode-extension-tester");
var testSetup_1 = require("../testSetup");
var utilities = require("../utilities/index");
describe('SOQL', function () { return __awaiter(void 0, void 0, void 0, function () {
    var testSetup, testReqConfig;
    return __generator(this, function (_a) {
        testReqConfig = {
            projectConfig: {
                projectShape: utilities.ProjectShapeOption.NEW
            },
            isOrgRequired: false,
            testSuiteSuffixName: 'SOQL'
        };
        (0, mocha_steps_1.step)('Set up the testing environment', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, testSetup_1.TestSetup.setUp(testReqConfig)];
                    case 1:
                        testSetup = _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('SFDX: Create Query in SOQL Builder', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, editorView, activeTab, title;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - SFDX: Create Query in SOQL Builder"));
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(20))];
                    case 1:
                        _a.sent();
                        // Run SFDX: Create Query in SOQL Builder
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Create Query in SOQL Builder', utilities.Duration.seconds(3))];
                    case 2:
                        // Run SFDX: Create Query in SOQL Builder
                        _a.sent();
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 3:
                        workbench = _a.sent();
                        editorView = workbench.getEditorView();
                        return [4 /*yield*/, editorView.getActiveTab()];
                    case 4:
                        activeTab = _a.sent();
                        return [4 /*yield*/, (activeTab === null || activeTab === void 0 ? void 0 : activeTab.getTitle())];
                    case 5:
                        title = _a.sent();
                        (0, chai_1.expect)(title).to.equal('untitled.soql');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Switch Between SOQL Builder and Text Editor - from SOQL Builder', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, editorView, toggleSOQLButton, activeTab, title, openTabs;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Switch Between SOQL Builder and Text Editor - from SOQL Builder"));
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 1:
                        workbench = _a.sent();
                        editorView = workbench.getEditorView();
                        return [4 /*yield*/, editorView.getAction('Switch Between SOQL Builder and Text Editor')];
                    case 2:
                        toggleSOQLButton = _a.sent();
                        (0, chai_1.expect)(toggleSOQLButton).to.not.be.undefined;
                        return [4 /*yield*/, (toggleSOQLButton === null || toggleSOQLButton === void 0 ? void 0 : toggleSOQLButton.click())];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, editorView.getActiveTab()];
                    case 4:
                        activeTab = _a.sent();
                        return [4 /*yield*/, (activeTab === null || activeTab === void 0 ? void 0 : activeTab.getTitle())];
                    case 5:
                        title = _a.sent();
                        (0, chai_1.expect)(title).to.equal('untitled.soql');
                        return [4 /*yield*/, editorView.getOpenEditorTitles()];
                    case 6:
                        openTabs = _a.sent();
                        (0, chai_1.expect)(openTabs.length).to.equal(3);
                        (0, chai_1.expect)(openTabs[1]).to.equal('untitled.soql');
                        (0, chai_1.expect)(openTabs[2]).to.equal('untitled.soql');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Switch Between SOQL Builder and Text Editor - from file', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, editorView, toggleSOQLButton;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Switch Between SOQL Builder and Text Editor - from file"));
                        return [4 /*yield*/, utilities.reloadWindow(utilities.Duration.seconds(5))];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 2:
                        workbench = _a.sent();
                        editorView = workbench.getEditorView();
                        return [4 /*yield*/, editorView.getAction('Switch Between SOQL Builder and Text Editor')];
                    case 3:
                        toggleSOQLButton = _a.sent();
                        (0, chai_1.expect)(toggleSOQLButton).to.not.be.undefined;
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.xstep)('Verify the contents of the SOQL Builder', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/];
            });
        }); });
        (0, mocha_steps_1.xstep)('Create query in SOQL Builder', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/];
            });
        }); });
        (0, mocha_steps_1.xstep)('Verify the contents of the soql file', function () { return __awaiter(void 0, void 0, void 0, function () {
            var expectedText, workbench, textEditor, textGeneratedFromTemplate;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        expectedText = ['SELECT COUNT()', 'from Account'].join('\n');
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 1:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'countAccounts.soql')];
                    case 2:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.getText()];
                    case 3:
                        textGeneratedFromTemplate = (_a.sent()).trimEnd().replace(/\r\n/g, '\n');
                        (0, chai_1.expect)(textGeneratedFromTemplate).to.be(expectedText);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vscode_extension_tester_1.after)('Tear down and clean up the testing environment', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Tear down and clean up the testing environment"));
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
