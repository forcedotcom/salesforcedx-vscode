"use strict";
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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
const chai_1 = require("chai");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const vscode_extension_tester_1 = require("vscode-extension-tester");
const codeUtil_1 = require("vscode-extension-tester/out/util/codeUtil");
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const environmentSettings_1 = require("./environmentSettings");
const utilities = __importStar(require("./utilities/index"));
const index_1 = require("./utilities/index");
class TestSetupAndRunner extends vscode_extension_tester_1.ExTester {
    spec;
    static _exTestor;
    constructor(extensionPath, spec) {
        super(extensionPath, codeUtil_1.ReleaseQuality.Stable, extensionPath);
        this.spec = spec;
    }
    async setup() {
        await this.downloadCode(environmentSettings_1.EnvironmentSettings.getInstance().vscodeVersion);
        await this.downloadChromeDriver(environmentSettings_1.EnvironmentSettings.getInstance().vscodeVersion);
        await this.installExtensions();
        await this.setupAndAuthorizeOrg();
    }
    async runTests() {
        const useExistingProject = environmentSettings_1.EnvironmentSettings.getInstance().useExistingProject;
        const resources = useExistingProject ? [useExistingProject] : [];
        return super.runTests(this.spec || environmentSettings_1.EnvironmentSettings.getInstance().specFiles, { resources });
    }
    async installExtension(extension) {
        utilities.log(`SetUp - Started Install extension ${path_1.default.basename(extension)}`);
        await this.installVsix({ useYarn: false, vsixFile: extension });
    }
    async installExtensions(excludeExtensions = []) {
        const extensionsDir = path_1.default.resolve(path_1.default.join(environmentSettings_1.EnvironmentSettings.getInstance().extensionPath));
        const extensionPattern = /^(?<publisher>.+?)\.(?<extensionId>.+?)-(?<version>\d+\.\d+\.\d+)(?:\.\d+)*$/;
        const extensionsDirEntries = (await promises_1.default.readdir(extensionsDir)).map(entry => path_1.default.resolve(extensionsDir, entry));
        const foundInstalledExtensions = await Promise.all(extensionsDirEntries
            .filter(async (entry) => {
            try {
                const stats = await promises_1.default.stat(entry);
                return stats.isDirectory();
            }
            catch (e) {
                utilities.log(`stat failed for file ${entry}`);
                return false;
            }
        })
            .map(entry => {
            const match = path_1.default.basename(entry).match(extensionPattern);
            if (match?.groups) {
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
            .filter(ext => index_1.extensions.find(refExt => {
            return refExt.extensionId === ext?.extensionId;
        })));
        if (foundInstalledExtensions.length > 0 &&
            foundInstalledExtensions.every(ext => index_1.extensions.find(refExt => refExt.extensionId === ext?.extensionId))) {
            utilities.log(`Found the following pre-installed extensions in dir ${extensionsDir}, skipping installation of vsix`);
            foundInstalledExtensions.forEach(ext => {
                utilities.log(`Extension ${ext?.extensionId} version ${ext?.version}`);
            });
            return;
        }
        const extensionsVsixs = utilities.getVsixFilesFromDir(extensionsDir);
        if (extensionsVsixs.length === 0) {
            throw new Error(`No vsix files were found in dir ${extensionsDir}`);
        }
        const mergeExcluded = Array.from(new Set([
            ...excludeExtensions,
            ...index_1.extensions.filter(ext => ext.shouldInstall === 'never').map(ext => ext.extensionId)
        ]));
        // Refactored part to use the extensions array
        extensionsVsixs.forEach(vsix => {
            const match = path_1.default.basename(vsix).match(/^(?<extension>.*?)(-(?<version>\d+\.\d+\.\d+))?\.vsix$/);
            if (match?.groups) {
                const { extension, version } = match.groups;
                const foundExtension = index_1.extensions.find(e => e.extensionId === extension);
                if (foundExtension) {
                    foundExtension.vsixPath = vsix;
                    // assign 'never' to this extension if its id is included in excluedExtensions
                    foundExtension.shouldInstall = mergeExcluded.includes(foundExtension.extensionId) ? 'never' : 'always';
                    // if not installing, don't verify, otherwise use default value
                    foundExtension.shouldVerifyActivation =
                        foundExtension.shouldInstall === 'never' ? false : foundExtension.shouldVerifyActivation;
                    utilities.log(`SetUp - Found extension ${extension} version ${version} with vsixPath ${foundExtension.vsixPath}`);
                }
            }
        });
        // Iterate over the extensions array to install extensions
        for (const extensionObj of index_1.extensions.filter(ext => ext.vsixPath !== '' && ext.shouldInstall !== 'never')) {
            await this.installExtension(extensionObj.vsixPath);
        }
    }
    async setupAndAuthorizeOrg() {
        const environmentSettings = environmentSettings_1.EnvironmentSettings.getInstance();
        const devHubUserName = environmentSettings.devHubUserName;
        const devHubAliasName = environmentSettings.devHubAliasName;
        const SFDX_AUTH_URL = environmentSettings.sfdxAuthUrl;
        const orgId = environmentSettings.orgId;
        const sfdxAuthUrl = String(SFDX_AUTH_URL);
        const authFilePath = 'authFile.txt';
        // Create and write the SFDX Auth URL in a text file
        await promises_1.default.writeFile(authFilePath, sfdxAuthUrl);
        // Step 1: Authorize to Testing Org
        const authorizeOrg = await utilities.orgLoginSfdxUrl(authFilePath);
        (0, chai_1.expect)(authorizeOrg.stdout).to.contain(`Successfully authorized ${devHubUserName} with org ID ${orgId}`);
        // Step 2: Set Alias for the Org
        const setAlias = await utilities.setAlias(devHubAliasName, devHubUserName);
        (0, chai_1.expect)(setAlias.stdout).to.contain(devHubAliasName);
        (0, chai_1.expect)(setAlias.stdout).to.contain(devHubUserName);
        (0, chai_1.expect)(setAlias.stdout).to.contain('true');
    }
    static get exTester() {
        if (TestSetupAndRunner.exTester) {
            return TestSetupAndRunner._exTestor;
        }
        TestSetupAndRunner._exTestor = new TestSetupAndRunner();
        return TestSetupAndRunner._exTestor;
    }
}
// Parse command-line arguments
const argv = (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
    .option('spec', {
    alias: 's',
    type: 'string',
    description: 'Glob pattern for test files',
    demandOption: false
})
    .help().argv;
const testSetupAnRunner = new TestSetupAndRunner(environmentSettings_1.EnvironmentSettings.getInstance().extensionPath, argv.spec);
async function run() {
    try {
        await testSetupAnRunner.setup();
        const result = await testSetupAnRunner.runTests();
        console.log(result);
        process.exit(result);
    }
    catch (error) {
        console.error(error);
        process.exit(1);
    }
}
run();
//# sourceMappingURL=test-setup-and-runner.js.map