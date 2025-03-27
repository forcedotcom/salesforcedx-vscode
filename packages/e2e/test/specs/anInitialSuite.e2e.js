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
/*
anInitialSuite.e2e.ts is a special case.  We want to validate that the Salesforce extensions and
most SFDX commands are not present at start up.

We also want to verify that after a project has been created, that the Salesforce extensions are loaded,
and that the SFDX commands are present.

Because of this requirement, this suite needs to run first before the other suites.  Since the
suites run in alphabetical order, this suite has been named so it runs first.

Please note that none of the other suites depend on this suite to run, it's just that if this
suite does run, it needs to run first.
*/
describe('An Initial Suite', function () { return __awaiter(void 0, void 0, void 0, function () {
    var testReqConfig, testSetup;
    return __generator(this, function (_a) {
        testReqConfig = {
            projectConfig: {
                projectShape: utilities.ProjectShapeOption.NEW
            },
            isOrgRequired: false,
            testSuiteSuffixName: 'AnInitialSuite'
        };
        (0, mocha_steps_1.step)('Verify our extensions are not initially loaded', function () { return __awaiter(void 0, void 0, void 0, function () {
            var foundSfExtensions;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(20))];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, utilities.zoom('Out', 4, utilities.Duration.seconds(1))];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, utilities.findExtensionsInRunningExtensionsList(utilities.getExtensionsToVerifyActive().map(function (ext) { return ext.extensionId; }))];
                    case 3:
                        foundSfExtensions = _a.sent();
                        return [4 /*yield*/, utilities.zoomReset()];
                    case 4:
                        _a.sent();
                        if (foundSfExtensions.length > 0) {
                            foundSfExtensions.forEach(function (ext) {
                                utilities.log("AnInitialSuite - extension ".concat(ext.extensionId, " was present, but wasn't expected before the extensions loaded"));
                            });
                            throw new Error('AnInitialSuite - extension was found before the extensions loaded');
                        }
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Verify the default SFDX commands are present when no project is loaded', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, prompt, quickPicks, expectedSfdxCommandsFound, unexpectedSfdxCommandWasFound, _i, quickPicks_1, quickPick, label;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.openCommandPromptWithCommand(workbench, 'SFDX:')];
                    case 1:
                        prompt = _a.sent();
                        return [4 /*yield*/, prompt.getQuickPicks()];
                    case 2:
                        quickPicks = _a.sent();
                        expectedSfdxCommandsFound = 0;
                        unexpectedSfdxCommandWasFound = false;
                        _i = 0, quickPicks_1 = quickPicks;
                        _a.label = 3;
                    case 3:
                        if (!(_i < quickPicks_1.length)) return [3 /*break*/, 6];
                        quickPick = quickPicks_1[_i];
                        return [4 /*yield*/, quickPick.getLabel()];
                    case 4:
                        label = _a.sent();
                        switch (label) {
                            // These three commands are expected to always be present,
                            // even before the extensions have been loaded.
                            case 'SFDX: Create and Set Up Project for ISV Debugging':
                            case 'SFDX: Create Project':
                            case 'SFDX: Create Project with Manifest':
                                expectedSfdxCommandsFound++;
                                break;
                            default:
                                // And if any other SFDX commands are present, this is unexpected and is an issue.
                                unexpectedSfdxCommandWasFound = true;
                                utilities.log("AnInitialSuite - command ".concat(label, " was present, but wasn't expected before the extensions loaded"));
                                break;
                        }
                        _a.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 3];
                    case 6:
                        (0, chai_1.expect)(expectedSfdxCommandsFound).to.be.equal(3);
                        (0, chai_1.expect)(unexpectedSfdxCommandWasFound).to.be.false;
                        // Escape out of the pick list.
                        return [4 /*yield*/, prompt.cancel()];
                    case 7:
                        // Escape out of the pick list.
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
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
        (0, mocha_steps_1.step)('Verify that SFDX commands are present after an SFDX project has been created', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, prompt, quickPicks, commands;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        workbench = utilities.getWorkbench();
                        return [4 /*yield*/, utilities.openCommandPromptWithCommand(workbench, 'SFDX:')];
                    case 1:
                        prompt = _a.sent();
                        return [4 /*yield*/, prompt.getQuickPicks()];
                    case 2:
                        quickPicks = _a.sent();
                        return [4 /*yield*/, Promise.all(quickPicks.map(function (quickPick) { return quickPick.getLabel(); }))];
                    case 3:
                        commands = _a.sent();
                        // Look for the first few SFDX commands.
                        (0, chai_1.expect)(commands).to.include('SFDX: Authorize a Dev Hub');
                        (0, chai_1.expect)(commands).to.include('SFDX: Authorize an Org');
                        (0, chai_1.expect)(commands).to.include('SFDX: Authorize an Org using Session ID');
                        (0, chai_1.expect)(commands).to.include('SFDX: Cancel Active Command');
                        (0, chai_1.expect)(commands).to.include('SFDX: Configure Apex Debug Exceptions');
                        (0, chai_1.expect)(commands).to.include('SFDX: Create a Default Scratch Org...');
                        (0, chai_1.expect)(commands).to.include('SFDX: Create and Set Up Project for ISV Debugging');
                        (0, chai_1.expect)(commands).to.include('SFDX: Create Apex Class');
                        (0, chai_1.expect)(commands).to.include('SFDX: Create Apex Trigger');
                        // There are more, but just look for the first few commands.
                        // Escape out of the pick list.
                        return [4 /*yield*/, prompt.cancel()];
                    case 4:
                        // There are more, but just look for the first few commands.
                        // Escape out of the pick list.
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
