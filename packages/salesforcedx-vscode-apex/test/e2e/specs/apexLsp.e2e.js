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
var testSetup_1 = require("../testSetup");
var utilities = require("../utilities/index");
var environmentSettings_1 = require("../environmentSettings");
var vscode_extension_tester_1 = require("vscode-extension-tester");
var mocha_steps_1 = require("mocha-steps");
var chai_1 = require("chai");
describe('Apex LSP', function () { return __awaiter(void 0, void 0, void 0, function () {
    var testSetup, testReqConfig;
    return __generator(this, function (_a) {
        testReqConfig = {
            projectConfig: {
                projectShape: utilities.ProjectShapeOption.NEW
            },
            isOrgRequired: false,
            testSuiteSuffixName: 'ApexLsp'
        };
        (0, mocha_steps_1.step)('Set up the testing environment', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log('ApexLsp - Set up the testing environment');
                        utilities.log("ApexLsp - JAVA_HOME: ".concat(environmentSettings_1.EnvironmentSettings.getInstance().javaHome));
                        return [4 /*yield*/, testSetup_1.TestSetup.setUp(testReqConfig)];
                    case 1:
                        testSetup = _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(10))];
                    case 2:
                        _a.sent();
                        // Create Apex Class
                        return [4 /*yield*/, utilities.createApexClassWithTest('ExampleClass')];
                    case 3:
                        // Create Apex Class
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Verify LSP finished indexing', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, statusBar, _a, outputViewText;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Verify LSP finished indexing"));
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 1:
                        workbench = _b.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'ExampleClass.cls')];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, utilities.getStatusBarItemWhichIncludes('Editor Language Status')];
                    case 3:
                        statusBar = _b.sent();
                        return [4 /*yield*/, statusBar.click()];
                    case 4:
                        _b.sent();
                        _a = chai_1.expect;
                        return [4 /*yield*/, statusBar.getAttribute('aria-label')];
                    case 5:
                        _a.apply(void 0, [_b.sent()]).to.include('Indexing complete');
                        return [4 /*yield*/, utilities.getOutputViewText('Apex Language Server')];
                    case 6:
                        outputViewText = _b.sent();
                        utilities.log('Output view text');
                        utilities.log(outputViewText);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Go to Definition', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, textEditor, editorView, activeTab, title;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Go to Definition"));
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'ExampleClassTest.cls')];
                    case 1:
                        textEditor = _a.sent();
                        // Move cursor to the middle of "ExampleClass.SayHello() call"
                        return [4 /*yield*/, textEditor.moveCursor(6, 20)];
                    case 2:
                        // Move cursor to the middle of "ExampleClass.SayHello() call"
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(1))];
                    case 3:
                        _a.sent();
                        // Go to definition through F12
                        return [4 /*yield*/, utilities.executeQuickPick('Go to Definition', utilities.Duration.seconds(2))];
                    case 4:
                        // Go to definition through F12
                        _a.sent();
                        editorView = workbench.getEditorView();
                        return [4 /*yield*/, editorView.getActiveTab()];
                    case 5:
                        activeTab = _a.sent();
                        return [4 /*yield*/, (activeTab === null || activeTab === void 0 ? void 0 : activeTab.getTitle())];
                    case 6:
                        title = _a.sent();
                        (0, chai_1.expect)(title).to.equal('ExampleClass.cls');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Autocompletion', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, textEditor, autocompletionOptions, ariaLabel, line7Text;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Autocompletion"));
                        return [4 /*yield*/, utilities.getWorkbench().wait()];
                    case 1:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'ExampleClassTest.cls')];
                    case 2:
                        textEditor = _a.sent();
                        // Move cursor to line 7 and type ExampleClass.say
                        return [4 /*yield*/, textEditor.typeTextAt(7, 1, '\tExampleClass.say')];
                    case 3:
                        // Move cursor to line 7 and type ExampleClass.say
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(1))];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, workbench.findElements(vscode_extension_tester_1.By.css('div.monaco-list-row.show-file-icons'))];
                    case 5:
                        autocompletionOptions = _a.sent();
                        return [4 /*yield*/, autocompletionOptions[0].getAttribute('aria-label')];
                    case 6:
                        ariaLabel = _a.sent();
                        (0, chai_1.expect)(ariaLabel).to.contain('SayHello(name)');
                        return [4 /*yield*/, autocompletionOptions[0].click()];
                    case 7:
                        _a.sent();
                        // Verify autocompletion options can be selected and therefore automatically inserted into the file
                        return [4 /*yield*/, textEditor.typeText("'Jack")];
                    case 8:
                        // Verify autocompletion options can be selected and therefore automatically inserted into the file
                        _a.sent();
                        return [4 /*yield*/, textEditor.typeTextAt(7, 38, ';')];
                    case 9:
                        _a.sent();
                        return [4 /*yield*/, textEditor.save()];
                    case 10:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(1))];
                    case 11:
                        _a.sent();
                        return [4 /*yield*/, textEditor.getTextAtLine(7)];
                    case 12:
                        line7Text = _a.sent();
                        (0, chai_1.expect)(line7Text).to.include("ExampleClass.SayHello('Jack');");
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
