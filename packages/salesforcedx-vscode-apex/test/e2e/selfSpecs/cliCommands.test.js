"use strict";
/*
 * Copyright (c) 2024, salesforce.com, inc.
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
var fs_1 = require("fs");
var mocha_steps_1 = require("mocha-steps");
var environmentSettings_1 = require("../environmentSettings");
var utilities = require("../utilities/index");
var chai_1 = require("chai");
describe('CLI Commands', function () { return __awaiter(void 0, void 0, void 0, function () {
    var environmentSettings, devHubUserName, devHubAliasName, SFDX_AUTH_URL, orgId, scratchOrg;
    return __generator(this, function (_a) {
        environmentSettings = environmentSettings_1.EnvironmentSettings.getInstance();
        devHubUserName = environmentSettings.devHubUserName;
        devHubAliasName = environmentSettings.devHubAliasName;
        SFDX_AUTH_URL = environmentSettings.sfdxAuthUrl;
        orgId = environmentSettings.orgId;
        (0, mocha_steps_1.step)('Authorize to Testing Org', function () { return __awaiter(void 0, void 0, void 0, function () {
            var sfdxAuthUrl, authFilePath, authorizeOrg, setAlias;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        sfdxAuthUrl = String(SFDX_AUTH_URL);
                        authFilePath = 'authFile.txt';
                        // create and write in a text file
                        fs_1.default.writeFileSync(authFilePath, sfdxAuthUrl);
                        return [4 /*yield*/, utilities.orgLoginSfdxUrl(authFilePath)];
                    case 1:
                        authorizeOrg = _a.sent();
                        (0, chai_1.expect)(authorizeOrg.stdout).to.include("Successfully authorized ".concat(devHubUserName, " with org ID ").concat(orgId));
                        return [4 /*yield*/, utilities.setAlias(devHubAliasName, devHubUserName)];
                    case 2:
                        setAlias = _a.sent();
                        (0, chai_1.expect)(setAlias.stdout).to.include(devHubAliasName);
                        (0, chai_1.expect)(setAlias.stdout).to.include(devHubUserName);
                        (0, chai_1.expect)(setAlias.stdout).to.include('true');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Create a scratch org', function () { return __awaiter(void 0, void 0, void 0, function () {
            var scratchOrgResult;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, utilities.scratchOrgCreate('developer', 'NONE', 'foo', 1)];
                    case 1:
                        scratchOrgResult = _a.sent();
                        (0, chai_1.expect)(scratchOrgResult.exitCode).to.equal(0);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Find scratch org using org list', function () { return __awaiter(void 0, void 0, void 0, function () {
            var orgListResult, orgs;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, utilities.orgList()];
                    case 1:
                        orgListResult = _a.sent();
                        (0, chai_1.expect)(orgListResult.exitCode).to.equal(0);
                        orgs = JSON.parse(orgListResult.stdout);
                        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                        (0, chai_1.expect)(orgs).to.not.be.undefined;
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        scratchOrg = orgs.result.scratchOrgs.find(function (org) { return org.alias === 'foo'; });
                        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                        (0, chai_1.expect)(scratchOrg).to.not.be.undefined;
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Display org using org display', function () { return __awaiter(void 0, void 0, void 0, function () {
            var orgDisplayResult, org;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, utilities.orgDisplay('foo')];
                    case 1:
                        orgDisplayResult = _a.sent();
                        org = JSON.parse(orgDisplayResult.stdout);
                        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                        (0, chai_1.expect)(org).to.not.be.undefined;
                        return [2 /*return*/];
                }
            });
        }); });
        after('Delete the scratch org', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!scratchOrg) return [3 /*break*/, 2];
                        return [4 /*yield*/, utilities.deleteScratchOrg('foo')];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        }); });
        return [2 /*return*/];
    });
}); });
