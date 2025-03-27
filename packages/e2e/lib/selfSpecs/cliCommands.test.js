"use strict";
/*
 * Copyright (c) 2024, salesforce.com, inc.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const mocha_steps_1 = require("mocha-steps");
const environmentSettings_1 = require("../environmentSettings");
const utilities = __importStar(require("../utilities/index"));
const chai_1 = require("chai");
describe('CLI Commands', async () => {
    const environmentSettings = environmentSettings_1.EnvironmentSettings.getInstance();
    const devHubUserName = environmentSettings.devHubUserName;
    const devHubAliasName = environmentSettings.devHubAliasName;
    const SFDX_AUTH_URL = environmentSettings.sfdxAuthUrl;
    const orgId = environmentSettings.orgId;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let scratchOrg;
    (0, mocha_steps_1.step)('Authorize to Testing Org', async () => {
        const sfdxAuthUrl = String(SFDX_AUTH_URL);
        const authFilePath = 'authFile.txt';
        // create and write in a text file
        fs_1.default.writeFileSync(authFilePath, sfdxAuthUrl);
        const authorizeOrg = await utilities.orgLoginSfdxUrl(authFilePath);
        (0, chai_1.expect)(authorizeOrg.stdout).to.include(`Successfully authorized ${devHubUserName} with org ID ${orgId}`);
        const setAlias = await utilities.setAlias(devHubAliasName, devHubUserName);
        (0, chai_1.expect)(setAlias.stdout).to.include(devHubAliasName);
        (0, chai_1.expect)(setAlias.stdout).to.include(devHubUserName);
        (0, chai_1.expect)(setAlias.stdout).to.include('true');
    });
    (0, mocha_steps_1.step)('Create a scratch org', async () => {
        const scratchOrgResult = await utilities.scratchOrgCreate('developer', 'NONE', 'foo', 1);
        (0, chai_1.expect)(scratchOrgResult.exitCode).to.equal(0);
    });
    (0, mocha_steps_1.step)('Find scratch org using org list', async () => {
        const orgListResult = await utilities.orgList();
        (0, chai_1.expect)(orgListResult.exitCode).to.equal(0);
        const orgs = JSON.parse(orgListResult.stdout);
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        (0, chai_1.expect)(orgs).to.not.be.undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        scratchOrg = orgs.result.scratchOrgs.find((org) => org.alias === 'foo');
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        (0, chai_1.expect)(scratchOrg).to.not.be.undefined;
    });
    (0, mocha_steps_1.step)('Display org using org display', async () => {
        const orgDisplayResult = await utilities.orgDisplay('foo');
        const org = JSON.parse(orgDisplayResult.stdout);
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        (0, chai_1.expect)(org).to.not.be.undefined;
    });
    after('Delete the scratch org', async () => {
        if (scratchOrg) {
            await utilities.deleteScratchOrg('foo');
        }
    });
});
//# sourceMappingURL=cliCommands.test.js.map