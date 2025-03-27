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
describe('Miscellaneous', function () { return __awaiter(void 0, void 0, void 0, function () {
    var testSetup, testReqConfig;
    return __generator(this, function (_a) {
        testReqConfig = {
            projectConfig: {
                projectShape: utilities.ProjectShapeOption.NEW
            },
            isOrgRequired: false,
            testSuiteSuffixName: 'Miscellaneous'
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
        (0, mocha_steps_1.xstep)('Use out-of-the-box Apex Snippets', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, apexSnippet, textEditor, inputBox, fileContent;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Use Apex Snippets"));
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 1:
                        workbench = _a.sent();
                        apexSnippet = 'String.isBlank(inputString)';
                        // Create anonymous apex file
                        return [4 /*yield*/, utilities.createAnonymousApexFile()];
                    case 2:
                        // Create anonymous apex file
                        _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'Anonymous.apex')];
                    case 3:
                        textEditor = _a.sent();
                        return [4 /*yield*/, utilities.executeQuickPick('Snippets: Insert Snippet', utilities.Duration.seconds(1))];
                    case 4:
                        inputBox = _a.sent();
                        return [4 /*yield*/, inputBox.setText('isb')];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(1))];
                    case 6:
                        _a.sent();
                        return [4 /*yield*/, inputBox.confirm()];
                    case 7:
                        _a.sent();
                        return [4 /*yield*/, textEditor.save()];
                    case 8:
                        _a.sent();
                        return [4 /*yield*/, textEditor.getText()];
                    case 9:
                        fileContent = _a.sent();
                        return [4 /*yield*/, (0, chai_1.expect)(fileContent).to.contain(apexSnippet)];
                    case 10:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Use Custom Apex Snippets', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, textEditor, autocompletionOptions, ariaLabel, fileContent;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Use Apex Snippets"));
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 1:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.createGlobalSnippetsFile(testSetup)];
                    case 2:
                        _a.sent();
                        // Create anonymous apex file
                        return [4 /*yield*/, utilities.createAnonymousApexFile()];
                    case 3:
                        // Create anonymous apex file
                        _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'Anonymous.apex')];
                    case 4:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.typeText('soql')];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(1))];
                    case 6:
                        _a.sent();
                        return [4 /*yield*/, workbench.findElements(vscode_extension_tester_1.By.css('div.monaco-list-row.show-file-icons'))];
                    case 7:
                        autocompletionOptions = _a.sent();
                        return [4 /*yield*/, autocompletionOptions[0].getAttribute('aria-label')];
                    case 8:
                        ariaLabel = _a.sent();
                        (0, chai_1.expect)(ariaLabel).to.contain('soql');
                        // Verify autocompletion options can be selected and therefore automatically inserted into the file
                        return [4 /*yield*/, autocompletionOptions[0].click()];
                    case 9:
                        // Verify autocompletion options can be selected and therefore automatically inserted into the file
                        _a.sent();
                        return [4 /*yield*/, textEditor.save()];
                    case 10:
                        _a.sent();
                        return [4 /*yield*/, textEditor.getText()];
                    case 11:
                        fileContent = _a.sent();
                        (0, chai_1.expect)(fileContent).to.contain('[SELECT field1, field2 FROM SobjectName WHERE clause];');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Use out-of-the-box LWC Snippets - HTML', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, lwcSnippet, inputBox, textEditor, fileContent, fileContentWithoutTrailingSpaces;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Use out-of-the-box LWC Snippets - HTML"));
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 1:
                        workbench = _a.sent();
                        lwcSnippet = [
                            '<lightning-button',
                            '  variant="base"',
                            '  label="Button Label"',
                            '  onclick={handleClick}',
                            '></lightning-button>'
                        ].join('\n');
                        return [4 /*yield*/, utilities.executeQuickPick('Create: New File...', utilities.Duration.seconds(1))];
                    case 2:
                        inputBox = _a.sent();
                        return [4 /*yield*/, inputBox.setText('lwc.html')];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, inputBox.confirm()];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, inputBox.confirm()];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'lwc.html')];
                    case 6:
                        textEditor = _a.sent();
                        return [4 /*yield*/, utilities.executeQuickPick('Snippets: Insert Snippet', utilities.Duration.seconds(1))];
                    case 7:
                        inputBox = _a.sent();
                        return [4 /*yield*/, inputBox.setText('lwc-button')];
                    case 8:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(2))];
                    case 9:
                        _a.sent();
                        return [4 /*yield*/, inputBox.confirm()];
                    case 10:
                        _a.sent();
                        return [4 /*yield*/, textEditor.save()];
                    case 11:
                        _a.sent();
                        return [4 /*yield*/, textEditor.getText()];
                    case 12:
                        fileContent = _a.sent();
                        fileContentWithoutTrailingSpaces = fileContent
                            .split('\n')
                            .map(function (line) { return line.trimEnd(); })
                            .join('\n');
                        return [4 /*yield*/, (0, chai_1.expect)(fileContentWithoutTrailingSpaces).to.contain(lwcSnippet)];
                    case 13:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Use out-of-the-box LWC Snippets - JS', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, lwcSnippet, inputBox, textEditor, autocompletionOptions, ariaLabel, fileContent;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Use out-of-the-box LWC Snippets - JS"));
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 1:
                        workbench = _a.sent();
                        lwcSnippet = 'this.dispatchEvent(new CustomEvent("event-name"));';
                        return [4 /*yield*/, utilities.executeQuickPick('Create: New File...', utilities.Duration.seconds(1))];
                    case 2:
                        inputBox = _a.sent();
                        return [4 /*yield*/, inputBox.setText('lwc.js')];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, inputBox.confirm()];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, inputBox.confirm()];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'lwc.js')];
                    case 6:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.typeText('lwc')];
                    case 7:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(1))];
                    case 8:
                        _a.sent();
                        return [4 /*yield*/, workbench.findElements(vscode_extension_tester_1.By.css('div.monaco-list-row.show-file-icons'))];
                    case 9:
                        autocompletionOptions = _a.sent();
                        return [4 /*yield*/, autocompletionOptions[2].getAttribute('aria-label')];
                    case 10:
                        ariaLabel = _a.sent();
                        (0, chai_1.expect)(ariaLabel).to.contain('lwc-event');
                        // Verify autocompletion options can be selected and therefore automatically inserted into the file
                        return [4 /*yield*/, autocompletionOptions[2].click()];
                    case 11:
                        // Verify autocompletion options can be selected and therefore automatically inserted into the file
                        _a.sent();
                        return [4 /*yield*/, textEditor.save()];
                    case 12:
                        _a.sent();
                        return [4 /*yield*/, textEditor.getText()];
                    case 13:
                        fileContent = _a.sent();
                        return [4 /*yield*/, (0, chai_1.expect)(fileContent).to.contain(lwcSnippet)];
                    case 14:
                        _a.sent();
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
