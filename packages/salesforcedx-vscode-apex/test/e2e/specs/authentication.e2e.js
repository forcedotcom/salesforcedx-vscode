"use strict";
/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
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
var mocha_steps_1 = require("mocha-steps");
var vscode_extension_tester_1 = require("vscode-extension-tester");
var environmentSettings_1 = require("../environmentSettings");
var testSetup_1 = require("../testSetup");
var utilities = require("../utilities/index");
var chai_1 = require("chai");
describe('Authentication', function () { return __awaiter(void 0, void 0, void 0, function () {
    var projectFolderPath, scratchOrgAliasName, testSetup, testReqConfig;
    return __generator(this, function (_a) {
        testReqConfig = {
            projectConfig: {
                projectShape: utilities.ProjectShapeOption.NEW
            },
            isOrgRequired: false,
            testSuiteSuffixName: 'Authentication'
        };
        (0, mocha_steps_1.step)('Set up the testing environment', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, testSetup_1.TestSetup.setUp(testReqConfig)];
                    case 1:
                        testSetup = _a.sent();
                        projectFolderPath = testSetup.projectFolderPath;
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Run SFDX: Authorize a Dev Hub', function () { return __awaiter(void 0, void 0, void 0, function () {
            var noDefaultOrgSetItem;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, utilities.getStatusBarItemWhichIncludes('No Default Org Set')];
                    case 1:
                        noDefaultOrgSetItem = _a.sent();
                        (0, chai_1.expect)(noDefaultOrgSetItem).to.not.be.undefined;
                        // This is essentially the "SFDX: Authorize a Dev Hub" command, but using the CLI and an auth file instead of the UI.
                        return [4 /*yield*/, utilities.authorizeDevHub(testSetup)];
                    case 2:
                        // This is essentially the "SFDX: Authorize a Dev Hub" command, but using the CLI and an auth file instead of the UI.
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Run SFDX: Set a Default Org', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, changeDefaultOrgSetItem, orgPickerOptions, expectedSfdxCommands, foundSfdxCommands, _i, orgPickerOptions_1, quickPick, label, environmentSettings, devHubAliasName, devHubUserName, inputBox, item, successNotificationWasFound, expectedOutputWasFound, statusBar, vscodeOrgItem;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, utilities.getWorkbench()];
                    case 1:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getStatusBarItemWhichIncludes('No Default Org Set')];
                    case 2:
                        changeDefaultOrgSetItem = _a.sent();
                        (0, chai_1.expect)(changeDefaultOrgSetItem).to.not.be.undefined;
                        return [4 /*yield*/, changeDefaultOrgSetItem.click()];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(5))];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, workbench.findElements(vscode_extension_tester_1.By.css('div.monaco-list#quickInput_list > div.monaco-scrollable-element > div.monaco-list-rows > div.monaco-list-row'))];
                    case 5:
                        orgPickerOptions = _a.sent();
                        expectedSfdxCommands = [
                            ' SFDX: Authorize an Org',
                            ' SFDX: Authorize a Dev Hub',
                            ' SFDX: Create a Default Scratch Org...',
                            ' SFDX: Authorize an Org using Session ID',
                            ' SFDX: Remove Deleted and Expired Orgs'
                        ];
                        foundSfdxCommands = [];
                        _i = 0, orgPickerOptions_1 = orgPickerOptions;
                        _a.label = 6;
                    case 6:
                        if (!(_i < orgPickerOptions_1.length)) return [3 /*break*/, 9];
                        quickPick = orgPickerOptions_1[_i];
                        return [4 /*yield*/, quickPick.getAttribute('aria-label')];
                    case 7:
                        label = (_a.sent()).slice(5);
                        if (expectedSfdxCommands.includes(label)) {
                            foundSfdxCommands.push(label);
                        }
                        _a.label = 8;
                    case 8:
                        _i++;
                        return [3 /*break*/, 6];
                    case 9:
                        if (expectedSfdxCommands.length !== foundSfdxCommands.length) {
                            // Something is wrong - the count of matching menus isn't what we expected.
                            expectedSfdxCommands.forEach(function (expectedSfdxCommand) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    (0, chai_1.expect)(foundSfdxCommands).to.contain(expectedSfdxCommand);
                                    return [2 /*return*/];
                                });
                            }); });
                        }
                        environmentSettings = environmentSettings_1.EnvironmentSettings.getInstance();
                        devHubAliasName = environmentSettings.devHubAliasName;
                        devHubUserName = environmentSettings.devHubUserName;
                        return [4 /*yield*/, vscode_extension_tester_1.InputBox.create()];
                    case 10:
                        inputBox = _a.sent();
                        return [4 /*yield*/, inputBox.selectQuickPick("".concat(devHubAliasName, " - ").concat(devHubUserName))];
                    case 11:
                        item = _a.sent();
                        // Need to pause here for the "set a default org" command to finish.
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(5))];
                    case 12:
                        // Need to pause here for the "set a default org" command to finish.
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Set a Default Org successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 13:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Salesforce CLI', "target-org  ".concat(devHubAliasName, "  true"), 5)];
                    case 14:
                        expectedOutputWasFound = _a.sent();
                        (0, chai_1.expect)(expectedOutputWasFound).to.not.be.undefined;
                        statusBar = workbench.getStatusBar();
                        return [4 /*yield*/, statusBar.getItem("plug  ".concat(devHubAliasName, ", Change Default Org"))];
                    case 15:
                        vscodeOrgItem = _a.sent();
                        (0, chai_1.expect)(vscodeOrgItem).to.not.be.undefined;
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Run SFDX: Create a Default Scratch Org', function () { return __awaiter(void 0, void 0, void 0, function () {
            var prompt, currentDate, ticks, day, month, year, currentOsUserName, successNotificationWasFound, failureNotificationWasFound, scratchOrgStatusBarItem;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, utilities.executeQuickPick('SFDX: Create a Default Scratch Org...', utilities.Duration.seconds(1))];
                    case 1:
                        prompt = _a.sent();
                        // Select a project scratch definition file (config/project-scratch-def.json)
                        return [4 /*yield*/, prompt.confirm()];
                    case 2:
                        // Select a project scratch definition file (config/project-scratch-def.json)
                        _a.sent();
                        currentDate = new Date();
                        ticks = currentDate.getTime();
                        day = ('0' + currentDate.getDate()).slice(-2);
                        month = ('0' + (currentDate.getMonth() + 1)).slice(-2);
                        year = currentDate.getFullYear();
                        currentOsUserName = utilities.transformedUserName();
                        scratchOrgAliasName = "TempScratchOrg_".concat(year, "_").concat(month, "_").concat(day, "_").concat(currentOsUserName, "_").concat(ticks, "_OrgAuth");
                        return [4 /*yield*/, prompt.setText(scratchOrgAliasName)];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(1))];
                    case 4:
                        _a.sent();
                        // Press Enter/Return.
                        return [4 /*yield*/, prompt.confirm()];
                    case 5:
                        // Press Enter/Return.
                        _a.sent();
                        // Enter the number of days.
                        return [4 /*yield*/, prompt.setText('1')];
                    case 6:
                        // Enter the number of days.
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(1))];
                    case 7:
                        _a.sent();
                        // Press Enter/Return.
                        return [4 /*yield*/, prompt.confirm()];
                    case 8:
                        // Press Enter/Return.
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Create a Default Scratch Org... successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 9:
                        successNotificationWasFound = _a.sent();
                        if (!(successNotificationWasFound !== true)) return [3 /*break*/, 16];
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Create a Default Scratch Org... failed to run', utilities.Duration.TEN_MINUTES)];
                    case 10:
                        failureNotificationWasFound = _a.sent();
                        if (!(failureNotificationWasFound === true)) return [3 /*break*/, 15];
                        return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Salesforce CLI', 'organization has reached its daily scratch org signup limit', 5)];
                    case 11:
                        if (!_a.sent()) return [3 /*break*/, 12];
                        // This is a known issue...
                        utilities.log('Warning - creating the scratch org failed, but the failure was due to the daily signup limit');
                        return [3 /*break*/, 14];
                    case 12: return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Salesforce CLI', 'is enabled as a Dev Hub', 5)];
                    case 13:
                        if (_a.sent()) {
                            // This is a known issue...
                            utilities.log('Warning - Make sure that the org is enabled as a Dev Hub.');
                            utilities.log('Warning - To enable it, open the org in your browser, navigate to the Dev Hub page in Setup, and click Enable.');
                            utilities.log('Warning - If you still see this error after enabling the Dev Hub feature, then re-authenticate to the org.');
                        }
                        else {
                            // The failure notification is showing, but it's not due to maxing out the daily limit.  What to do...?
                            utilities.log('Warning - creating the scratch org failed... not sure why...');
                        }
                        _a.label = 14;
                    case 14: return [3 /*break*/, 16];
                    case 15:
                        utilities.log('Warning - creating the scratch org failed... neither the success notification or the failure notification was found.');
                        _a.label = 16;
                    case 16:
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [4 /*yield*/, utilities.getStatusBarItemWhichIncludes(scratchOrgAliasName)];
                    case 17:
                        scratchOrgStatusBarItem = _a.sent();
                        (0, chai_1.expect)(scratchOrgStatusBarItem).to.not.be.undefined;
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Run SFDX: Set the Scratch Org As the Default Org', function () { return __awaiter(void 0, void 0, void 0, function () {
            var inputBox, scratchOrgQuickPickItemWasFound, successNotificationWasFound, scratchOrgStatusBarItem;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, utilities.executeQuickPick('SFDX: Set a Default Org', utilities.Duration.seconds(10))];
                    case 1:
                        inputBox = _a.sent();
                        return [4 /*yield*/, utilities.findQuickPickItem(inputBox, scratchOrgAliasName, false, true)];
                    case 2:
                        scratchOrgQuickPickItemWasFound = _a.sent();
                        (0, chai_1.expect)(scratchOrgQuickPickItemWasFound).to.equal(true);
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(3))];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Set a Default Org successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 4:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [4 /*yield*/, utilities.getStatusBarItemWhichIncludes(scratchOrgAliasName)];
                    case 5:
                        scratchOrgStatusBarItem = _a.sent();
                        (0, chai_1.expect)(scratchOrgStatusBarItem).to.not.be.undefined;
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
