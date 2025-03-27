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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestSetup = void 0;
/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const utilities = __importStar(require("./utilities/index"));
const environmentSettings_1 = require("./environmentSettings");
const index_1 = require("./utilities/index");
class TestSetup {
    testSuiteSuffixName = '';
    tempFolderPath = path_1.default.join(__dirname, '..', 'e2e-temp');
    projectFolderPath;
    aliasAndUserNameWereVerified = false;
    scratchOrgAliasName;
    scratchOrgId;
    constructor() { }
    get tempProjectName() {
        return 'TempProject-' + this.testSuiteSuffixName;
    }
    static async setUp(testReqConfig) {
        const testSetup = new TestSetup();
        testSetup.testSuiteSuffixName = testReqConfig.testSuiteSuffixName;
        utilities.log('');
        utilities.log(`${testSetup.testSuiteSuffixName} - Starting TestSetup.setUp()...`);
        /* The expected workspace will be open up after setUpTestingWorkspace */
        await testSetup.setUpTestingWorkspace(testReqConfig.projectConfig);
        if (testReqConfig.projectConfig.projectShape !== index_1.ProjectShapeOption.NONE) {
            await utilities.verifyExtensionsAreRunning(utilities.getExtensionsToVerifyActive());
            const scratchOrgEdition = testReqConfig.scratchOrgEdition || 'developer';
            testSetup.updateScratchOrgDefWithEdition(scratchOrgEdition);
            if (process.platform === 'darwin')
                testSetup.setJavaHomeConfigEntry(); // Extra config needed for Apex LSP on GHA
            if (testReqConfig.isOrgRequired)
                await utilities.setUpScratchOrg(testSetup, scratchOrgEdition);
            await utilities.reloadAndEnableExtensions(); // This is necessary in order to update JAVA home path
        }
        testSetup.setWorkbenchHoverDelay();
        utilities.log(`${testSetup.testSuiteSuffixName} - ...finished TestSetup.setUp()`);
        return testSetup;
    }
    async tearDown(checkForUncaughtErrors = true) {
        if (checkForUncaughtErrors)
            await utilities.checkForUncaughtErrors();
        try {
            await utilities.deleteScratchOrg(this.scratchOrgAliasName);
            await utilities.deleteScratchOrgInfo(this);
        }
        catch (error) {
            utilities.log(`Deleting scratch org (or info) failed with Error: ${error.message}`);
        }
    }
    async initializeNewSfProject() {
        if (!fs_1.default.existsSync(this.tempFolderPath)) {
            utilities.createFolder(this.tempFolderPath);
        }
        await utilities.generateSfProject(this.tempProjectName, this.tempFolderPath); // generate a sf project for 'new'
        this.projectFolderPath = path_1.default.join(this.tempFolderPath, this.tempProjectName);
    }
    async setUpTestingWorkspace(projectConfig) {
        utilities.log(`${this.testSuiteSuffixName} - Starting setUpTestingWorkspace()...`);
        let projectName;
        switch (projectConfig.projectShape) {
            case index_1.ProjectShapeOption.NEW:
                await this.initializeNewSfProject();
                break;
            case index_1.ProjectShapeOption.NAMED:
                if (projectConfig.githubRepoUrl) {
                    // verify if folder matches the github repo url
                    const repoExists = await utilities.gitRepoExists(projectConfig.githubRepoUrl);
                    if (!repoExists) {
                        this.throwError(`Repository does not exist or is inaccessible: ${projectConfig.githubRepoUrl}`);
                    }
                    const repoName = utilities.getRepoNameFromUrl(projectConfig.githubRepoUrl);
                    if (!repoName) {
                        this.throwError(`Unable to determine repository name from URL: ${projectConfig.githubRepoUrl}`);
                    }
                    else {
                        projectName = repoName;
                        if (projectConfig.folderPath) {
                            const localProjName = utilities.getFolderName(projectConfig.folderPath);
                            if (localProjName !== repoName) {
                                this.throwError(`The local project ${localProjName} does not match the required Github repo ${repoName}`);
                            }
                            else {
                                // If it is a match, use the local folder directly. Local dev use only.
                                this.projectFolderPath = projectConfig.folderPath;
                            }
                        }
                        else {
                            // Clone the project from Github URL directly
                            this.projectFolderPath = path_1.default.join(this.tempFolderPath, repoName);
                            await utilities.gitClone(projectConfig.githubRepoUrl, this.projectFolderPath);
                        }
                    }
                }
                else {
                    // missing info, throw an error
                    this.throwError(`githubRepoUrl is required for named project shape`);
                }
                break;
            case index_1.ProjectShapeOption.ANY:
                // ANY: workspace is designated to open when wdio is initialized
                if (projectConfig.folderPath) {
                    this.projectFolderPath = projectConfig.folderPath;
                    projectName = utilities.getFolderName(projectConfig.folderPath);
                }
                else {
                    // Fallback: if no folder specified, create a new sf project instead
                    await this.initializeNewSfProject();
                }
                break;
            case index_1.ProjectShapeOption.NONE:
                // NONE: no project open in the workspace by default
                /* create the e2e-temp folder to benefit further testing */
                this.projectFolderPath = path_1.default.join(this.tempFolderPath, this.tempProjectName);
                if (!fs_1.default.existsSync(this.tempFolderPath)) {
                    utilities.createFolder(this.tempFolderPath);
                }
                break;
            default:
                this.throwError(`Invalid project shape: ${projectConfig.projectShape}`);
        }
        if ([index_1.ProjectShapeOption.NAMED, index_1.ProjectShapeOption.NEW].includes(projectConfig.projectShape)) {
            utilities.log(`Project folder to open: ${this.projectFolderPath}`);
            console.log('Daphne A', this.projectFolderPath);
            await utilities.openFolder(this.projectFolderPath);
            console.log('Daphne B', this.projectFolderPath);
            // Verify the project was loaded.
            await utilities.verifyProjectLoaded(projectName ?? this.tempProjectName);
            console.log('Daphne C', this.projectFolderPath);
        }
    }
    throwError(message) {
        utilities.log(message);
        throw new Error(message);
    }
    updateScratchOrgDefWithEdition(scratchOrgEdition) {
        if (scratchOrgEdition === 'enterprise') {
            const projectScratchDefPath = path_1.default.join(this.projectFolderPath, 'config', 'project-scratch-def.json');
            let projectScratchDef = fs_1.default.readFileSync(projectScratchDefPath, 'utf8');
            projectScratchDef = projectScratchDef.replace(`"edition": "Developer"`, `"edition": "Enterprise"`);
            fs_1.default.writeFileSync(projectScratchDefPath, projectScratchDef, 'utf8');
        }
    }
    setJavaHomeConfigEntry() {
        const vscodeSettingsPath = path_1.default.join(this.projectFolderPath, '.vscode', 'settings.json');
        if (!environmentSettings_1.EnvironmentSettings.getInstance().javaHome) {
            return;
        }
        if (!fs_1.default.existsSync(path_1.default.dirname(vscodeSettingsPath))) {
            fs_1.default.mkdirSync(path_1.default.dirname(vscodeSettingsPath), { recursive: true });
        }
        let settings = fs_1.default.existsSync(vscodeSettingsPath) ? JSON.parse(fs_1.default.readFileSync(vscodeSettingsPath, 'utf8')) : {};
        settings = {
            ...settings,
            ...(process.env.JAVA_HOME ? { 'salesforcedx-vscode-apex.java.home': process.env.JAVA_HOME } : {})
        };
        fs_1.default.writeFileSync(vscodeSettingsPath, JSON.stringify(settings, null, 2), 'utf8');
        utilities.log(`${this.testSuiteSuffixName} - Set 'salesforcedx-vscode-apex.java.home' to '${process.env.JAVA_HOME}' in ${vscodeSettingsPath}`);
    }
    setWorkbenchHoverDelay() {
        const vscodeSettingsPath = path_1.default.join(this.projectFolderPath, '.vscode', 'settings.json');
        if (!fs_1.default.existsSync(path_1.default.dirname(vscodeSettingsPath))) {
            fs_1.default.mkdirSync(path_1.default.dirname(vscodeSettingsPath), { recursive: true });
        }
        let settings = fs_1.default.existsSync(vscodeSettingsPath) ? JSON.parse(fs_1.default.readFileSync(vscodeSettingsPath, 'utf8')) : {};
        // Update settings to set workbench.hover.delay
        settings = {
            ...settings,
            'workbench.hover.delay': 300000
        };
        fs_1.default.writeFileSync(vscodeSettingsPath, JSON.stringify(settings, null, 2), 'utf8');
        utilities.log(`${this.testSuiteSuffixName} - Set 'workbench.hover.delay' to '300000' in ${vscodeSettingsPath}`);
    }
}
exports.TestSetup = TestSetup;
//# sourceMappingURL=testSetup.js.map