"use strict";
/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvironmentSettings = void 0;
var fs = require("fs");
var path_1 = require("path");
var constants_1 = require("./utilities/constants");
var EnvironmentSettings = /** @class */ (function () {
    function EnvironmentSettings() {
        this._vscodeVersion = 'latest';
        this._specFiles = [
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
        this._devHubAliasName = 'vscodeOrg';
        this._devHubUserName = 'svcideebot@salesforce.com';
        this._sfdxAuthUrl = process.env.SFDX_AUTH_URL;
        this._orgId = process.env.ORG_ID;
        this._extensionPath = (0, path_1.join)(__dirname, '..', '..', 'salesforcedx-vscode', 'extensions');
        this._startTime = new Date(Date.now()).toLocaleTimeString([], { timeStyle: 'short' });
        this._throttleFactor = 1;
        this._javaHome = process.env.JAVA_HOME;
        this._logLevel = 'info';
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
        this._logLevel = constants_1.LOG_LEVELS.some(function (l) { return l === process.env.E2E_LOG_LEVEL; })
            ? process.env.E2E_LOG_LEVEL
            : this._logLevel;
        this._javaHome = process.env.JAVA_HOME || this._javaHome;
        this.useExistingProject = process.env.USE_EXISTING_PROJECT_PATH;
    }
    EnvironmentSettings.getInstance = function () {
        if (!EnvironmentSettings._instance) {
            EnvironmentSettings._instance = new EnvironmentSettings();
        }
        return EnvironmentSettings._instance;
    };
    Object.defineProperty(EnvironmentSettings.prototype, "vscodeVersion", {
        get: function () {
            return this._vscodeVersion;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(EnvironmentSettings.prototype, "specFiles", {
        get: function () {
            return this._specFiles;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(EnvironmentSettings.prototype, "devHubAliasName", {
        get: function () {
            return this._devHubAliasName;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(EnvironmentSettings.prototype, "devHubUserName", {
        get: function () {
            return this._devHubUserName;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(EnvironmentSettings.prototype, "extensionPath", {
        get: function () {
            return this._extensionPath;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(EnvironmentSettings.prototype, "throttleFactor", {
        get: function () {
            return this._throttleFactor;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(EnvironmentSettings.prototype, "startTime", {
        get: function () {
            return this._startTime;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(EnvironmentSettings.prototype, "sfdxAuthUrl", {
        get: function () {
            return this._sfdxAuthUrl;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(EnvironmentSettings.prototype, "orgId", {
        get: function () {
            return this._orgId;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(EnvironmentSettings.prototype, "javaHome", {
        get: function () {
            return this._javaHome;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(EnvironmentSettings.prototype, "useExistingProject", {
        get: function () {
            return this._useExistingProject;
        },
        set: function (existingProject) {
            var projectPath = existingProject !== null && existingProject !== void 0 ? existingProject : process.env.USE_EXISTING_PROJECT_PATH;
            if (!projectPath) {
                this._useExistingProject = undefined;
                return;
            }
            if (!fs.existsSync(projectPath)) {
                throw new Error("Project path for \"".concat(projectPath, "\" does not exist"));
            }
            this._useExistingProject = projectPath;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(EnvironmentSettings.prototype, "logLevel", {
        get: function () {
            return this._logLevel;
        },
        enumerable: false,
        configurable: true
    });
    return EnvironmentSettings;
}());
exports.EnvironmentSettings = EnvironmentSettings;
