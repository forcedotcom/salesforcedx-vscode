"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.TestSetup = void 0;
/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
var fs_1 = require("fs");
var path_1 = require("path");
var utilities = require("./utilities/index");
var environmentSettings_1 = require("./environmentSettings");
var index_1 = require("./utilities/index");
var TestSetup = /** @class */ (function () {
    function TestSetup() {
        this.testSuiteSuffixName = '';
        this.tempFolderPath = path_1.default.join(__dirname, '..', 'e2e-temp');
        this.aliasAndUserNameWereVerified = false;
    }
    Object.defineProperty(TestSetup.prototype, "tempProjectName", {
        get: function () {
            return 'TempProject-' + this.testSuiteSuffixName;
        },
        enumerable: false,
        configurable: true
    });
    TestSetup.setUp = function (testReqConfig) {
        return __awaiter(this, void 0, void 0, function () {
            var testSetup, scratchOrgEdition;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        testSetup = new TestSetup();
                        testSetup.testSuiteSuffixName = testReqConfig.testSuiteSuffixName;
                        utilities.log('');
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Starting TestSetup.setUp()..."));
                        /* The expected workspace will be open up after setUpTestingWorkspace */
                        return [4 /*yield*/, testSetup.setUpTestingWorkspace(testReqConfig.projectConfig)];
                    case 1:
                        /* The expected workspace will be open up after setUpTestingWorkspace */
                        _a.sent();
                        if (!(testReqConfig.projectConfig.projectShape !== index_1.ProjectShapeOption.NONE)) return [3 /*break*/, 6];
                        return [4 /*yield*/, utilities.verifyExtensionsAreRunning(utilities.getExtensionsToVerifyActive())];
                    case 2:
                        _a.sent();
                        scratchOrgEdition = testReqConfig.scratchOrgEdition || 'developer';
                        testSetup.updateScratchOrgDefWithEdition(scratchOrgEdition);
                        if (process.platform === 'darwin')
                            testSetup.setJavaHomeConfigEntry(); // Extra config needed for Apex LSP on GHA
                        if (!testReqConfig.isOrgRequired) return [3 /*break*/, 4];
                        return [4 /*yield*/, utilities.setUpScratchOrg(testSetup, scratchOrgEdition)];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4: return [4 /*yield*/, utilities.reloadAndEnableExtensions()];
                    case 5:
                        _a.sent(); // This is necessary in order to update JAVA home path
                        _a.label = 6;
                    case 6:
                        testSetup.setWorkbenchHoverDelay();
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - ...finished TestSetup.setUp()"));
                        return [2 /*return*/, testSetup];
                }
            });
        });
    };
    TestSetup.prototype.tearDown = function () {
        return __awaiter(this, arguments, void 0, function (checkForUncaughtErrors) {
            var error_1;
            if (checkForUncaughtErrors === void 0) { checkForUncaughtErrors = true; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!checkForUncaughtErrors) return [3 /*break*/, 2];
                        return [4 /*yield*/, utilities.checkForUncaughtErrors()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 5, , 6]);
                        return [4 /*yield*/, utilities.deleteScratchOrg(this.scratchOrgAliasName)];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, utilities.deleteScratchOrgInfo(this)];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        error_1 = _a.sent();
                        utilities.log("Deleting scratch org (or info) failed with Error: ".concat(error_1.message));
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    TestSetup.prototype.initializeNewSfProject = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!fs_1.default.existsSync(this.tempFolderPath)) {
                            utilities.createFolder(this.tempFolderPath);
                        }
                        return [4 /*yield*/, utilities.generateSfProject(this.tempProjectName, this.tempFolderPath)];
                    case 1:
                        _a.sent(); // generate a sf project for 'new'
                        this.projectFolderPath = path_1.default.join(this.tempFolderPath, this.tempProjectName);
                        return [2 /*return*/];
                }
            });
        });
    };
    TestSetup.prototype.setUpTestingWorkspace = function (projectConfig) {
        return __awaiter(this, void 0, void 0, function () {
            var projectName, _a, repoExists, repoName, localProjName;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        utilities.log("".concat(this.testSuiteSuffixName, " - Starting setUpTestingWorkspace()..."));
                        _a = projectConfig.projectShape;
                        switch (_a) {
                            case index_1.ProjectShapeOption.NEW: return [3 /*break*/, 1];
                            case index_1.ProjectShapeOption.NAMED: return [3 /*break*/, 3];
                            case index_1.ProjectShapeOption.ANY: return [3 /*break*/, 11];
                            case index_1.ProjectShapeOption.NONE: return [3 /*break*/, 15];
                        }
                        return [3 /*break*/, 16];
                    case 1: return [4 /*yield*/, this.initializeNewSfProject()];
                    case 2:
                        _b.sent();
                        return [3 /*break*/, 17];
                    case 3:
                        if (!projectConfig.githubRepoUrl) return [3 /*break*/, 9];
                        return [4 /*yield*/, utilities.gitRepoExists(projectConfig.githubRepoUrl)];
                    case 4:
                        repoExists = _b.sent();
                        if (!repoExists) {
                            this.throwError("Repository does not exist or is inaccessible: ".concat(projectConfig.githubRepoUrl));
                        }
                        repoName = utilities.getRepoNameFromUrl(projectConfig.githubRepoUrl);
                        if (!!repoName) return [3 /*break*/, 5];
                        this.throwError("Unable to determine repository name from URL: ".concat(projectConfig.githubRepoUrl));
                        return [3 /*break*/, 8];
                    case 5:
                        projectName = repoName;
                        if (!projectConfig.folderPath) return [3 /*break*/, 6];
                        localProjName = utilities.getFolderName(projectConfig.folderPath);
                        if (localProjName !== repoName) {
                            this.throwError("The local project ".concat(localProjName, " does not match the required Github repo ").concat(repoName));
                        }
                        else {
                            // If it is a match, use the local folder directly. Local dev use only.
                            this.projectFolderPath = projectConfig.folderPath;
                        }
                        return [3 /*break*/, 8];
                    case 6:
                        // Clone the project from Github URL directly
                        this.projectFolderPath = path_1.default.join(this.tempFolderPath, repoName);
                        return [4 /*yield*/, utilities.gitClone(projectConfig.githubRepoUrl, this.projectFolderPath)];
                    case 7:
                        _b.sent();
                        _b.label = 8;
                    case 8: return [3 /*break*/, 10];
                    case 9:
                        // missing info, throw an error
                        this.throwError("githubRepoUrl is required for named project shape");
                        _b.label = 10;
                    case 10: return [3 /*break*/, 17];
                    case 11:
                        if (!projectConfig.folderPath) return [3 /*break*/, 12];
                        this.projectFolderPath = projectConfig.folderPath;
                        projectName = utilities.getFolderName(projectConfig.folderPath);
                        return [3 /*break*/, 14];
                    case 12: 
                    // Fallback: if no folder specified, create a new sf project instead
                    return [4 /*yield*/, this.initializeNewSfProject()];
                    case 13:
                        // Fallback: if no folder specified, create a new sf project instead
                        _b.sent();
                        _b.label = 14;
                    case 14: return [3 /*break*/, 17];
                    case 15:
                        // NONE: no project open in the workspace by default
                        /* create the e2e-temp folder to benefit further testing */
                        this.projectFolderPath = path_1.default.join(this.tempFolderPath, this.tempProjectName);
                        if (!fs_1.default.existsSync(this.tempFolderPath)) {
                            utilities.createFolder(this.tempFolderPath);
                        }
                        return [3 /*break*/, 17];
                    case 16:
                        this.throwError("Invalid project shape: ".concat(projectConfig.projectShape));
                        _b.label = 17;
                    case 17:
                        if (![index_1.ProjectShapeOption.NAMED, index_1.ProjectShapeOption.NEW].includes(projectConfig.projectShape)) return [3 /*break*/, 20];
                        utilities.log("Project folder to open: ".concat(this.projectFolderPath));
                        return [4 /*yield*/, utilities.openFolder(this.projectFolderPath)];
                    case 18:
                        _b.sent();
                        // Verify the project was loaded.
                        return [4 /*yield*/, utilities.verifyProjectLoaded(projectName !== null && projectName !== void 0 ? projectName : this.tempProjectName)];
                    case 19:
                        // Verify the project was loaded.
                        _b.sent();
                        _b.label = 20;
                    case 20: return [2 /*return*/];
                }
            });
        });
    };
    TestSetup.prototype.throwError = function (message) {
        utilities.log(message);
        throw new Error(message);
    };
    TestSetup.prototype.updateScratchOrgDefWithEdition = function (scratchOrgEdition) {
        if (scratchOrgEdition === 'enterprise') {
            var projectScratchDefPath = path_1.default.join(this.projectFolderPath, 'config', 'project-scratch-def.json');
            var projectScratchDef = fs_1.default.readFileSync(projectScratchDefPath, 'utf8');
            projectScratchDef = projectScratchDef.replace("\"edition\": \"Developer\"", "\"edition\": \"Enterprise\"");
            fs_1.default.writeFileSync(projectScratchDefPath, projectScratchDef, 'utf8');
        }
    };
    TestSetup.prototype.setJavaHomeConfigEntry = function () {
        var vscodeSettingsPath = path_1.default.join(this.projectFolderPath, '.vscode', 'settings.json');
        if (!environmentSettings_1.EnvironmentSettings.getInstance().javaHome) {
            return;
        }
        if (!fs_1.default.existsSync(path_1.default.dirname(vscodeSettingsPath))) {
            fs_1.default.mkdirSync(path_1.default.dirname(vscodeSettingsPath), { recursive: true });
        }
        var settings = fs_1.default.existsSync(vscodeSettingsPath) ? JSON.parse(fs_1.default.readFileSync(vscodeSettingsPath, 'utf8')) : {};
        settings = __assign(__assign({}, settings), (process.env.JAVA_HOME ? { 'salesforcedx-vscode-apex.java.home': process.env.JAVA_HOME } : {}));
        fs_1.default.writeFileSync(vscodeSettingsPath, JSON.stringify(settings, null, 2), 'utf8');
        utilities.log("".concat(this.testSuiteSuffixName, " - Set 'salesforcedx-vscode-apex.java.home' to '").concat(process.env.JAVA_HOME, "' in ").concat(vscodeSettingsPath));
    };
    TestSetup.prototype.setWorkbenchHoverDelay = function () {
        var vscodeSettingsPath = path_1.default.join(this.projectFolderPath, '.vscode', 'settings.json');
        if (!fs_1.default.existsSync(path_1.default.dirname(vscodeSettingsPath))) {
            fs_1.default.mkdirSync(path_1.default.dirname(vscodeSettingsPath), { recursive: true });
        }
        var settings = fs_1.default.existsSync(vscodeSettingsPath) ? JSON.parse(fs_1.default.readFileSync(vscodeSettingsPath, 'utf8')) : {};
        // Update settings to set workbench.hover.delay
        settings = __assign(__assign({}, settings), { 'workbench.hover.delay': 300000 });
        fs_1.default.writeFileSync(vscodeSettingsPath, JSON.stringify(settings, null, 2), 'utf8');
        utilities.log("".concat(this.testSuiteSuffixName, " - Set 'workbench.hover.delay' to '300000' in ").concat(vscodeSettingsPath));
    };
    return TestSetup;
}());
exports.TestSetup = TestSetup;
