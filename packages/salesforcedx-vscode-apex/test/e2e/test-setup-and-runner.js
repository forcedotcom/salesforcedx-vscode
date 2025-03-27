"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
var chai_1 = require("chai");
var promises_1 = require("fs/promises");
var path_1 = require("path");
var vscode_extension_tester_1 = require("vscode-extension-tester");
var codeUtil_1 = require("vscode-extension-tester/out/util/codeUtil");
var yargs_1 = require("yargs");
var helpers_1 = require("yargs/helpers");
var environmentSettings_1 = require("./environmentSettings");
var utilities = require("./utilities/index");
var index_1 = require("./utilities/index");
var TestSetupAndRunner = /** @class */ (function (_super) {
    __extends(TestSetupAndRunner, _super);
    function TestSetupAndRunner(extensionPath, spec) {
        var _this = _super.call(this, extensionPath, codeUtil_1.ReleaseQuality.Stable, extensionPath) || this;
        _this.spec = spec;
        return _this;
    }
    TestSetupAndRunner.prototype.setup = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.downloadCode(environmentSettings_1.EnvironmentSettings.getInstance().vscodeVersion)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.downloadChromeDriver(environmentSettings_1.EnvironmentSettings.getInstance().vscodeVersion)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, this.installExtensions()];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, this.setupAndAuthorizeOrg()];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    TestSetupAndRunner.prototype.runTests = function () {
        return __awaiter(this, void 0, void 0, function () {
            var useExistingProject, resources;
            return __generator(this, function (_a) {
                useExistingProject = environmentSettings_1.EnvironmentSettings.getInstance().useExistingProject;
                resources = useExistingProject ? [useExistingProject] : [];
                return [2 /*return*/, _super.prototype.runTests.call(this, this.spec || environmentSettings_1.EnvironmentSettings.getInstance().specFiles, { resources: resources })];
            });
        });
    };
    TestSetupAndRunner.prototype.installExtension = function (extension) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("SetUp - Started Install extension ".concat(path_1.default.basename(extension)));
                        return [4 /*yield*/, this.installVsix({ useYarn: false, vsixFile: extension })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    TestSetupAndRunner.prototype.installExtensions = function () {
        return __awaiter(this, arguments, void 0, function (excludeExtensions) {
            var extensionsDir, extensionPattern, extensionsDirEntries, foundInstalledExtensions, extensionsVsixs, mergeExcluded, _i, _a, extensionObj;
            var _this = this;
            if (excludeExtensions === void 0) { excludeExtensions = []; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        extensionsDir = path_1.default.resolve(path_1.default.join(environmentSettings_1.EnvironmentSettings.getInstance().extensionPath));
                        extensionPattern = /^(?<publisher>.+?)\.(?<extensionId>.+?)-(?<version>\d+\.\d+\.\d+)(?:\.\d+)*$/;
                        return [4 /*yield*/, promises_1.default.readdir(extensionsDir)];
                    case 1:
                        extensionsDirEntries = (_b.sent()).map(function (entry) { return path_1.default.resolve(extensionsDir, entry); });
                        return [4 /*yield*/, Promise.all(extensionsDirEntries
                                .filter(function (entry) { return __awaiter(_this, void 0, void 0, function () {
                                var stats, e_1;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            _a.trys.push([0, 2, , 3]);
                                            return [4 /*yield*/, promises_1.default.stat(entry)];
                                        case 1:
                                            stats = _a.sent();
                                            return [2 /*return*/, stats.isDirectory()];
                                        case 2:
                                            e_1 = _a.sent();
                                            utilities.log("stat failed for file ".concat(entry));
                                            return [2 /*return*/, false];
                                        case 3: return [2 /*return*/];
                                    }
                                });
                            }); })
                                .map(function (entry) {
                                var match = path_1.default.basename(entry).match(extensionPattern);
                                if (match === null || match === void 0 ? void 0 : match.groups) {
                                    return {
                                        publisher: match.groups.publisher,
                                        extensionId: match.groups.extensionId,
                                        version: match.groups.version,
                                        path: entry
                                    };
                                }
                                return null;
                            })
                                .filter(Boolean)
                                .filter(function (ext) {
                                return index_1.extensions.find(function (refExt) {
                                    return refExt.extensionId === (ext === null || ext === void 0 ? void 0 : ext.extensionId);
                                });
                            }))];
                    case 2:
                        foundInstalledExtensions = _b.sent();
                        if (foundInstalledExtensions.length > 0 &&
                            foundInstalledExtensions.every(function (ext) { return index_1.extensions.find(function (refExt) { return refExt.extensionId === (ext === null || ext === void 0 ? void 0 : ext.extensionId); }); })) {
                            utilities.log("Found the following pre-installed extensions in dir ".concat(extensionsDir, ", skipping installation of vsix"));
                            foundInstalledExtensions.forEach(function (ext) {
                                utilities.log("Extension ".concat(ext === null || ext === void 0 ? void 0 : ext.extensionId, " version ").concat(ext === null || ext === void 0 ? void 0 : ext.version));
                            });
                            return [2 /*return*/];
                        }
                        extensionsVsixs = utilities.getVsixFilesFromDir(extensionsDir);
                        if (extensionsVsixs.length === 0) {
                            throw new Error("No vsix files were found in dir ".concat(extensionsDir));
                        }
                        mergeExcluded = Array.from(new Set(__spreadArray(__spreadArray([], excludeExtensions, true), index_1.extensions.filter(function (ext) { return ext.shouldInstall === 'never'; }).map(function (ext) { return ext.extensionId; }), true)));
                        // Refactored part to use the extensions array
                        extensionsVsixs.forEach(function (vsix) {
                            var match = path_1.default.basename(vsix).match(/^(?<extension>.*?)(-(?<version>\d+\.\d+\.\d+))?\.vsix$/);
                            if (match === null || match === void 0 ? void 0 : match.groups) {
                                var _a = match.groups, extension_1 = _a.extension, version = _a.version;
                                var foundExtension = index_1.extensions.find(function (e) { return e.extensionId === extension_1; });
                                if (foundExtension) {
                                    foundExtension.vsixPath = vsix;
                                    // assign 'never' to this extension if its id is included in excluedExtensions
                                    foundExtension.shouldInstall = mergeExcluded.includes(foundExtension.extensionId) ? 'never' : 'always';
                                    // if not installing, don't verify, otherwise use default value
                                    foundExtension.shouldVerifyActivation =
                                        foundExtension.shouldInstall === 'never' ? false : foundExtension.shouldVerifyActivation;
                                    utilities.log("SetUp - Found extension ".concat(extension_1, " version ").concat(version, " with vsixPath ").concat(foundExtension.vsixPath));
                                }
                            }
                        });
                        _i = 0, _a = index_1.extensions.filter(function (ext) { return ext.vsixPath !== '' && ext.shouldInstall !== 'never'; });
                        _b.label = 3;
                    case 3:
                        if (!(_i < _a.length)) return [3 /*break*/, 6];
                        extensionObj = _a[_i];
                        return [4 /*yield*/, this.installExtension(extensionObj.vsixPath)];
                    case 4:
                        _b.sent();
                        _b.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 3];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    TestSetupAndRunner.prototype.setupAndAuthorizeOrg = function () {
        return __awaiter(this, void 0, void 0, function () {
            var environmentSettings, devHubUserName, devHubAliasName, SFDX_AUTH_URL, orgId, sfdxAuthUrl, authFilePath, authorizeOrg, setAlias;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        environmentSettings = environmentSettings_1.EnvironmentSettings.getInstance();
                        devHubUserName = environmentSettings.devHubUserName;
                        devHubAliasName = environmentSettings.devHubAliasName;
                        SFDX_AUTH_URL = environmentSettings.sfdxAuthUrl;
                        orgId = environmentSettings.orgId;
                        sfdxAuthUrl = String(SFDX_AUTH_URL);
                        authFilePath = 'authFile.txt';
                        // Create and write the SFDX Auth URL in a text file
                        return [4 /*yield*/, promises_1.default.writeFile(authFilePath, sfdxAuthUrl)];
                    case 1:
                        // Create and write the SFDX Auth URL in a text file
                        _a.sent();
                        return [4 /*yield*/, utilities.orgLoginSfdxUrl(authFilePath)];
                    case 2:
                        authorizeOrg = _a.sent();
                        (0, chai_1.expect)(authorizeOrg.stdout).to.contain("Successfully authorized ".concat(devHubUserName, " with org ID ").concat(orgId));
                        return [4 /*yield*/, utilities.setAlias(devHubAliasName, devHubUserName)];
                    case 3:
                        setAlias = _a.sent();
                        (0, chai_1.expect)(setAlias.stdout).to.contain(devHubAliasName);
                        (0, chai_1.expect)(setAlias.stdout).to.contain(devHubUserName);
                        (0, chai_1.expect)(setAlias.stdout).to.contain('true');
                        return [2 /*return*/];
                }
            });
        });
    };
    Object.defineProperty(TestSetupAndRunner, "exTester", {
        get: function () {
            if (TestSetupAndRunner.exTester) {
                return TestSetupAndRunner._exTestor;
            }
            TestSetupAndRunner._exTestor = new TestSetupAndRunner();
            return TestSetupAndRunner._exTestor;
        },
        enumerable: false,
        configurable: true
    });
    return TestSetupAndRunner;
}(vscode_extension_tester_1.ExTester));
// Parse command-line arguments
var argv = (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
    .option('spec', {
    alias: 's',
    type: 'string',
    description: 'Glob pattern for test files',
    demandOption: false
})
    .help().argv;
var testSetupAnRunner = new TestSetupAndRunner(environmentSettings_1.EnvironmentSettings.getInstance().extensionPath, argv.spec);
function run() {
    return __awaiter(this, void 0, void 0, function () {
        var result, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, testSetupAnRunner.setup()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, testSetupAnRunner.runTests()];
                case 2:
                    result = _a.sent();
                    console.log(result);
                    process.exit(result);
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    console.error(error_1);
                    process.exit(1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
run();
