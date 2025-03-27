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
var vscode_extension_tester_1 = require("vscode-extension-tester");
var testSetup_1 = require("../testSetup");
var utilities = require("../utilities/index");
var chai_1 = require("chai");
describe('SObjects Definitions', function () { return __awaiter(void 0, void 0, void 0, function () {
    var testSetup, testReqConfig, projectName;
    return __generator(this, function (_a) {
        testReqConfig = {
            projectConfig: {
                projectShape: utilities.ProjectShapeOption.NEW
            },
            isOrgRequired: true,
            testSuiteSuffixName: 'sObjectsDefinitions'
        };
        (0, mocha_steps_1.step)('Set up the testing environment', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, testSetup_1.TestSetup.setUp(testReqConfig)];
                    case 1:
                        testSetup = _a.sent();
                        projectName = testSetup.tempProjectName;
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - calling createCustomObjects()"));
                        return [4 /*yield*/, utilities.createCustomObjects(testSetup)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)("Check Custom Objects 'Customer__c' and 'Product__c' are within objects folder", function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, sidebar, content, treeViewSection, objectTreeItem, customerObjectFolder, _a, customerCustomObject, productObjectFolder, _b, productCustomObject;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Check Custom Objects 'Customer__c' and 'Product__c' are within objects folder"));
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 1:
                        workbench = _c.sent();
                        return [4 /*yield*/, workbench.getSideBar().wait()];
                    case 2:
                        sidebar = _c.sent();
                        return [4 /*yield*/, sidebar.getContent().wait()];
                    case 3:
                        content = _c.sent();
                        return [4 /*yield*/, content.getSection(projectName)];
                    case 4:
                        treeViewSection = _c.sent();
                        (0, chai_1.expect)(treeViewSection).to.not.be.undefined;
                        return [4 /*yield*/, treeViewSection.findItem('objects')];
                    case 5:
                        objectTreeItem = (_c.sent());
                        (0, chai_1.expect)(objectTreeItem).to.not.be.undefined;
                        return [4 /*yield*/, objectTreeItem.select()];
                    case 6:
                        _c.sent();
                        return [4 /*yield*/, objectTreeItem.findChildItem('Customer__c')];
                    case 7:
                        customerObjectFolder = (_c.sent());
                        (0, chai_1.expect)(customerObjectFolder).to.not.be.undefined;
                        return [4 /*yield*/, (customerObjectFolder === null || customerObjectFolder === void 0 ? void 0 : customerObjectFolder.expand())];
                    case 8:
                        _c.sent();
                        _a = chai_1.expect;
                        return [4 /*yield*/, (customerObjectFolder === null || customerObjectFolder === void 0 ? void 0 : customerObjectFolder.isExpanded())];
                    case 9:
                        _a.apply(void 0, [_c.sent()]).to.equal(true);
                        return [4 /*yield*/, customerObjectFolder.findChildItem('Customer__c.object-meta.xml')];
                    case 10:
                        customerCustomObject = _c.sent();
                        (0, chai_1.expect)(customerCustomObject).to.not.be.undefined;
                        return [4 /*yield*/, objectTreeItem.findChildItem('Product__c')];
                    case 11:
                        productObjectFolder = (_c.sent());
                        (0, chai_1.expect)(productObjectFolder).to.not.be.undefined;
                        return [4 /*yield*/, (productObjectFolder === null || productObjectFolder === void 0 ? void 0 : productObjectFolder.expand())];
                    case 12:
                        _c.sent();
                        _b = chai_1.expect;
                        return [4 /*yield*/, (productObjectFolder === null || productObjectFolder === void 0 ? void 0 : productObjectFolder.isExpanded())];
                    case 13:
                        _b.apply(void 0, [_c.sent()]).to.equal(true);
                        return [4 /*yield*/, productObjectFolder.findChildItem('Product__c.object-meta.xml')];
                    case 14:
                        productCustomObject = _c.sent();
                        (0, chai_1.expect)(productCustomObject).to.not.be.undefined;
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Push Source to Org', function () { return __awaiter(void 0, void 0, void 0, function () {
            var successNotificationWasFound, outputPanelText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Push Source to Org"));
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Push Source to Default Org', utilities.Duration.seconds(5))];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(1))];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Push Source to Default Org successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 3:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Salesforce CLI', 'Starting SFDX: Push Source to Default Org', 5)];
                    case 4:
                        outputPanelText = _a.sent();
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        (0, chai_1.expect)(outputPanelText).to.contain('Pushed Source');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Refresh SObject Definitions for Custom SObjects', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, treeViewSection, customerCustomObject, productCustomObject;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Refresh SObject Definitions for Custom SObjects"));
                        return [4 /*yield*/, refreshSObjectDefinitions('Custom SObjects')];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, verifyOutputPanelText('Custom sObjects', 2)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 3:
                        workbench = _a.sent();
                        return [4 /*yield*/, verifySObjectFolders(workbench, projectName, 'customObjects')];
                    case 4:
                        treeViewSection = _a.sent();
                        return [4 /*yield*/, treeViewSection.findItem('Customer__c.cls')];
                    case 5:
                        customerCustomObject = _a.sent();
                        (0, chai_1.expect)(customerCustomObject).to.not.be.undefined;
                        return [4 /*yield*/, treeViewSection.findItem('Product__c.cls')];
                    case 6:
                        productCustomObject = _a.sent();
                        (0, chai_1.expect)(productCustomObject).to.not.be.undefined;
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Refresh SObject Definitions for Standard SObjects', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, treeViewSection, accountSObject, accountCleanInfoSObject, acceptedEventRelationSObject;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Refresh SObject Definitions for Standard SObjects"));
                        return [4 /*yield*/, refreshSObjectDefinitions('Standard SObjects')];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, verifyOutputPanelText('Standard sObjects')];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 3:
                        workbench = _a.sent();
                        return [4 /*yield*/, verifySObjectFolders(workbench, projectName, 'standardObjects')];
                    case 4:
                        treeViewSection = _a.sent();
                        return [4 /*yield*/, treeViewSection.findItem('Account.cls')];
                    case 5:
                        accountSObject = _a.sent();
                        (0, chai_1.expect)(accountSObject).to.not.be.undefined;
                        return [4 /*yield*/, treeViewSection.findItem('AccountCleanInfo.cls')];
                    case 6:
                        accountCleanInfoSObject = _a.sent();
                        (0, chai_1.expect)(accountCleanInfoSObject).to.not.be.undefined;
                        return [4 /*yield*/, treeViewSection.findItem('AcceptedEventRelation.cls')];
                    case 7:
                        acceptedEventRelationSObject = _a.sent();
                        (0, chai_1.expect)(acceptedEventRelationSObject).to.not.be.undefined;
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Refresh SObject Definitions for All SObjects', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Refresh SObject Definitions for All SObjects"));
                        return [4 /*yield*/, refreshSObjectDefinitions('All SObjects')];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, verifyOutputPanelText('Standard sObjects')];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, verifyOutputPanelText('Custom sObjects', 2)];
                    case 3:
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
function verifyOutputPanelText(type, qty) {
    return __awaiter(this, void 0, void 0, function () {
        var outputPanelText, expectedTexts;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    utilities.log("calling verifyOutputPanelText(".concat(type, ")"));
                    return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Salesforce CLI', 'sObjects', 10)];
                case 1:
                    outputPanelText = (_a.sent());
                    (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                    expectedTexts = [
                        "Starting SFDX: Refresh SObject Definitions",
                        "sf sobject definitions refresh",
                        "Processed ".concat(qty || ''),
                        "".concat(type),
                        "ended with exit code 0"
                    ];
                    return [4 /*yield*/, utilities.verifyOutputPanelText(outputPanelText, expectedTexts)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function refreshSObjectDefinitions(type) {
    return __awaiter(this, void 0, void 0, function () {
        var prompt, successNotificationWasFound;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    utilities.log("calling refreshSObjectDefinitions(".concat(type, ")"));
                    return [4 /*yield*/, utilities.clearOutputView(utilities.Duration.seconds(2))];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, utilities.executeQuickPick('SFDX: Refresh SObject Definitions', utilities.Duration.seconds(2))];
                case 2:
                    prompt = _a.sent();
                    return [4 /*yield*/, prompt.setText(type)];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, prompt.selectQuickPick(type)];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(1))];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Refresh SObject Definitions successfully ran', utilities.Duration.TEN_MINUTES)];
                case 6:
                    successNotificationWasFound = _a.sent();
                    (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                    return [2 /*return*/];
            }
        });
    });
}
function verifySObjectFolders(workbench, projectName, folder) {
    return __awaiter(this, void 0, void 0, function () {
        var sidebar, content, treeViewSection, sfdxTreeItem, _a, toolsTreeItem, _b, sobjectsTreeItem, _c, objectsTreeItem, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    utilities.log("calling verifySObjectFolders(workbench, ".concat(projectName, ", ").concat(folder, ")"));
                    sidebar = workbench.getSideBar();
                    content = sidebar.getContent();
                    return [4 /*yield*/, content.getSection(projectName)];
                case 1:
                    treeViewSection = _e.sent();
                    (0, chai_1.expect)(treeViewSection).to.not.be.undefined;
                    return [4 /*yield*/, treeViewSection.findItem('.sfdx')];
                case 2:
                    sfdxTreeItem = (_e.sent());
                    (0, chai_1.expect)(sfdxTreeItem).to.not.be.undefined;
                    return [4 /*yield*/, sfdxTreeItem.expand()];
                case 3:
                    _e.sent();
                    _a = chai_1.expect;
                    return [4 /*yield*/, sfdxTreeItem.isExpanded()];
                case 4:
                    _a.apply(void 0, [_e.sent()]).to.equal(true);
                    return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(1))];
                case 5:
                    _e.sent();
                    return [4 /*yield*/, sfdxTreeItem.findChildItem('tools')];
                case 6:
                    toolsTreeItem = (_e.sent());
                    (0, chai_1.expect)(toolsTreeItem).to.not.be.undefined;
                    return [4 /*yield*/, toolsTreeItem.expand()];
                case 7:
                    _e.sent();
                    _b = chai_1.expect;
                    return [4 /*yield*/, toolsTreeItem.isExpanded()];
                case 8:
                    _b.apply(void 0, [_e.sent()]).to.equal(true);
                    return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(1))];
                case 9:
                    _e.sent();
                    return [4 /*yield*/, toolsTreeItem.findChildItem('sobjects')];
                case 10:
                    sobjectsTreeItem = (_e.sent());
                    (0, chai_1.expect)(sobjectsTreeItem).to.not.be.undefined;
                    return [4 /*yield*/, sobjectsTreeItem.expand()];
                case 11:
                    _e.sent();
                    _c = chai_1.expect;
                    return [4 /*yield*/, sobjectsTreeItem.isExpanded()];
                case 12:
                    _c.apply(void 0, [_e.sent()]).to.equal(true);
                    return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(1))];
                case 13:
                    _e.sent();
                    return [4 /*yield*/, sobjectsTreeItem.findChildItem(folder)];
                case 14:
                    objectsTreeItem = (_e.sent());
                    (0, chai_1.expect)(objectsTreeItem).to.not.be.undefined;
                    return [4 /*yield*/, objectsTreeItem.expand()];
                case 15:
                    _e.sent();
                    _d = chai_1.expect;
                    return [4 /*yield*/, objectsTreeItem.isExpanded()];
                case 16:
                    _d.apply(void 0, [_e.sent()]).to.equal(true);
                    return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(1))];
                case 17:
                    _e.sent();
                    return [2 /*return*/, treeViewSection];
            }
        });
    });
}
