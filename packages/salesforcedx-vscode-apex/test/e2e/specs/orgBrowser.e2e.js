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
var chai_1 = require("chai");
var vscode_extension_tester_1 = require("vscode-extension-tester");
describe('Org Browser', function () { return __awaiter(void 0, void 0, void 0, function () {
    var testSetup, testReqConfig;
    return __generator(this, function (_a) {
        testReqConfig = {
            projectConfig: {
                projectShape: utilities.ProjectShapeOption.NEW
            },
            isOrgRequired: true,
            testSuiteSuffixName: 'OrgBrowser'
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
        (0, mocha_steps_1.step)('Check Org Browser is connected to target org', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Check Org Browser is connected to target org"));
                        return [4 /*yield*/, utilities.openOrgBrowser(utilities.Duration.seconds(10))];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, utilities.verifyOrgBrowserIsOpen()];
                    case 2:
                        _a.sent();
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Org Browser is connected to target org"));
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Check some metadata types are available', function () { return __awaiter(void 0, void 0, void 0, function () {
            var metadataTypes, _i, metadataTypes_1, type, element;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Check some metadata types are available"));
                        metadataTypes = [
                            'AI Applications',
                            'Apex Classes',
                            'Apex Test Suites',
                            'Apex Triggers',
                            'App Menus',
                            'Assignment Rules',
                            'Aura Components',
                            'Auth Providers',
                            'Branding Sets',
                            'Certificates',
                            'Communities'
                        ];
                        _i = 0, metadataTypes_1 = metadataTypes;
                        _a.label = 1;
                    case 1:
                        if (!(_i < metadataTypes_1.length)) return [3 /*break*/, 4];
                        type = metadataTypes_1[_i];
                        return [4 /*yield*/, utilities.findTypeInOrgBrowser(type)];
                    case 2:
                        element = _a.sent();
                        (0, chai_1.expect)(element).to.not.be.undefined;
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Verify there are no Apex Classes available', function () { return __awaiter(void 0, void 0, void 0, function () {
            var apexClassesLabelEl, noCompsAvailableLabelEl;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Verify there are no Apex Classes available"));
                        return [4 /*yield*/, utilities.findTypeInOrgBrowser('Apex Classes')];
                    case 1:
                        apexClassesLabelEl = _a.sent();
                        (0, chai_1.expect)(apexClassesLabelEl).to.not.be.undefined;
                        return [4 /*yield*/, (apexClassesLabelEl === null || apexClassesLabelEl === void 0 ? void 0 : apexClassesLabelEl.click())];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(10))];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, utilities.findElementByText('div', 'aria-label', 'No components available')];
                    case 4:
                        noCompsAvailableLabelEl = _a.sent();
                        (0, chai_1.expect)(noCompsAvailableLabelEl).to.not.be.undefined;
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Create Apex Class and deploy to org', function () { return __awaiter(void 0, void 0, void 0, function () {
            var classText, successNotificationWasFound;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Create Apex Class and deploy to org"));
                        classText = [
                            "public with sharing class MyClass {",
                            "",
                            "\tpublic static void SayHello(string name){",
                            "\t\tSystem.debug('Hello, ' + name + '!');",
                            "\t}",
                            "}"
                        ].join('\n');
                        return [4 /*yield*/, utilities.createApexClass('MyClass', classText)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Deploy This Source to Org', utilities.Duration.seconds(5))];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Deploy This Source to Org successfully ran', utilities.Duration.FIVE_MINUTES)];
                    case 3:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [4 /*yield*/, utilities.closeCurrentEditor()];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Refresh Org Browser and check MyClass is there', function () { return __awaiter(void 0, void 0, void 0, function () {
            var apexClassesItem, refreshComponentsButton, myClassLabelEl;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Refresh Apex Classes"));
                        return [4 /*yield*/, utilities.findTypeInOrgBrowser('Apex Classes')];
                    case 1:
                        apexClassesItem = _a.sent();
                        (0, chai_1.expect)(apexClassesItem).to.not.be.undefined;
                        return [4 /*yield*/, (apexClassesItem === null || apexClassesItem === void 0 ? void 0 : apexClassesItem.findElements(vscode_extension_tester_1.By.css('a.action-label')))];
                    case 2:
                        refreshComponentsButton = (_a.sent())[1];
                        (0, chai_1.expect)(refreshComponentsButton).to.not.be.undefined;
                        return [4 /*yield*/, (refreshComponentsButton === null || refreshComponentsButton === void 0 ? void 0 : refreshComponentsButton.click())];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(10))];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, utilities.findTypeInOrgBrowser('MyClass')];
                    case 5:
                        myClassLabelEl = _a.sent();
                        (0, chai_1.expect)(myClassLabelEl).to.not.be.undefined;
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Retrieve This Source from Org', function () { return __awaiter(void 0, void 0, void 0, function () {
            var myClassLabelEl, retrieveSourceButton, modalDialog, successNotificationWasFound;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Retrieve This Source from Org"));
                        return [4 /*yield*/, utilities.findTypeInOrgBrowser('MyClass')];
                    case 1:
                        myClassLabelEl = _a.sent();
                        (0, chai_1.expect)(myClassLabelEl).to.not.be.undefined;
                        return [4 /*yield*/, (myClassLabelEl === null || myClassLabelEl === void 0 ? void 0 : myClassLabelEl.click())];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(1))];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, (myClassLabelEl === null || myClassLabelEl === void 0 ? void 0 : myClassLabelEl.findElements(vscode_extension_tester_1.By.css('a.action-label')))];
                    case 4:
                        retrieveSourceButton = (_a.sent())[1];
                        (0, chai_1.expect)(retrieveSourceButton).to.not.be.undefined;
                        return [4 /*yield*/, retrieveSourceButton.click()];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(2))];
                    case 6:
                        _a.sent();
                        modalDialog = new vscode_extension_tester_1.ModalDialog();
                        (0, chai_1.expect)(modalDialog).to.not.be.undefined;
                        return [4 /*yield*/, modalDialog.pushButton('Overwrite')];
                    case 7:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Retrieve This Source from Org successfully ran', utilities.Duration.FIVE_MINUTES)];
                    case 8:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Retrieve and Open Source', function () { return __awaiter(void 0, void 0, void 0, function () {
            var myClassLabelEl, retrieveAndOpenSourceButton, modalDialog, successNotificationWasFound, workbench, editorView, activeTab, title;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Retrieve and Open Source"));
                        // Close all notifications
                        return [4 /*yield*/, utilities.dismissAllNotifications()];
                    case 1:
                        // Close all notifications
                        _a.sent();
                        return [4 /*yield*/, utilities.findTypeInOrgBrowser('MyClass')];
                    case 2:
                        myClassLabelEl = _a.sent();
                        (0, chai_1.expect)(myClassLabelEl).to.not.be.undefined;
                        return [4 /*yield*/, (myClassLabelEl === null || myClassLabelEl === void 0 ? void 0 : myClassLabelEl.click())];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(1))];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, (myClassLabelEl === null || myClassLabelEl === void 0 ? void 0 : myClassLabelEl.findElements(vscode_extension_tester_1.By.css('a.action-label')))];
                    case 5:
                        retrieveAndOpenSourceButton = (_a.sent())[0];
                        (0, chai_1.expect)(retrieveAndOpenSourceButton).to.not.be.undefined;
                        return [4 /*yield*/, retrieveAndOpenSourceButton.click()];
                    case 6:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(2))];
                    case 7:
                        _a.sent();
                        modalDialog = new vscode_extension_tester_1.ModalDialog();
                        (0, chai_1.expect)(modalDialog).to.not.be.undefined;
                        return [4 /*yield*/, modalDialog.pushButton('Overwrite')];
                    case 8:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Retrieve This Source from Org successfully ran', utilities.Duration.FIVE_MINUTES)];
                    case 9:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        workbench = utilities.getWorkbench();
                        editorView = workbench.getEditorView();
                        return [4 /*yield*/, editorView.getActiveTab()];
                    case 10:
                        activeTab = _a.sent();
                        return [4 /*yield*/, (activeTab === null || activeTab === void 0 ? void 0 : activeTab.getTitle())];
                    case 11:
                        title = _a.sent();
                        (0, chai_1.expect)(title).to.equal('MyClass.cls');
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
