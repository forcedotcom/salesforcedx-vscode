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
var chai_1 = require("chai");
var mocha_steps_1 = require("mocha-steps");
var vscode_extension_tester_1 = require("vscode-extension-tester");
var testSetup_1 = require("../testSetup");
var utilities = require("../utilities/index");
describe('LWC LSP', function () { return __awaiter(void 0, void 0, void 0, function () {
    var testSetup, testReqConfig;
    return __generator(this, function (_a) {
        testReqConfig = {
            projectConfig: {
                projectShape: utilities.ProjectShapeOption.NEW
            },
            isOrgRequired: false,
            testSuiteSuffixName: 'LwcLsp'
        };
        (0, mocha_steps_1.step)('Set up the testing environment', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log('LwcLsp - Set up the testing environment');
                        return [4 /*yield*/, testSetup_1.TestSetup.setUp(testReqConfig)];
                    case 1:
                        testSetup = _a.sent();
                        // Create Lightning Web Component
                        return [4 /*yield*/, utilities.createLwc('lwc1')];
                    case 2:
                        // Create Lightning Web Component
                        _a.sent();
                        // Reload the VSCode window to allow the LWC to be indexed by the LWC Language Server
                        return [4 /*yield*/, utilities.reloadWindow(utilities.Duration.seconds(20))];
                    case 3:
                        // Reload the VSCode window to allow the LWC to be indexed by the LWC Language Server
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Go to Definition (JavaScript)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, textEditor, editorView, activeTab, title;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Go to Definition (Javascript)"));
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 1:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'lwc1.js')];
                    case 2:
                        textEditor = _a.sent();
                        // Move cursor to the middle of "LightningElement"
                        return [4 /*yield*/, textEditor.moveCursor(3, 40)];
                    case 3:
                        // Move cursor to the middle of "LightningElement"
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
                        (0, chai_1.expect)(title).to.equal('engine.d.ts');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Go to Definition (HTML)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, textEditor, editorView, activeTab, title;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(process.platform !== 'win32')) return [3 /*break*/, 7];
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Go to Definition (HTML)"));
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 1:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'lwc1.html')];
                    case 2:
                        textEditor = _a.sent();
                        // Move cursor to the middle of "greeting"
                        return [4 /*yield*/, textEditor.moveCursor(3, 58)];
                    case 3:
                        // Move cursor to the middle of "greeting"
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
                        (0, chai_1.expect)(title).to.equal('lwc1.js');
                        _a.label = 7;
                    case 7: return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Autocompletion', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, textEditor, autocompletionOptions, ariaLabel, line5Text;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Autocompletion"));
                        return [4 /*yield*/, utilities.getWorkbench().wait()];
                    case 1:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'lwc1.html')];
                    case 2:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.typeTextAt(5, 1, '<lightnin')];
                    case 3:
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
                        (0, chai_1.expect)(ariaLabel).to.contain('lightning-accordion');
                        // Verify autocompletion options can be selected and therefore automatically inserted into the file
                        return [4 /*yield*/, autocompletionOptions[0].click()];
                    case 7:
                        // Verify autocompletion options can be selected and therefore automatically inserted into the file
                        _a.sent();
                        return [4 /*yield*/, textEditor.typeText('>')];
                    case 8:
                        _a.sent();
                        return [4 /*yield*/, textEditor.save()];
                    case 9:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(1))];
                    case 10:
                        _a.sent();
                        return [4 /*yield*/, textEditor.getTextAtLine(5)];
                    case 11:
                        line5Text = _a.sent();
                        (0, chai_1.expect)(line5Text).to.contain('lightning-accordion');
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
