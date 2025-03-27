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
var path_1 = require("path");
var testSetup_1 = require("../testSetup");
var utilities = require("../utilities/index");
var vscode_extension_tester_1 = require("vscode-extension-tester");
var chai_1 = require("chai");
describe('Manifest Builder', function () { return __awaiter(void 0, void 0, void 0, function () {
    var testSetup, testReqConfig;
    return __generator(this, function (_a) {
        testReqConfig = {
            projectConfig: {
                projectShape: utilities.ProjectShapeOption.NEW
            },
            isOrgRequired: true,
            testSuiteSuffixName: 'ManifestBuilder'
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
        (0, mocha_steps_1.step)('Generate Manifest File', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, sidebar, content, treeViewSection, objectTreeItem, contextMenu, inputBox, inputBox, filePath, workbench, textEditor, content;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Normally we would want to run the 'SFDX: Generate Manifest File' command here, but it is only
                        // accessible via a context menu, and wdio-vscode-service isn't able to interact with
                        // context menus, so instead the manifest file is manually created:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - calling createCustomObjects()"));
                        return [4 /*yield*/, utilities.createCustomObjects(testSetup)];
                    case 1:
                        _a.sent();
                        if (!(process.platform !== 'darwin')) return [3 /*break*/, 13];
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - creating manifest file"));
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, workbench.getSideBar().wait()];
                    case 2:
                        sidebar = _a.sent();
                        return [4 /*yield*/, sidebar.getContent().wait()];
                    case 3:
                        content = _a.sent();
                        return [4 /*yield*/, content.getSection(testSetup.tempProjectName)];
                    case 4:
                        treeViewSection = _a.sent();
                        if (!treeViewSection) {
                            throw new Error('In verifyProjectLoaded(), getSection() returned a treeViewSection with a value of null (or undefined)');
                        }
                        return [4 /*yield*/, treeViewSection.findItem('objects')];
                    case 5:
                        objectTreeItem = (_a.sent());
                        if (!objectTreeItem) {
                            throw new Error('In verifyProjectLoaded(), findItem() returned a forceAppTreeItem with a value of null (or undefined)');
                        }
                        (0, chai_1.expect)(objectTreeItem).to.not.be.undefined;
                        return [4 /*yield*/, objectTreeItem.wait()];
                    case 6: return [4 /*yield*/, (_a.sent()).expand()];
                    case 7:
                        _a.sent();
                        return [4 /*yield*/, objectTreeItem.openContextMenu()];
                    case 8:
                        contextMenu = _a.sent();
                        return [4 /*yield*/, contextMenu.select('SFDX: Generate Manifest File')];
                    case 9:
                        _a.sent();
                        return [4 /*yield*/, vscode_extension_tester_1.InputBox.create()];
                    case 10:
                        inputBox = _a.sent();
                        return [4 /*yield*/, inputBox.setText('manifest')];
                    case 11:
                        _a.sent();
                        return [4 /*yield*/, inputBox.confirm()];
                    case 12:
                        _a.sent();
                        _a.label = 13;
                    case 13:
                        if (!(process.platform === 'darwin')) return [3 /*break*/, 23];
                        return [4 /*yield*/, utilities.executeQuickPick('Create: New File...', utilities.Duration.seconds(1))];
                    case 14:
                        inputBox = _a.sent();
                        filePath = path_1.default.join('manifest', 'manifest.xml');
                        return [4 /*yield*/, inputBox.setText(filePath)];
                    case 15:
                        _a.sent();
                        // The following 3 confirms are just confirming the file creation and the folder it will belong to
                        return [4 /*yield*/, inputBox.confirm()];
                    case 16:
                        // The following 3 confirms are just confirming the file creation and the folder it will belong to
                        _a.sent();
                        return [4 /*yield*/, inputBox.confirm()];
                    case 17:
                        _a.sent();
                        return [4 /*yield*/, inputBox.confirm()];
                    case 18:
                        _a.sent();
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'manifest.xml')];
                    case 19:
                        textEditor = _a.sent();
                        content = [
                            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
                            "<Package xmlns=\"http://soap.sforce.com/2006/04/metadata\">",
                            "\t<types>",
                            "\t\t<members>*</members>",
                            "\t\t<name>CustomObject</name>",
                            "\t</types>",
                            "\t<version>57.0</version>",
                            "</Package>"
                        ].join('\n');
                        return [4 /*yield*/, textEditor.setText(content)];
                    case 20:
                        _a.sent();
                        return [4 /*yield*/, textEditor.save()];
                    case 21:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(1))];
                    case 22:
                        _a.sent();
                        _a.label = 23;
                    case 23: return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('SFDX: Deploy Source in Manifest to Org', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, statusBar, notificationsButton, notificationsCenter, sidebar, content, treeViewSection, manifestTreeItem, manifestXmlFile, contextMenu, successNotificationWasFound, expectedTexts, outputPanelText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - SFDX: Deploy Source in Manifest to Org"));
                        // Clear output before running the command
                        return [4 /*yield*/, utilities.clearOutputView()];
                    case 1:
                        // Clear output before running the command
                        _a.sent();
                        if (!(process.platform === 'linux')) return [3 /*break*/, 16];
                        workbench = utilities.getWorkbench();
                        statusBar = workbench.getStatusBar();
                        return [4 /*yield*/, statusBar.getItem('Notifications')];
                    case 2:
                        notificationsButton = _a.sent();
                        if (!notificationsButton) return [3 /*break*/, 6];
                        return [4 /*yield*/, notificationsButton.click()];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, workbench.openNotificationsCenter()];
                    case 4:
                        notificationsCenter = _a.sent();
                        return [4 /*yield*/, notificationsCenter.clearAllNotifications()];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6: return [4 /*yield*/, workbench.getSideBar().wait()];
                    case 7:
                        sidebar = _a.sent();
                        return [4 /*yield*/, sidebar.getContent().wait()];
                    case 8:
                        content = _a.sent();
                        return [4 /*yield*/, content.getSection(testSetup.tempProjectName)];
                    case 9:
                        treeViewSection = _a.sent();
                        if (!treeViewSection) {
                            throw new Error('In verifyProjectLoaded(), getSection() returned a treeViewSection with a value of null (or undefined)');
                        }
                        return [4 /*yield*/, treeViewSection.findItem('manifest')];
                    case 10:
                        manifestTreeItem = (_a.sent());
                        if (!manifestTreeItem) {
                            throw new Error('In verifyProjectLoaded(), findItem() returned a forceAppTreeItem with a value of null (or undefined)');
                        }
                        (0, chai_1.expect)(manifestTreeItem).to.not.be.undefined;
                        return [4 /*yield*/, manifestTreeItem.wait()];
                    case 11: return [4 /*yield*/, (_a.sent()).expand()];
                    case 12:
                        _a.sent();
                        return [4 /*yield*/, treeViewSection.findItem('manifest.xml')];
                    case 13:
                        manifestXmlFile = (_a.sent());
                        if (!manifestXmlFile) {
                            throw new Error('No manifest.xml file found');
                        }
                        (0, chai_1.expect)(manifestXmlFile).to.not.be.undefined;
                        return [4 /*yield*/, manifestXmlFile.openContextMenu()];
                    case 14:
                        contextMenu = _a.sent();
                        return [4 /*yield*/, contextMenu.select('SFDX: Deploy Source in Manifest to Org')];
                    case 15:
                        _a.sent();
                        return [3 /*break*/, 18];
                    case 16: 
                    // Using the Command palette, run SFDX: Deploy Source in Manifest to Org
                    return [4 /*yield*/, utilities.executeQuickPick('SFDX: Deploy Source in Manifest to Org', utilities.Duration.seconds(10))];
                    case 17:
                        // Using the Command palette, run SFDX: Deploy Source in Manifest to Org
                        _a.sent();
                        _a.label = 18;
                    case 18: return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Deploy This Source to Org successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 19:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        expectedTexts = [
                            'Deployed Source',
                            "Customer__c  CustomObject  ".concat(path_1.default.join('force-app', 'main', 'default', 'objects', 'Customer__c', 'Customer__c.object-meta.xml')),
                            "Product__c   CustomObject  ".concat(path_1.default.join('force-app', 'main', 'default', 'objects', 'Product__c', 'Product__c.object-meta.xml')),
                            'ended SFDX: Deploy This Source to Org'
                        ];
                        return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Salesforce CLI', 'Starting SFDX: Deploy This Source to Org', 10)];
                    case 20:
                        outputPanelText = _a.sent();
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        return [4 /*yield*/, utilities.verifyOutputPanelText(outputPanelText, expectedTexts)];
                    case 21:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('SFDX: Retrieve Source in Manifest from Org', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, workbench_1, statusBar, notificationsButton, notificationsCenter, sidebar, content, treeViewSection, manifestTreeItem, manifestXmlFile, contextMenu, successNotificationWasFound, expectedTexts, outputPanelText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - SFDX: Retrieve Source in Manifest from Org"));
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'manifest.xml')];
                    case 1:
                        _a.sent();
                        // Clear output before running the command
                        return [4 /*yield*/, utilities.clearOutputView()];
                    case 2:
                        // Clear output before running the command
                        _a.sent();
                        if (!(process.platform === 'linux')) return [3 /*break*/, 17];
                        workbench_1 = utilities.getWorkbench();
                        statusBar = workbench_1.getStatusBar();
                        return [4 /*yield*/, statusBar.getItem('Notifications')];
                    case 3:
                        notificationsButton = _a.sent();
                        if (!notificationsButton) return [3 /*break*/, 7];
                        return [4 /*yield*/, notificationsButton.click()];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, workbench_1.openNotificationsCenter()];
                    case 5:
                        notificationsCenter = _a.sent();
                        return [4 /*yield*/, notificationsCenter.clearAllNotifications()];
                    case 6:
                        _a.sent();
                        _a.label = 7;
                    case 7: return [4 /*yield*/, workbench_1.getSideBar().wait()];
                    case 8:
                        sidebar = _a.sent();
                        return [4 /*yield*/, sidebar.getContent().wait()];
                    case 9:
                        content = _a.sent();
                        return [4 /*yield*/, content.getSection(testSetup.tempProjectName)];
                    case 10:
                        treeViewSection = _a.sent();
                        if (!treeViewSection) {
                            throw new Error('In verifyProjectLoaded(), getSection() returned a treeViewSection with a value of null (or undefined)');
                        }
                        return [4 /*yield*/, treeViewSection.findItem('manifest')];
                    case 11:
                        manifestTreeItem = (_a.sent());
                        if (!manifestTreeItem) {
                            throw new Error('In verifyProjectLoaded(), findItem() returned a forceAppTreeItem with a value of null (or undefined)');
                        }
                        (0, chai_1.expect)(manifestTreeItem).to.not.be.undefined;
                        return [4 /*yield*/, manifestTreeItem.wait()];
                    case 12: return [4 /*yield*/, (_a.sent()).expand()];
                    case 13:
                        _a.sent();
                        return [4 /*yield*/, treeViewSection.findItem('manifest.xml')];
                    case 14:
                        manifestXmlFile = (_a.sent());
                        if (!manifestXmlFile) {
                            throw new Error('No manifest.xml file found');
                        }
                        (0, chai_1.expect)(manifestXmlFile).to.not.be.undefined;
                        return [4 /*yield*/, manifestXmlFile.openContextMenu()];
                    case 15:
                        contextMenu = _a.sent();
                        return [4 /*yield*/, contextMenu.select('SFDX: Retrieve Source in Manifest from Org')];
                    case 16:
                        _a.sent();
                        return [3 /*break*/, 19];
                    case 17: 
                    // Using the Command palette, run SFDX: Retrieve Source in Manifest from Org
                    return [4 /*yield*/, utilities.executeQuickPick('SFDX: Retrieve Source in Manifest from Org', utilities.Duration.seconds(10))];
                    case 18:
                        // Using the Command palette, run SFDX: Retrieve Source in Manifest from Org
                        _a.sent();
                        _a.label = 19;
                    case 19: return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Retrieve This Source from Org successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 20:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        expectedTexts = [
                            'Retrieved Source',
                            "Customer__c  CustomObject  ".concat(path_1.default.join('force-app', 'main', 'default', 'objects', 'Customer__c', 'Customer__c.object-meta.xml')),
                            "Product__c   CustomObject  ".concat(path_1.default.join('force-app', 'main', 'default', 'objects', 'Product__c', 'Product__c.object-meta.xml')),
                            'ended SFDX: Retrieve This Source from Org'
                        ];
                        return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Salesforce CLI', 'Starting SFDX: Retrieve This Source from Org', 10)];
                    case 21:
                        outputPanelText = _a.sent();
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        return [4 /*yield*/, utilities.verifyOutputPanelText(outputPanelText, expectedTexts)];
                    case 22:
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
