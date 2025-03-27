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
var chai_1 = require("chai");
var fs_1 = require("fs");
var mocha_steps_1 = require("mocha-steps");
var path_1 = require("path");
var vscode_extension_tester_1 = require("vscode-extension-tester");
var testSetup_1 = require("../testSetup");
var utilities = require("../utilities/index");
describe('Push and Pull', function () { return __awaiter(void 0, void 0, void 0, function () {
    var projectName, adminName, adminEmailAddress, testSetup1, testSetup2, testReqConfig, testReqConfig2, verifyPushAndPullOutputText;
    return __generator(this, function (_a) {
        projectName = '';
        adminName = '';
        adminEmailAddress = '';
        testReqConfig = {
            projectConfig: {
                projectShape: utilities.ProjectShapeOption.NEW
            },
            isOrgRequired: true,
            testSuiteSuffixName: 'PushAndPull'
        };
        (0, mocha_steps_1.step)('Set up the testing environment', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log('Push And Pull - Set up the testing environment');
                        return [4 /*yield*/, testSetup_1.TestSetup.setUp(testReqConfig)];
                    case 1:
                        testSetup1 = _a.sent();
                        projectName = testSetup1.tempProjectName;
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('SFDX: View All Changes (Local and in Default Org)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var outputPanelText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log('Push And Pull - SFDX: View All Changes (Local and in Default Org)');
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: View All Changes (Local and in Default Org)', utilities.Duration.seconds(5))];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Salesforce CLI', 'Source Status', 10)];
                    case 2:
                        outputPanelText = _a.sent();
                        (0, chai_1.expect)(outputPanelText).to.contain('No local or remote changes found');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Create an Apex class', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, sidebar, treeViewSection, filteredTreeViewItems;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log('Push And Pull - Create an Apex class');
                        // Create an Apex Class.
                        return [4 /*yield*/, utilities.createCommand('Apex Class', 'ExampleApexClass1', 'classes', 'cls')];
                    case 1:
                        // Create an Apex Class.
                        _a.sent();
                        workbench = utilities.getWorkbench();
                        sidebar = workbench.getSideBar();
                        return [4 /*yield*/, sidebar.getContent().getSection(projectName)];
                    case 2:
                        treeViewSection = _a.sent();
                        return [4 /*yield*/, treeViewSection.expand()];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, utilities.getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'ExampleApexClass1')];
                    case 4:
                        filteredTreeViewItems = _a.sent();
                        // It's a tree, but it's also a list.  Everything in the view is actually flat
                        // and returned from the call to visibleItems.reduce().
                        (0, chai_1.expect)(filteredTreeViewItems.includes('ExampleApexClass1.cls')).to.equal(true);
                        (0, chai_1.expect)(filteredTreeViewItems.includes('ExampleApexClass1.cls-meta.xml')).to.equal(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('SFDX: View Local Changes', function () { return __awaiter(void 0, void 0, void 0, function () {
            var outputPanelText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log('Push And Pull - SFDX: View Local Changes');
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: View Local Changes', utilities.Duration.seconds(5))];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Salesforce CLI', 'Source Status', 10)];
                    case 2:
                        outputPanelText = _a.sent();
                        (0, chai_1.expect)(outputPanelText).to.contain("Local Add  ExampleApexClass1  ApexClass  ".concat(path_1.default.join('force-app', 'main', 'default', 'classes', 'ExampleApexClass1.cls')));
                        (0, chai_1.expect)(outputPanelText).to.contain("Local Add  ExampleApexClass1  ApexClass  ".concat(path_1.default.join('force-app', 'main', 'default', 'classes', 'ExampleApexClass1.cls-meta.xml')));
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Push the Apex class', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log('Push And Pull - Push the Apex class');
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Push Source to Default Org', utilities.Duration.seconds(5))];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, verifyPushSuccess()];
                    case 2:
                        _a.sent();
                        // Check the output.
                        return [4 /*yield*/, verifyPushAndPullOutputText('Push', 'to', 'Created')];
                    case 3:
                        // Check the output.
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Push again (with no changes)', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log('Push And Pull - Push again (with no changes)');
                        // Clear the Output view first.
                        return [4 /*yield*/, utilities.clearOutputView(utilities.Duration.seconds(2))];
                    case 1:
                        // Clear the Output view first.
                        _a.sent();
                        // Now push
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Push Source to Default Org', utilities.Duration.seconds(5))];
                    case 2:
                        // Now push
                        _a.sent();
                        return [4 /*yield*/, verifyPushSuccess()];
                    case 3:
                        _a.sent();
                        // Check the output.
                        return [4 /*yield*/, verifyPushAndPullOutputText('Push', 'to')];
                    case 4:
                        // Check the output.
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Modify the file and push the changes', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, textEditor, outputPanelText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log('Push And Pull - Modify the file and push the changes');
                        // Clear the Output view first.
                        return [4 /*yield*/, utilities.clearOutputView(utilities.Duration.seconds(2))];
                    case 1:
                        // Clear the Output view first.
                        _a.sent();
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'ExampleApexClass1.cls')];
                    case 2:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.setTextAtLine(3, '        // sample comment')];
                    case 3:
                        _a.sent();
                        // Push the file.
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Push Source to Default Org', utilities.Duration.seconds(5))];
                    case 4:
                        // Push the file.
                        _a.sent();
                        return [4 /*yield*/, verifyPushSuccess()];
                    case 5:
                        _a.sent();
                        // Check the output.
                        return [4 /*yield*/, verifyPushAndPullOutputText('Push', 'to')];
                    case 6:
                        // Check the output.
                        _a.sent();
                        // Clear the Output view again.
                        return [4 /*yield*/, utilities.clearOutputView(utilities.Duration.seconds(2))];
                    case 7:
                        // Clear the Output view again.
                        _a.sent();
                        // Now save the file.
                        return [4 /*yield*/, textEditor.save()];
                    case 8:
                        // Now save the file.
                        _a.sent();
                        // An now push the changes.
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Push Source to Default Org', utilities.Duration.seconds(5))];
                    case 9:
                        // An now push the changes.
                        _a.sent();
                        return [4 /*yield*/, verifyPushSuccess()];
                    case 10:
                        _a.sent();
                        return [4 /*yield*/, verifyPushAndPullOutputText('Push', 'to', 'Changed')];
                    case 11:
                        outputPanelText = _a.sent();
                        (0, chai_1.expect)(outputPanelText).to.contain(path_1.default.join('e2e-temp', 'TempProject-PushAndPull', 'force-app', 'main', 'default', 'classes', 'ExampleApexClass1.cls'));
                        (0, chai_1.expect)(outputPanelText).to.contain(path_1.default.join('e2e-temp', 'TempProject-PushAndPull', 'force-app', 'main', 'default', 'classes', 'ExampleApexClass1.cls-meta.xml'));
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Pull the Apex class', function () { return __awaiter(void 0, void 0, void 0, function () {
            var outputPanelText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log('Push And Pull - Pull the Apex class');
                        // With this test, it's going to pull twice...
                        // Clear the Output view first.
                        return [4 /*yield*/, utilities.clearOutputView(utilities.Duration.seconds(2))];
                    case 1:
                        // With this test, it's going to pull twice...
                        // Clear the Output view first.
                        _a.sent();
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Pull Source from Default Org', utilities.Duration.seconds(5))];
                    case 2:
                        _a.sent();
                        // At this point there should be no conflicts since there have been no changes.
                        return [4 /*yield*/, verifyPullSuccess()];
                    case 3:
                        // At this point there should be no conflicts since there have been no changes.
                        _a.sent();
                        return [4 /*yield*/, verifyPushAndPullOutputText('Pull', 'from', 'Created')];
                    case 4:
                        outputPanelText = _a.sent();
                        // The first time a pull is performed, force-app/main/default/profiles/Admin.profile-meta.xml is pulled down.
                        (0, chai_1.expect)(outputPanelText).to.contain(path_1.default.join('force-app', 'main', 'default', 'profiles', 'Admin.profile-meta.xml'));
                        // Second pull...
                        // Clear the output again.
                        return [4 /*yield*/, utilities.clearOutputView(utilities.Duration.seconds(2))];
                    case 5:
                        // Second pull...
                        // Clear the output again.
                        _a.sent();
                        // And pull again.
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Pull Source from Default Org', utilities.Duration.seconds(5))];
                    case 6:
                        // And pull again.
                        _a.sent();
                        return [4 /*yield*/, verifyPullSuccess()];
                    case 7:
                        _a.sent();
                        return [4 /*yield*/, verifyPushAndPullOutputText('Pull', 'from')];
                    case 8:
                        // Check the output.
                        outputPanelText = _a.sent();
                        (0, chai_1.expect)(outputPanelText).to.not.contain('Created  Admin');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)("Modify the file (but don't save), then pull", function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, textEditor;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("Push And Pull - Modify the file (but don't save), then pull");
                        // Clear the Output view first.
                        return [4 /*yield*/, utilities.clearOutputView(utilities.Duration.seconds(2))];
                    case 1:
                        // Clear the Output view first.
                        _a.sent();
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'ExampleApexClass1.cls')];
                    case 2:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.setTextAtLine(3, '        // sample comment for the pull test')];
                    case 3:
                        _a.sent();
                        // Don't save the file just yet.
                        // Pull the file.
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Pull Source from Default Org', utilities.Duration.seconds(5))];
                    case 4:
                        // Don't save the file just yet.
                        // Pull the file.
                        _a.sent();
                        return [4 /*yield*/, verifyPullSuccess()];
                    case 5:
                        _a.sent();
                        // Check the output.
                        return [4 /*yield*/, verifyPushAndPullOutputText('Pull', 'from')];
                    case 6:
                        // Check the output.
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Save the modified file, then pull', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, textEditor;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log('Push And Pull - Save the modified file, then pull');
                        // Clear the Output view first.
                        return [4 /*yield*/, utilities.clearOutputView(utilities.Duration.seconds(2))];
                    case 1:
                        // Clear the Output view first.
                        _a.sent();
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'ExampleApexClass1.cls')];
                    case 2:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.save()];
                    case 3:
                        _a.sent();
                        // An now pull the changes.
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Pull Source from Default Org', utilities.Duration.seconds(5))];
                    case 4:
                        // An now pull the changes.
                        _a.sent();
                        return [4 /*yield*/, verifyPullSuccess()];
                    case 5:
                        _a.sent();
                        // Check the output.
                        return [4 /*yield*/, verifyPushAndPullOutputText('Pull', 'from')];
                    case 6:
                        // Check the output.
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        testReqConfig2 = {
            projectConfig: {
                projectShape: utilities.ProjectShapeOption.NEW
            },
            isOrgRequired: false,
            testSuiteSuffixName: 'ViewChanges'
        };
        (0, mocha_steps_1.step)('SFDX: View Changes in Default Org', function () { return __awaiter(void 0, void 0, void 0, function () {
            var outputPanelText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log('Push And Pull - SFDX: View Changes in Default Org');
                        return [4 /*yield*/, testSetup_1.TestSetup.setUp(testReqConfig2)];
                    case 1:
                        // Create second Project to then view Remote Changes
                        // The new project will connect to the scratch org automatically on GHA, but does not work locally
                        testSetup2 = _a.sent();
                        // Run SFDX: View Changes in Default Org command to view remote changes
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: View Changes in Default Org', utilities.Duration.seconds(5))];
                    case 2:
                        // Run SFDX: View Changes in Default Org command to view remote changes
                        _a.sent();
                        // Reload window to update cache
                        return [4 /*yield*/, utilities.reloadWindow(utilities.Duration.seconds(20))];
                    case 3:
                        // Reload window to update cache
                        _a.sent();
                        // Run SFDX: View Changes in Default Org command to view remote changes
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: View Changes in Default Org', utilities.Duration.seconds(5))];
                    case 4:
                        // Run SFDX: View Changes in Default Org command to view remote changes
                        _a.sent();
                        return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Salesforce CLI', 'Source Status', 10)];
                    case 5:
                        outputPanelText = _a.sent();
                        (0, chai_1.expect)(outputPanelText).to.contain('Remote Add  ExampleApexClass1  ApexClass');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.xstep)('Create an additional system admin user', function () { return __awaiter(void 0, void 0, void 0, function () {
            var currentDate, ticks, day, month, year, currentOsUserName, systemAdminUserDef, systemAdminUserDefPath;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        currentDate = new Date();
                        ticks = currentDate.getTime();
                        day = ('0' + currentDate.getDate()).slice(-2);
                        month = ('0' + (currentDate.getMonth() + 1)).slice(-2);
                        year = currentDate.getFullYear();
                        return [4 /*yield*/, utilities.transformedUserName()];
                    case 1:
                        currentOsUserName = _a.sent();
                        adminName = "AdminUser_".concat(year, "_").concat(month, "_").concat(day, "_").concat(currentOsUserName, "_").concat(ticks, "_PushAndPull");
                        adminEmailAddress = "".concat(adminName, "@sfdx.org");
                        utilities.log("PushAndPull - admin alias is ".concat(adminName, "..."));
                        systemAdminUserDef = {
                            Email: adminEmailAddress,
                            Username: adminEmailAddress,
                            LastName: adminName,
                            LocaleSidKey: 'en_US',
                            EmailEncodingKey: 'UTF-8',
                            LanguageLocaleKey: 'en_US',
                            profileName: 'System Administrator',
                            generatePassword: false
                        };
                        systemAdminUserDefPath = path_1.default.join(testSetup2.projectFolderPath, 'config', 'system-admin-user-def.json');
                        fs_1.default.writeFileSync(systemAdminUserDefPath, JSON.stringify(systemAdminUserDef), 'utf8');
                        return [4 /*yield*/, utilities.createUser(systemAdminUserDefPath, testSetup1.scratchOrgAliasName)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.xstep)('Set the 2nd user as the default user', function () { return __awaiter(void 0, void 0, void 0, function () {
            var inputBox, scratchOrgQuickPickItemWasFound, successNotificationWasFound, scratchOrgStatusBarItem;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, utilities.executeQuickPick('SFDX: Set a Default Org', utilities.Duration.seconds(10))];
                    case 1:
                        inputBox = _a.sent();
                        return [4 /*yield*/, utilities.findQuickPickItem(inputBox, adminEmailAddress, false, true)];
                    case 2:
                        scratchOrgQuickPickItemWasFound = _a.sent();
                        if (!scratchOrgQuickPickItemWasFound) {
                            throw new Error("".concat(adminEmailAddress, " was not found in the the scratch org pick list"));
                        }
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(3))];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Set a Default Org successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 4:
                        successNotificationWasFound = _a.sent();
                        if (!successNotificationWasFound) {
                            throw new Error('In createDefaultScratchOrg(), the notification of "SFDX: Set a Default Org successfully ran" was not found');
                        }
                        return [4 /*yield*/, utilities.getStatusBarItemWhichIncludes(adminEmailAddress)];
                    case 5:
                        scratchOrgStatusBarItem = _a.sent();
                        if (!scratchOrgStatusBarItem) {
                            throw new Error('getStatusBarItemWhichIncludes() returned a scratchOrgStatusBarItem with a value of null (or undefined)');
                        }
                        return [2 /*return*/];
                }
            });
        }); });
        // TODO: at this point write e2e tests for conflict detection
        // but there's a bug - when the 2nd user is created the code thinks
        // it's a source tracked org and push & pull are no longer available
        // (yet deploy & retrieve are).  Spoke with Ken and we think this will
        // be fixed with the check in of his PR this week.
        (0, vscode_extension_tester_1.after)('Tear down and clean up the testing environment', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log('Push and Pull - Tear down and clean up the testing environment');
                        return [4 /*yield*/, (testSetup1 === null || testSetup1 === void 0 ? void 0 : testSetup1.tearDown(false))];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (testSetup2 === null || testSetup2 === void 0 ? void 0 : testSetup2.tearDown())];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        verifyPushAndPullOutputText = function (operation, fromTo, type) { return __awaiter(void 0, void 0, void 0, function () {
            var successNotificationWasFound, outputPanelText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, utilities.notificationIsPresentWithTimeout("SFDX: ".concat(operation, " Source ").concat(fromTo, " Default Org successfully ran"), utilities.Duration.TEN_MINUTES)];
                    case 1:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Salesforce CLI', "=== ".concat(operation, "ed Source"), 10)];
                    case 2:
                        outputPanelText = _a.sent();
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        if (type) {
                            if (operation === 'Push') {
                                (0, chai_1.expect)(outputPanelText).to.contain("".concat(type, "  ExampleApexClass1  ApexClass"));
                            }
                            else {
                                (0, chai_1.expect)(outputPanelText).to.contain("".concat(type, "  Admin"));
                            }
                        }
                        else {
                            (0, chai_1.expect)(outputPanelText).to.contain('No results found');
                        }
                        (0, chai_1.expect)(outputPanelText).to.contain('ended with exit code 0');
                        return [2 /*return*/, outputPanelText];
                }
            });
        }); };
        return [2 /*return*/];
    });
}); });
function verifyPushSuccess() {
    return __awaiter(this, arguments, void 0, function (wait) {
        var successNotificationWasFound;
        if (wait === void 0) { wait = utilities.Duration.TEN_MINUTES; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Push Source to Default Org successfully ran', wait)];
                case 1:
                    successNotificationWasFound = _a.sent();
                    (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                    return [2 /*return*/];
            }
        });
    });
}
function verifyPullSuccess() {
    return __awaiter(this, arguments, void 0, function (wait) {
        var successNotificationWasFound;
        if (wait === void 0) { wait = utilities.Duration.TEN_MINUTES; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Pull Source from Default Org successfully ran', wait)];
                case 1:
                    successNotificationWasFound = _a.sent();
                    (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                    return [2 /*return*/];
            }
        });
    });
}
