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
exports.setUpScratchOrg = setUpScratchOrg;
exports.authorizeDevHub = authorizeDevHub;
exports.deleteScratchOrgInfo = deleteScratchOrgInfo;
/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
const utilities = __importStar(require("./index"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const environmentSettings_1 = require("../environmentSettings");
async function setUpScratchOrg(testSetup, scratchOrgEdition) {
    await authorizeDevHub(testSetup);
    await createDefaultScratchOrg(testSetup, scratchOrgEdition);
}
async function authorizeDevHub(testSetup) {
    utilities.log('');
    utilities.log(`${testSetup.testSuiteSuffixName} - Starting authorizeDevHub()...`);
    // Only need to check this once.
    if (!testSetup.aliasAndUserNameWereVerified) {
        await verifyAliasAndUserName();
        testSetup.aliasAndUserNameWereVerified = true;
    }
    // This is essentially the "SFDX: Authorize a Dev Hub" command, but using the CLI and an auth file instead of the UI.
    const authFilePath = path_1.default.join(testSetup.projectFolderPath, 'authFile.json');
    utilities.log(`${testSetup.testSuiteSuffixName} - calling sf org:display...`);
    const sfOrgDisplayResult = await utilities.orgDisplay(environmentSettings_1.EnvironmentSettings.getInstance().devHubUserName);
    // Now write the file.
    fs_1.default.writeFileSync(authFilePath, sfOrgDisplayResult.stdout);
    utilities.log(`${testSetup.testSuiteSuffixName} - finished writing the file...`);
    // Call org:login:sfdx-url and read in the JSON that was just created.
    utilities.log(`${testSetup.testSuiteSuffixName} - calling sf org:login:sfdx-url...`);
    await utilities.orgLoginSfdxUrl(authFilePath);
    utilities.log(`${testSetup.testSuiteSuffixName} - ...finished authorizeDevHub()`);
    utilities.log('');
}
// verifyAliasAndUserName() verifies that the alias and user name are set,
// and also verifies there is a corresponding match in the org list.
async function verifyAliasAndUserName() {
    const environmentSettings = environmentSettings_1.EnvironmentSettings.getInstance();
    const devHubAliasName = environmentSettings.devHubAliasName;
    if (!devHubAliasName) {
        throw new Error('Error: devHubAliasName was not set.');
    }
    const devHubUserName = environmentSettings.devHubUserName;
    if (!devHubUserName) {
        throw new Error('Error: devHubUserName was not set.');
    }
    const execResult = await utilities.orgList();
    const sfOrgListResult = JSON.parse(execResult.stdout).result;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nonScratchOrgs = sfOrgListResult.nonScratchOrgs;
    for (let i = 0; i < nonScratchOrgs.length; i++) {
        const nonScratchOrg = nonScratchOrgs[i];
        if (nonScratchOrg.alias === devHubAliasName && nonScratchOrg.username === devHubUserName) {
            return;
        }
    }
    throw new Error(`Error: matching devHub alias '${devHubAliasName}' and devHub user name '${devHubUserName}' was not found.\nPlease consult README.md and make sure DEV_HUB_ALIAS_NAME and DEV_HUB_USER_NAME are set correctly.`);
}
async function createDefaultScratchOrg(testSetup, edition = 'developer') {
    utilities.log('');
    utilities.log(`${testSetup.testSuiteSuffixName} - Starting createDefaultScratchOrg()...`);
    const definitionFile = path_1.default.join(testSetup.projectFolderPath, 'config', 'project-scratch-def.json');
    utilities.debug(`${testSetup.testSuiteSuffixName} - constructing scratchOrgAliasName...`);
    // Org alias format: TempScratchOrg_yyyy_mm_dd_username_ticks_testSuiteSuffixName
    const currentDate = new Date();
    const day = currentDate.getDate().toString().padStart(2, '0');
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const year = currentDate.getFullYear();
    const currentOsUserName = utilities.transformedUserName();
    testSetup.scratchOrgAliasName = `TempScratchOrg_${year}_${month}_${day}_${currentOsUserName}_${currentDate.getTime()}_${testSetup.testSuiteSuffixName}`;
    utilities.log(`${testSetup.testSuiteSuffixName} - temporary scratch org name is ${testSetup.scratchOrgAliasName}...`);
    const startHr = process.hrtime();
    const sfOrgCreateResult = await utilities.scratchOrgCreate(edition, definitionFile, testSetup.scratchOrgAliasName, 1);
    utilities.debug(`${testSetup.testSuiteSuffixName} - calling JSON.parse()...`);
    const result = JSON.parse(sfOrgCreateResult.stdout).result;
    const endHr = process.hrtime(startHr);
    const time = endHr[0] * 1_000_000_000 + endHr[1] - (startHr[0] * 1_000_000_000 + startHr[1]);
    utilities.log(`Creating ${testSetup.scratchOrgAliasName} took ${time} ticks (${time / 1_000.0} seconds)`);
    if (!result?.authFields?.accessToken || !result.orgId || !result.scratchOrgInfo.SignupEmail) {
        throw new Error(`In createDefaultScratchOrg(), result is missing required fields.\nAuth Fields: ${result.authFields}\nOrg ID: ${result.orgId}\nSign Up Email: ${result.scratchOrgInfo.SignupEmail}.`);
    }
    testSetup.scratchOrgId = result.orgId;
    // Run SFDX: Set a Default Org
    utilities.log(`${testSetup.testSuiteSuffixName} - selecting SFDX: Set a Default Org...`);
    await utilities.setDefaultOrg(testSetup.scratchOrgAliasName);
    await utilities.pause(utilities.Duration.seconds(3));
    // Look for the success notification.
    const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout('SFDX: Set a Default Org successfully ran', utilities.Duration.TEN_MINUTES);
    if (!successNotificationWasFound) {
        throw new Error('In createDefaultScratchOrg(), the notification of "SFDX: Set a Default Org successfully ran" was not found');
    }
    // Look for this.scratchOrgAliasName in the list of status bar items.
    const scratchOrgStatusBarItem = await utilities.getStatusBarItemWhichIncludes(testSetup.scratchOrgAliasName);
    if (!scratchOrgStatusBarItem) {
        throw new Error('In createDefaultScratchOrg(), getStatusBarItemWhichIncludes() returned a scratchOrgStatusBarItem with a value of null (or undefined)');
    }
    utilities.log(`${testSetup.testSuiteSuffixName} - ...finished createDefaultScratchOrg()`);
    utilities.log('');
}
async function deleteScratchOrgInfo(testSetup) {
    if (testSetup.scratchOrgId) {
        const sfDataDeleteRecord = await utilities.runCliCommand('data:delete:record', '--sobject', 'ScratchOrgInfo', '--where', `ScratchOrg=${testSetup.scratchOrgId.slice(0, -3)}`, '--target-org', environmentSettings_1.EnvironmentSettings.getInstance().devHubAliasName);
        if (sfDataDeleteRecord.exitCode > 0) {
            const message = `data delete record failed with exit code ${sfDataDeleteRecord.exitCode}\n stderr ${sfDataDeleteRecord.stderr}`;
            utilities.log(message);
            throw new Error(message);
        }
    }
}
//# sourceMappingURL=authorization.js.map