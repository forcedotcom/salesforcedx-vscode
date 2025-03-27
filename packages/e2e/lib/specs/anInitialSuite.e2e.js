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
Object.defineProperty(exports, "__esModule", { value: true });
/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
const mocha_steps_1 = require("mocha-steps");
const testSetup_1 = require("../testSetup");
const utilities = __importStar(require("../utilities/index"));
const chai_1 = require("chai");
const vscode_extension_tester_1 = require("vscode-extension-tester");
/*
anInitialSuite.e2e.ts is a special case.  We want to validate that the Salesforce extensions and
most SFDX commands are not present at start up.

We also want to verify that after a project has been created, that the Salesforce extensions are loaded,
and that the SFDX commands are present.

Because of this requirement, this suite needs to run first before the other suites.  Since the
suites run in alphabetical order, this suite has been named so it runs first.

Please note that none of the other suites depend on this suite to run, it's just that if this
suite does run, it needs to run first.
*/
describe('An Initial Suite', async () => {
    const testReqConfig = {
        projectConfig: {
            projectShape: utilities.ProjectShapeOption.NEW
        },
        isOrgRequired: false,
        testSuiteSuffixName: 'AnInitialSuite'
    };
    let testSetup;
    (0, mocha_steps_1.step)('Verify our extensions are not initially loaded', async () => {
        await utilities.pause(utilities.Duration.seconds(20));
        await utilities.zoom('Out', 4, utilities.Duration.seconds(1));
        const foundSfExtensions = await utilities.findExtensionsInRunningExtensionsList(utilities.getExtensionsToVerifyActive().map(ext => ext.extensionId));
        await utilities.zoomReset();
        if (foundSfExtensions.length > 0) {
            foundSfExtensions.forEach(ext => {
                utilities.log(`AnInitialSuite - extension ${ext.extensionId} was present, but wasn't expected before the extensions loaded`);
            });
            throw new Error('AnInitialSuite - extension was found before the extensions loaded');
        }
    });
    (0, mocha_steps_1.step)('Verify the default SFDX commands are present when no project is loaded', async () => {
        const workbench = utilities.getWorkbench();
        const prompt = await utilities.openCommandPromptWithCommand(workbench, 'SFDX:');
        const quickPicks = await prompt.getQuickPicks();
        let expectedSfdxCommandsFound = 0;
        let unexpectedSfdxCommandWasFound = false;
        for (const quickPick of quickPicks) {
            const label = await quickPick.getLabel();
            switch (label) {
                // These three commands are expected to always be present,
                // even before the extensions have been loaded.
                case 'SFDX: Create and Set Up Project for ISV Debugging':
                case 'SFDX: Create Project':
                case 'SFDX: Create Project with Manifest':
                    expectedSfdxCommandsFound++;
                    break;
                default:
                    // And if any other SFDX commands are present, this is unexpected and is an issue.
                    unexpectedSfdxCommandWasFound = true;
                    utilities.log(`AnInitialSuite - command ${label} was present, but wasn't expected before the extensions loaded`);
                    break;
            }
        }
        (0, chai_1.expect)(expectedSfdxCommandsFound).to.be.equal(3);
        (0, chai_1.expect)(unexpectedSfdxCommandWasFound).to.be.false;
        // Escape out of the pick list.
        await prompt.cancel();
    });
    (0, mocha_steps_1.step)('Set up the testing environment', async () => {
        testSetup = await testSetup_1.TestSetup.setUp(testReqConfig);
    });
    (0, mocha_steps_1.step)('Verify that SFDX commands are present after an SFDX project has been created', async () => {
        const workbench = utilities.getWorkbench();
        const prompt = await utilities.openCommandPromptWithCommand(workbench, 'SFDX:');
        const quickPicks = await prompt.getQuickPicks();
        const commands = await Promise.all(quickPicks.map(quickPick => quickPick.getLabel()));
        // Look for the first few SFDX commands.
        (0, chai_1.expect)(commands).to.include('SFDX: Authorize a Dev Hub');
        (0, chai_1.expect)(commands).to.include('SFDX: Authorize an Org');
        (0, chai_1.expect)(commands).to.include('SFDX: Authorize an Org using Session ID');
        (0, chai_1.expect)(commands).to.include('SFDX: Cancel Active Command');
        (0, chai_1.expect)(commands).to.include('SFDX: Configure Apex Debug Exceptions');
        (0, chai_1.expect)(commands).to.include('SFDX: Create a Default Scratch Org...');
        (0, chai_1.expect)(commands).to.include('SFDX: Create and Set Up Project for ISV Debugging');
        (0, chai_1.expect)(commands).to.include('SFDX: Create Apex Class');
        (0, chai_1.expect)(commands).to.include('SFDX: Create Apex Trigger');
        // There are more, but just look for the first few commands.
        // Escape out of the pick list.
        await prompt.cancel();
    });
    (0, vscode_extension_tester_1.after)('Tear down and clean up the testing environment', async () => {
        await testSetup?.tearDown();
    });
});
//# sourceMappingURL=anInitialSuite.e2e.js.map