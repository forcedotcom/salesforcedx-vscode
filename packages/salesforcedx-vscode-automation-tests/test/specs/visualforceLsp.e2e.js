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
var path_1 = require("path");
var vscode_extension_tester_1 = require("vscode-extension-tester");
var testSetup_1 = require("../testSetup");
var utilities = require("../utilities/index");
describe('Visualforce LSP', function () { return __awaiter(void 0, void 0, void 0, function () {
    var testSetup, testReqConfig;
    return __generator(this, function (_a) {
        testReqConfig = {
            projectConfig: {
                projectShape: utilities.ProjectShapeOption.NEW
            },
            isOrgRequired: false,
            testSuiteSuffixName: 'VisualforceLsp'
        };
        (0, mocha_steps_1.step)('Set up the testing environment', function () { return __awaiter(void 0, void 0, void 0, function () {
            var pathToPagesFolder, pathToPage, expectedTexts, outputPanelText, workbench, textEditor, fileContent;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log('VisualforceLsp - Set up the testing environment');
                        return [4 /*yield*/, testSetup_1.TestSetup.setUp(testReqConfig)];
                    case 1:
                        testSetup = _a.sent();
                        // Create Apex controller for the Visualforce Page
                        return [4 /*yield*/, utilities.createApexController()];
                    case 2:
                        // Create Apex controller for the Visualforce Page
                        _a.sent();
                        // Clear output before running the command
                        return [4 /*yield*/, utilities.clearOutputView()];
                    case 3:
                        // Clear output before running the command
                        _a.sent();
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - calling createVisualforcePage()"));
                        return [4 /*yield*/, utilities.createVisualforcePage()];
                    case 4:
                        _a.sent();
                        pathToPagesFolder = path_1.default.join(testSetup.projectFolderPath, 'force-app', 'main', 'default', 'pages');
                        pathToPage = path_1.default.join('force-app', 'main', 'default', 'pages', 'FooPage.page');
                        expectedTexts = [
                            "target dir = ".concat(pathToPagesFolder),
                            "create ".concat(pathToPage),
                            "create ".concat(pathToPage, "-meta.xml"),
                            'Finished SFDX: Create Visualforce Page'
                        ];
                        return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Salesforce CLI', 'Starting SFDX: Create Visualforce Page', 10)];
                    case 5:
                        outputPanelText = _a.sent();
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        return [4 /*yield*/, utilities.verifyOutputPanelText(outputPanelText, expectedTexts)];
                    case 6:
                        _a.sent();
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 7:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'FooPage.page')];
                    case 8:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.getText()];
                    case 9:
                        fileContent = _a.sent();
                        (0, chai_1.expect)(fileContent).to.contain('<apex:page controller="myController" tabStyle="Account">');
                        (0, chai_1.expect)(fileContent).to.contain('</apex:page>');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.xstep)('Go to Definition', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, textEditor;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Go to Definition"));
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 1:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'FooPage.page')];
                    case 2:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.moveCursor(1, 25)];
                    case 3:
                        _a.sent();
                        // Go to definition through F12
                        return [4 /*yield*/, utilities.executeQuickPick('Go to Definition', utilities.Duration.seconds(2))];
                    case 4:
                        // Go to definition through F12
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(1))];
                    case 5:
                        _a.sent();
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
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'FooPage.page')];
                    case 2:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.typeTextAt(3, 1, '\t\t<apex:pageM')];
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
                        (0, chai_1.expect)(ariaLabel).to.contain('apex:pageMessage');
                        // Verify autocompletion options can be selected and therefore automatically inserted into the file
                        return [4 /*yield*/, autocompletionOptions[0].click()];
                    case 7:
                        // Verify autocompletion options can be selected and therefore automatically inserted into the file
                        _a.sent();
                        return [4 /*yield*/, textEditor.typeText('/>')];
                    case 8:
                        _a.sent();
                        return [4 /*yield*/, textEditor.save()];
                    case 9:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(1))];
                    case 10:
                        _a.sent();
                        return [4 /*yield*/, textEditor.getTextAtLine(3)];
                    case 11:
                        line3Text = _a.sent();
                        (0, chai_1.expect)(line3Text).to.contain('apex:pageMessage');
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
