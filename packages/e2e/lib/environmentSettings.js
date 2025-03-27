"use strict";
/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvironmentSettings = void 0;
const fs = __importStar(require("fs"));
const path_1 = require("path");
const constants_1 = require("./utilities/constants");
class EnvironmentSettings {
    static _instance;
    _vscodeVersion = 'latest';
    _specFiles = [
        './lib/specs/**/*.e2e.js'
        // OR
        // './lib/specs/**/anInitialSuite.e2e.js',
        // './lib/specs/**/apexLsp.e2e.js',
        // './lib/specs/**/apexReplayDebugger.e2e.js',
        // './lib/specs/**/auraLsp.e2e.js',
        // './lib/specs/**/authentication.e2e.js',
        // './lib/specs/**/debugApexTests.e2e.js',
        // './lib/specs/**/deployAndRetrieve.e2e.js',
        // './lib/specs/**/lwcLsp.e2e.js',
        // './lib/specs/**/manifestBuilder.e2e.js',
        // './lib/specs/**/orgBrowser.e2e.js',
        // './lib/specs/**/pushAndPull.e2e.js'
        // './lib/specs/**/runApexTests.e2e.js',
        // './lib/specs/**/sObjectsDefinitions.e2e.js',
        // './lib/specs/**/templates.e2e.js',
        // './lib/specs/**/trailApexReplayDebugger.e2e.js',
        // './lib/specs/**/visualforceLsp.e2e.js',
        // './lib/specs/**/sfdxProjectJson.e2e.js'
    ];
    _devHubAliasName = 'vscodeOrg';
    _devHubUserName = 'svcideebot@salesforce.com';
    _sfdxAuthUrl = process.env.SFDX_AUTH_URL;
    _orgId = process.env.ORG_ID;
    _extensionPath = (0, path_1.join)(__dirname, '..', '..', '..', 'extensions');
    _startTime = new Date(Date.now()).toLocaleTimeString([], { timeStyle: 'short' });
    _throttleFactor = 1;
    _javaHome = process.env.JAVA_HOME;
    _useExistingProject;
    _logLevel = 'info';
    constructor() {
        this._vscodeVersion = process.env.CODE_VERSION || this._vscodeVersion;
        if (process.env.SPEC_FILES) {
            this._specFiles = ['lib/specs/' + process.env.SPEC_FILES];
        }
        this._devHubAliasName = process.env.DEV_HUB_ALIAS_NAME || this._devHubAliasName;
        this._devHubUserName = process.env.DEV_HUB_USER_NAME || this._devHubUserName;
        this._extensionPath = process.env.EXTENSION_PATH || this._extensionPath;
        this._throttleFactor = parseInt(process.env.THROTTLE_FACTOR) || this._throttleFactor;
        this._sfdxAuthUrl = process.env.SFDX_AUTH_URL || this._sfdxAuthUrl;
        this._orgId = process.env.ORG_ID || this._orgId;
        this._extensionPath = process.env.SALESFORCEDX_VSCODE_EXTENSIONS_PATH || this._extensionPath;
        this._logLevel = constants_1.LOG_LEVELS.some(l => l === process.env.E2E_LOG_LEVEL)
            ? process.env.E2E_LOG_LEVEL
            : this._logLevel;
        this._javaHome = process.env.JAVA_HOME || this._javaHome;
        this.useExistingProject = process.env.USE_EXISTING_PROJECT_PATH;
    }
    static getInstance() {
        if (!EnvironmentSettings._instance) {
            EnvironmentSettings._instance = new EnvironmentSettings();
        }
        return EnvironmentSettings._instance;
    }
    get vscodeVersion() {
        return this._vscodeVersion;
    }
    get specFiles() {
        return this._specFiles;
    }
    get devHubAliasName() {
        return this._devHubAliasName;
    }
    get devHubUserName() {
        return this._devHubUserName;
    }
    get extensionPath() {
        return this._extensionPath;
    }
    get throttleFactor() {
        return this._throttleFactor;
    }
    get startTime() {
        return this._startTime;
    }
    get sfdxAuthUrl() {
        return this._sfdxAuthUrl;
    }
    get orgId() {
        return this._orgId;
    }
    get javaHome() {
        return this._javaHome;
    }
    get useExistingProject() {
        return this._useExistingProject;
    }
    set useExistingProject(existingProject) {
        const projectPath = existingProject ?? process.env.USE_EXISTING_PROJECT_PATH;
        if (!projectPath) {
            this._useExistingProject = undefined;
            return;
        }
        if (!fs.existsSync(projectPath)) {
            throw new Error(`Project path for "${projectPath}" does not exist`);
        }
        this._useExistingProject = projectPath;
    }
    get logLevel() {
        return this._logLevel;
    }
}
exports.EnvironmentSettings = EnvironmentSettings;
//# sourceMappingURL=environmentSettings.js.map