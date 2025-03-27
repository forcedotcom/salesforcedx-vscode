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
describe('Aura LSP', function () { return __awaiter(void 0, void 0, void 0, function () {
    var testSetup, testReqConfig;
    return __generator(this, function (_a) {
        testReqConfig = {
            projectConfig: {
                projectShape: utilities.ProjectShapeOption.NEW
            },
            isOrgRequired: false,
            testSuiteSuffixName: 'AuraLsp'
        };
        (0, mocha_steps_1.step)('Set up the testing environment', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log('AuraLsp - Set up the testing environment');
                        return [4 /*yield*/, testSetup_1.TestSetup.setUp(testReqConfig)];
                    case 1:
                        testSetup = _a.sent();
                        // Create Aura Component
                        return [4 /*yield*/, utilities.createAura('aura1')];
                    case 2:
                        // Create Aura Component
                        _a.sent();
                        // Reload the VSCode window to allow the Aura Component to be indexed by the Aura Language Server
                        return [4 /*yield*/, utilities.reloadWindow(utilities.Duration.seconds(20))];
                    case 3:
                        // Reload the VSCode window to allow the Aura Component to be indexed by the Aura Language Server
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Verify LSP finished indexing', function () { return __awaiter(void 0, void 0, void 0, function () {
            var outputViewText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Verify LSP finished indexing"));
                        return [4 /*yield*/, utilities.getOutputViewText('Aura Language Server')];
                    case 1:
                        outputViewText = _a.sent();
                        (0, chai_1.expect)(outputViewText).to.contain('language server started');
                        utilities.log('Output view text');
                        utilities.log(outputViewText);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Go to Definition', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, textEditor, definition;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Go to Definition"));
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 1:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'aura1.cmp')];
                    case 2:
                        textEditor = _a.sent();
                        // Move cursor to the middle of "simpleNewContact"
                        return [4 /*yield*/, textEditor.moveCursor(8, 15)];
                    case 3:
                        // Move cursor to the middle of "simpleNewContact"
                        _a.sent();
                        // Go to definition through F12
                        return [4 /*yield*/, utilities.executeQuickPick('Go to Definition', utilities.Duration.seconds(2))];
                    case 4:
                        // Go to definition through F12
                        _a.sent();
                        return [4 /*yield*/, textEditor.getCoordinates()];
                    case 5:
                        definition = _a.sent();
                        (0, chai_1.expect)(definition[0]).to.equal(3);
                        (0, chai_1.expect)(definition[1]).to.equal(27);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Autocompletion', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, textEditor, autocompletionOptions, ariaLabel, line3Text;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Autocompletion"));
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 1:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'aura1.cmp')];
                    case 2:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.typeTextAt(2, 1, '<aura:appl')];
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
                        (0, chai_1.expect)(ariaLabel).to.contain('aura:application');
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
                        return [4 /*yield*/, textEditor.getTextAtLine(2)];
                    case 11:
                        line3Text = _a.sent();
                        (0, chai_1.expect)(line3Text).to.include('aura:application');
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
