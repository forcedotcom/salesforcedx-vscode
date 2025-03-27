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
exports.setUpScratchOrg = setUpScratchOrg;
exports.authorizeDevHub = authorizeDevHub;
exports.deleteScratchOrgInfo = deleteScratchOrgInfo;
/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
var utilities = require("./index");
var path_1 = require("path");
var fs_1 = require("fs");
var environmentSettings_1 = require("../environmentSettings");
function setUpScratchOrg(testSetup, scratchOrgEdition) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, authorizeDevHub(testSetup)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, createDefaultScratchOrg(testSetup, scratchOrgEdition)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function authorizeDevHub(testSetup) {
    return __awaiter(this, void 0, void 0, function () {
        var authFilePath, sfOrgDisplayResult;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    utilities.log('');
                    utilities.log("".concat(testSetup.testSuiteSuffixName, " - Starting authorizeDevHub()..."));
                    if (!!testSetup.aliasAndUserNameWereVerified) return [3 /*break*/, 2];
                    return [4 /*yield*/, verifyAliasAndUserName()];
                case 1:
                    _a.sent();
                    testSetup.aliasAndUserNameWereVerified = true;
                    _a.label = 2;
                case 2:
                    authFilePath = path_1.default.join(testSetup.projectFolderPath, 'authFile.json');
                    utilities.log("".concat(testSetup.testSuiteSuffixName, " - calling sf org:display..."));
                    return [4 /*yield*/, utilities.orgDisplay(environmentSettings_1.EnvironmentSettings.getInstance().devHubUserName)];
                case 3:
                    sfOrgDisplayResult = _a.sent();
                    // Now write the file.
                    fs_1.default.writeFileSync(authFilePath, sfOrgDisplayResult.stdout);
                    utilities.log("".concat(testSetup.testSuiteSuffixName, " - finished writing the file..."));
                    // Call org:login:sfdx-url and read in the JSON that was just created.
                    utilities.log("".concat(testSetup.testSuiteSuffixName, " - calling sf org:login:sfdx-url..."));
                    return [4 /*yield*/, utilities.orgLoginSfdxUrl(authFilePath)];
                case 4:
                    _a.sent();
                    utilities.log("".concat(testSetup.testSuiteSuffixName, " - ...finished authorizeDevHub()"));
                    utilities.log('');
                    return [2 /*return*/];
            }
        });
    });
}
// verifyAliasAndUserName() verifies that the alias and user name are set,
// and also verifies there is a corresponding match in the org list.
function verifyAliasAndUserName() {
    return __awaiter(this, void 0, void 0, function () {
        var environmentSettings, devHubAliasName, devHubUserName, execResult, sfOrgListResult, nonScratchOrgs, i, nonScratchOrg;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    environmentSettings = environmentSettings_1.EnvironmentSettings.getInstance();
                    devHubAliasName = environmentSettings.devHubAliasName;
                    if (!devHubAliasName) {
                        throw new Error('Error: devHubAliasName was not set.');
                    }
                    devHubUserName = environmentSettings.devHubUserName;
                    if (!devHubUserName) {
                        throw new Error('Error: devHubUserName was not set.');
                    }
                    return [4 /*yield*/, utilities.orgList()];
                case 1:
                    execResult = _a.sent();
                    sfOrgListResult = JSON.parse(execResult.stdout).result;
                    nonScratchOrgs = sfOrgListResult.nonScratchOrgs;
                    for (i = 0; i < nonScratchOrgs.length; i++) {
                        nonScratchOrg = nonScratchOrgs[i];
                        if (nonScratchOrg.alias === devHubAliasName && nonScratchOrg.username === devHubUserName) {
                            return [2 /*return*/];
                        }
                    }
                    throw new Error("Error: matching devHub alias '".concat(devHubAliasName, "' and devHub user name '").concat(devHubUserName, "' was not found.\nPlease consult README.md and make sure DEV_HUB_ALIAS_NAME and DEV_HUB_USER_NAME are set correctly."));
            }
        });
    });
}
function createDefaultScratchOrg(testSetup_1) {
    return __awaiter(this, arguments, void 0, function (testSetup, edition) {
        var definitionFile, currentDate, day, month, year, currentOsUserName, startHr, sfOrgCreateResult, result, endHr, time, successNotificationWasFound, scratchOrgStatusBarItem;
        var _a;
        if (edition === void 0) { edition = 'developer'; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    utilities.log('');
                    utilities.log("".concat(testSetup.testSuiteSuffixName, " - Starting createDefaultScratchOrg()..."));
                    definitionFile = path_1.default.join(testSetup.projectFolderPath, 'config', 'project-scratch-def.json');
                    utilities.debug("".concat(testSetup.testSuiteSuffixName, " - constructing scratchOrgAliasName..."));
                    currentDate = new Date();
                    day = currentDate.getDate().toString().padStart(2, '0');
                    month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
                    year = currentDate.getFullYear();
                    currentOsUserName = utilities.transformedUserName();
                    testSetup.scratchOrgAliasName = "TempScratchOrg_".concat(year, "_").concat(month, "_").concat(day, "_").concat(currentOsUserName, "_").concat(currentDate.getTime(), "_").concat(testSetup.testSuiteSuffixName);
                    utilities.log("".concat(testSetup.testSuiteSuffixName, " - temporary scratch org name is ").concat(testSetup.scratchOrgAliasName, "..."));
                    startHr = process.hrtime();
                    return [4 /*yield*/, utilities.scratchOrgCreate(edition, definitionFile, testSetup.scratchOrgAliasName, 1)];
                case 1:
                    sfOrgCreateResult = _b.sent();
                    utilities.debug("".concat(testSetup.testSuiteSuffixName, " - calling JSON.parse()..."));
                    result = JSON.parse(sfOrgCreateResult.stdout).result;
                    endHr = process.hrtime(startHr);
                    time = endHr[0] * 1000000000 + endHr[1] - (startHr[0] * 1000000000 + startHr[1]);
                    utilities.log("Creating ".concat(testSetup.scratchOrgAliasName, " took ").concat(time, " ticks (").concat(time / 1000, " seconds)"));
                    if (!((_a = result === null || result === void 0 ? void 0 : result.authFields) === null || _a === void 0 ? void 0 : _a.accessToken) || !result.orgId || !result.scratchOrgInfo.SignupEmail) {
                        throw new Error("In createDefaultScratchOrg(), result is missing required fields.\nAuth Fields: ".concat(result.authFields, "\nOrg ID: ").concat(result.orgId, "\nSign Up Email: ").concat(result.scratchOrgInfo.SignupEmail, "."));
                    }
                    testSetup.scratchOrgId = result.orgId;
                    // Run SFDX: Set a Default Org
                    utilities.log("".concat(testSetup.testSuiteSuffixName, " - selecting SFDX: Set a Default Org..."));
                    return [4 /*yield*/, utilities.setDefaultOrg(testSetup.scratchOrgAliasName)];
                case 2:
                    _b.sent();
                    return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(3))];
                case 3:
                    _b.sent();
                    return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Set a Default Org successfully ran', utilities.Duration.TEN_MINUTES)];
                case 4:
                    successNotificationWasFound = _b.sent();
                    if (!successNotificationWasFound) {
                        throw new Error('In createDefaultScratchOrg(), the notification of "SFDX: Set a Default Org successfully ran" was not found');
                    }
                    return [4 /*yield*/, utilities.getStatusBarItemWhichIncludes(testSetup.scratchOrgAliasName)];
                case 5:
                    scratchOrgStatusBarItem = _b.sent();
                    if (!scratchOrgStatusBarItem) {
                        throw new Error('In createDefaultScratchOrg(), getStatusBarItemWhichIncludes() returned a scratchOrgStatusBarItem with a value of null (or undefined)');
                    }
                    utilities.log("".concat(testSetup.testSuiteSuffixName, " - ...finished createDefaultScratchOrg()"));
                    utilities.log('');
                    return [2 /*return*/];
            }
        });
    });
}
function deleteScratchOrgInfo(testSetup) {
    return __awaiter(this, void 0, void 0, function () {
        var sfDataDeleteRecord, message;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!testSetup.scratchOrgId) return [3 /*break*/, 2];
                    return [4 /*yield*/, utilities.runCliCommand('data:delete:record', '--sobject', 'ScratchOrgInfo', '--where', "ScratchOrg=".concat(testSetup.scratchOrgId.slice(0, -3)), '--target-org', environmentSettings_1.EnvironmentSettings.getInstance().devHubAliasName)];
                case 1:
                    sfDataDeleteRecord = _a.sent();
                    if (sfDataDeleteRecord.exitCode > 0) {
                        message = "data delete record failed with exit code ".concat(sfDataDeleteRecord.exitCode, "\n stderr ").concat(sfDataDeleteRecord.stderr);
                        utilities.log(message);
                        throw new Error(message);
                    }
                    _a.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    });
}
