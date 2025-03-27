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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
var mocha_steps_1 = require("mocha-steps");
var path_1 = require("path");
var testSetup_1 = require("../testSetup");
var utilities = require("../utilities/index");
var index_1 = require("../utilities/index");
var vscode_extension_tester_1 = require("vscode-extension-tester");
var chai_1 = require("chai");
describe('Deploy and Retrieve', function () { return __awaiter(void 0, void 0, void 0, function () {
    var projectName, pathToClass, testSetup, testReqConfig, runAndValidateCommand, validateCommand;
    return __generator(this, function (_a) {
        pathToClass = path_1.default.join('force-app', 'main', 'default', 'classes', 'MyClass');
        testReqConfig = {
            projectConfig: {
                projectShape: utilities.ProjectShapeOption.NEW
            },
            isOrgRequired: true,
            testSuiteSuffixName: 'DeployAndRetrieve'
        };
        (0, mocha_steps_1.step)('Set up the testing environment', function () { return __awaiter(void 0, void 0, void 0, function () {
            var classText, workbench, successNotificationWasFound, outputPanelText, sidebar, content, treeViewSection, filteredTreeViewItems;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("Deploy and Retrieve - Set up the testing environment");
                        return [4 /*yield*/, testSetup_1.TestSetup.setUp(testReqConfig)];
                    case 1:
                        testSetup = _a.sent();
                        projectName = testSetup.tempProjectName;
                        classText = [
                            "public with sharing class MyClass {",
                            "",
                            "\tpublic static void SayHello(string name){",
                            "\t\tSystem.debug('Hello, ' + name + '!');",
                            "\t}",
                            "}"
                        ].join('\n');
                        return [4 /*yield*/, utilities.dismissAllNotifications()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, utilities.createApexClass('MyClass', classText)];
                    case 3:
                        _a.sent();
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Create Apex Class successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 4:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Salesforce CLI', 'Finished SFDX: Create Apex Class', 10)];
                    case 5:
                        outputPanelText = _a.sent();
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        (0, chai_1.expect)(outputPanelText).to.contain("".concat(pathToClass, ".cls"));
                        (0, chai_1.expect)(outputPanelText).to.contain("".concat(pathToClass, ".cls-meta.xml"));
                        sidebar = workbench.getSideBar();
                        content = sidebar.getContent();
                        return [4 /*yield*/, content.getSection(projectName)];
                    case 6:
                        treeViewSection = _a.sent();
                        return [4 /*yield*/, treeViewSection.expand()];
                    case 7:
                        _a.sent();
                        return [4 /*yield*/, utilities.getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'MyClass')];
                    case 8:
                        filteredTreeViewItems = _a.sent();
                        // It's a tree, but it's also a list.  Everything in the view is actually flat
                        // and returned from the call to visibleItems.reduce().
                        (0, chai_1.expect)(filteredTreeViewItems.includes('MyClass.cls')).to.equal(true);
                        (0, chai_1.expect)(filteredTreeViewItems.includes('MyClass.cls-meta.xml')).to.equal(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Verify Source Tracking Setting is enabled', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        utilities.log("Deploy and Retrieve - Verify Source Tracking Setting is enabled");
                        _a = chai_1.expect;
                        return [4 /*yield*/, utilities.isBooleanSettingEnabled(index_1.WORKSPACE_SETTING_KEYS.ENABLE_SOURCE_TRACKING_FOR_DEPLOY_AND_RETRIEVE)];
                    case 1:
                        _a.apply(void 0, [_b.sent()]);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Deploy with SFDX: Deploy This Source to Org - ST enabled', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("Deploy and Retrieve - Deploy with SFDX: Deploy This Source to Org - ST enabled");
                        workbench = utilities.getWorkbench();
                        // Clear the Output view first.
                        return [4 /*yield*/, utilities.clearOutputView(utilities.Duration.seconds(2))];
                    case 1:
                        // Clear the Output view first.
                        _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'MyClass.cls')];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, runAndValidateCommand('Deploy', 'to', 'ST')];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Deploy again (with no changes) - ST enabled', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("Deploy and Retrieve - Deploy again (with no changes) - ST enabled");
                        workbench = utilities.getWorkbench();
                        // Clear the Output view first.
                        return [4 /*yield*/, utilities.clearOutputView(utilities.Duration.seconds(2))];
                    case 1:
                        // Clear the Output view first.
                        _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'MyClass.cls')];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, runAndValidateCommand('Deploy', 'to', 'ST', 'Unchanged  ')];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Modify the file and deploy again - ST enabled', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, textEditor;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("Deploy and Retrieve - Modify the file and deploy again - ST enabled");
                        workbench = utilities.getWorkbench();
                        // Clear the Output view first.
                        return [4 /*yield*/, utilities.clearOutputView(utilities.Duration.seconds(2))];
                    case 1:
                        // Clear the Output view first.
                        _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'MyClass.cls')];
                    case 2:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.setTextAtLine(2, '\t//say hello to a given name')];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, textEditor.save()];
                    case 4:
                        _a.sent();
                        // Deploy running SFDX: Deploy This Source to Org
                        return [4 /*yield*/, runAndValidateCommand('Deploy', 'to', 'ST', 'Changed  ')];
                    case 5:
                        // Deploy running SFDX: Deploy This Source to Org
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Retrieve with SFDX: Retrieve This Source from Org', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("Deploy and Retrieve - Retrieve with SFDX: Retrieve This Source from Org");
                        workbench = utilities.getWorkbench();
                        // Clear the Output view first.
                        return [4 /*yield*/, utilities.clearOutputView(utilities.Duration.seconds(2))];
                    case 1:
                        // Clear the Output view first.
                        _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'MyClass.cls')];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, runAndValidateCommand('Retrieve', 'from', 'ST')];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Modify the file and retrieve again', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, textEditor, textAfterRetrieve;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("Deploy and Retrieve - Modify the file and retrieve again");
                        workbench = utilities.getWorkbench();
                        // Clear the Output view first.
                        return [4 /*yield*/, utilities.clearOutputView(utilities.Duration.seconds(2))];
                    case 1:
                        // Clear the Output view first.
                        _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'MyClass.cls')];
                    case 2:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.setTextAtLine(2, '\t//modified comment')];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, textEditor.save()];
                    case 4:
                        _a.sent();
                        // Retrieve running SFDX: Retrieve This Source from Org
                        return [4 /*yield*/, runAndValidateCommand('Retrieve', 'from', 'ST')];
                    case 5:
                        // Retrieve running SFDX: Retrieve This Source from Org
                        _a.sent();
                        return [4 /*yield*/, textEditor.getText()];
                    case 6:
                        textAfterRetrieve = _a.sent();
                        (0, chai_1.expect)(textAfterRetrieve).to.not.contain('modified comment');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Prefer Deploy on Save when `Push or deploy on save` is enabled', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, _a, _b, textEditor;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        utilities.log("Deploy and Retrieve - Prefer Deploy on Save when 'Push or deploy on save' is enabled");
                        workbench = utilities.getWorkbench();
                        // Clear the Output view first.
                        return [4 /*yield*/, utilities.clearOutputView(utilities.Duration.seconds(2))];
                    case 1:
                        // Clear the Output view first.
                        _c.sent();
                        _a = chai_1.expect;
                        return [4 /*yield*/, utilities.enableBooleanSetting(index_1.WORKSPACE_SETTING_KEYS.PUSH_OR_DEPLOY_ON_SAVE_ENABLED)];
                    case 2:
                        _a.apply(void 0, [_c.sent()]).to.equal(true);
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(3))];
                    case 3:
                        _c.sent();
                        _b = chai_1.expect;
                        return [4 /*yield*/, utilities.enableBooleanSetting(index_1.WORKSPACE_SETTING_KEYS.PUSH_OR_DEPLOY_ON_SAVE_PREFER_DEPLOY_ON_SAVE)];
                    case 4:
                        _b.apply(void 0, [_c.sent()]).to.equal(true);
                        // Clear all notifications so clear output button is reachable
                        return [4 /*yield*/, utilities.executeQuickPick('Notifications: Clear All Notifications', utilities.Duration.seconds(1))];
                    case 5:
                        // Clear all notifications so clear output button is reachable
                        _c.sent();
                        // Clear the Output view first.
                        return [4 /*yield*/, utilities.clearOutputView(utilities.Duration.seconds(2))];
                    case 6:
                        // Clear the Output view first.
                        _c.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'MyClass.cls')];
                    case 7:
                        textEditor = _c.sent();
                        return [4 /*yield*/, textEditor.setTextAtLine(2, "\t// let's trigger deploy")];
                    case 8:
                        _c.sent();
                        return [4 /*yield*/, textEditor.save()];
                    case 9:
                        _c.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(5))];
                    case 10:
                        _c.sent();
                        // At this point there should be no conflicts since this is a new class.
                        return [4 /*yield*/, validateCommand('Deploy', 'to', 'on save')];
                    case 11:
                        // At this point there should be no conflicts since this is a new class.
                        _c.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Disable Source Tracking Setting', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        utilities.log("Deploy and Retrieve - Disable Source Tracking Setting");
                        return [4 /*yield*/, utilities.executeQuickPick('Notifications: Clear All Notifications', utilities.Duration.seconds(1))];
                    case 1:
                        _b.sent();
                        _a = chai_1.expect;
                        return [4 /*yield*/, utilities.disableBooleanSetting(index_1.WORKSPACE_SETTING_KEYS.ENABLE_SOURCE_TRACKING_FOR_DEPLOY_AND_RETRIEVE)];
                    case 2:
                        _a.apply(void 0, [_b.sent()]).to.equal(false);
                        // Reload window to update cache and get the setting behavior to work
                        return [4 /*yield*/, utilities.reloadWindow()];
                    case 3:
                        // Reload window to update cache and get the setting behavior to work
                        _b.sent();
                        return [4 /*yield*/, utilities.verifyExtensionsAreRunning(utilities.getExtensionsToVerifyActive(), utilities.Duration.seconds(100))];
                    case 4:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Deploy with SFDX: Deploy This Source to Org - ST disabled', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("Deploy and Retrieve - Deploy with SFDX: Deploy This Source to Org - ST disabled");
                        workbench = utilities.getWorkbench();
                        // Clear all notifications so clear output button is visible
                        return [4 /*yield*/, utilities.executeQuickPick('Notifications: Clear All Notifications')];
                    case 1:
                        // Clear all notifications so clear output button is visible
                        _a.sent();
                        // Clear the Output view first.
                        return [4 /*yield*/, utilities.clearOutputView(utilities.Duration.seconds(2))];
                    case 2:
                        // Clear the Output view first.
                        _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'MyClass.cls')];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, runAndValidateCommand('Deploy', 'to', 'no-ST')];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Deploy again (with no changes) - ST disabled', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("Deploy and Retrieve - Deploy again (with no changes) - ST enabled");
                        workbench = utilities.getWorkbench();
                        // Clear the Output view first.
                        return [4 /*yield*/, utilities.clearOutputView(utilities.Duration.seconds(2))];
                    case 1:
                        // Clear the Output view first.
                        _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'MyClass.cls')];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, runAndValidateCommand('Deploy', 'to', 'no-ST', 'Unchanged  ')];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Modify the file and deploy again - ST disabled', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, textEditor;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("Deploy and Retrieve - Modify the file and deploy again - ST disabled");
                        workbench = utilities.getWorkbench();
                        // Clear the Output view first.
                        return [4 /*yield*/, utilities.clearOutputView(utilities.Duration.seconds(2))];
                    case 1:
                        // Clear the Output view first.
                        _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'MyClass.cls')];
                    case 2:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.setTextAtLine(2, '\t//say hello to a given name')];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, textEditor.save()];
                    case 4:
                        _a.sent();
                        // Deploy running SFDX: Deploy This Source to Org
                        return [4 /*yield*/, runAndValidateCommand('Deploy', 'to', 'no-ST', 'Changed  ')];
                    case 5:
                        // Deploy running SFDX: Deploy This Source to Org
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('SFDX: Delete This from Project and Org', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, notificationFound, accepted, successNotificationWasFound, outputPanelText, expectedTexts;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(process.platform !== 'linux')) return [3 /*break*/, 11];
                        utilities.log("Deploy and Retrieve - SFDX: Delete This from Project and Org");
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'MyClass.cls')];
                    case 1:
                        _a.sent();
                        // Run SFDX: Push Source to Default Org and Ignore Conflicts to be in sync with remote
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Push Source to Default Org and Ignore Conflicts', utilities.Duration.seconds(10))];
                    case 2:
                        // Run SFDX: Push Source to Default Org and Ignore Conflicts to be in sync with remote
                        _a.sent();
                        // Clear the Output view first.
                        return [4 /*yield*/, utilities.clearOutputView()];
                    case 3:
                        // Clear the Output view first.
                        _a.sent();
                        // clear notifications
                        return [4 /*yield*/, utilities.dismissAllNotifications()];
                    case 4:
                        // clear notifications
                        _a.sent();
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Delete This from Project and Org', utilities.Duration.seconds(2))];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('Deleting source files deletes the files from your computer and removes the corresponding metadata from your default org. Are you sure you want to delete this source from your project and your org?', utilities.Duration.ONE_MINUTE)];
                    case 6:
                        notificationFound = _a.sent();
                        (0, chai_1.expect)(notificationFound).to.equal(true);
                        return [4 /*yield*/, utilities.acceptNotification('Deleting source files deletes the files from your computer and removes the corresponding metadata from your default org. Are you sure you want to delete this source from your project and your org?', 'Delete Source', utilities.Duration.seconds(5))];
                    case 7:
                        accepted = _a.sent();
                        (0, chai_1.expect)(accepted).to.equal(true);
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Delete from Project and Org successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 8:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Salesforce CLI', 'Starting SFDX: Delete from Project and Org', 10)];
                    case 9:
                        outputPanelText = _a.sent();
                        utilities.log('Output panel text is: ' + outputPanelText);
                        expectedTexts = [
                            '=== Deleted Source',
                            'MyClass',
                            'ApexClass',
                            "".concat(path_1.default.join(pathToClass), ".cls"),
                            "".concat(path_1.default.join(pathToClass), ".cls-meta.xml"),
                            'ended with exit code 0'
                        ];
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        return [4 /*yield*/, utilities.verifyOutputPanelText(outputPanelText, expectedTexts)];
                    case 10:
                        _a.sent();
                        _a.label = 11;
                    case 11: return [2 /*return*/];
                }
            });
        }); });
        (0, vscode_extension_tester_1.after)('Tear down and clean up the testing environment', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("Deploy and Retrieve - Tear down and clean up the testing environment");
                        return [4 /*yield*/, (testSetup === null || testSetup === void 0 ? void 0 : testSetup.tearDown())];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        runAndValidateCommand = function (operation, fromTo, type, prefix) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("runAndValidateCommand()");
                        return [4 /*yield*/, utilities.executeQuickPick("SFDX: ".concat(operation, " This Source ").concat(fromTo, " Org"), utilities.Duration.seconds(5))];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, validateCommand(operation, fromTo, type, prefix)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); };
        validateCommand = function (operation_1, fromTo_1, type_1) {
            var args_1 = [];
            for (var _i = 3; _i < arguments.length; _i++) {
                args_1[_i - 3] = arguments[_i];
            }
            return __awaiter(void 0, __spreadArray([operation_1, fromTo_1, type_1], args_1, true), void 0, function (operation, fromTo, type, // Text to identify operation type (if it has source tracking enabled, disabled or if it was a deploy on save)
            prefix) {
                var successNotificationWasFound, outputPanelText, _a, _b, _c, expectedTexts;
                if (prefix === void 0) { prefix = ''; }
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            utilities.log("validateCommand()");
                            return [4 /*yield*/, utilities.notificationIsPresentWithTimeout("SFDX: ".concat(operation, " This Source ").concat(fromTo, " Org successfully ran"), utilities.Duration.TEN_MINUTES)];
                        case 1:
                            successNotificationWasFound = _d.sent();
                            (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                            return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Salesforce CLI', "Starting SFDX: ".concat(operation, " This Source ").concat(fromTo), 10)];
                        case 2:
                            outputPanelText = _d.sent();
                            _b = (_a = utilities).log;
                            _c = "".concat(operation, " time ").concat(type, ": ");
                            return [4 /*yield*/, utilities.getOperationTime(outputPanelText)];
                        case 3:
                            _b.apply(_a, [_c + (_d.sent())]);
                            expectedTexts = [
                                "".concat(operation, "ed Source").replace('Retrieveed', 'Retrieved'),
                                "".concat(prefix, "MyClass    ApexClass  ").concat(pathToClass, ".cls"),
                                "".concat(prefix, "MyClass    ApexClass  ").concat(pathToClass, ".cls-meta.xml"),
                                "ended SFDX: ".concat(operation, " This Source ").concat(fromTo, " Org")
                            ];
                            (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                            return [4 /*yield*/, utilities.verifyOutputPanelText(outputPanelText, expectedTexts)];
                        case 4:
                            _d.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        return [2 /*return*/];
    });
}); });
