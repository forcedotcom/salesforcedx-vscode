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
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
const mocha_steps_1 = require("mocha-steps");
const testSetup_1 = require("../testSetup");
const utilities = __importStar(require("../utilities/index"));
const vscode_extension_tester_1 = require("vscode-extension-tester");
describe('SFDX: Create Project', async () => {
    let testSetup;
    const testReqConfig = {
        projectConfig: {
            projectShape: utilities.ProjectShapeOption.NONE
        },
        isOrgRequired: false,
        testSuiteSuffixName: 'sfdxCreateProject'
    };
    (0, mocha_steps_1.step)('Set up testing environment', async () => {
        testSetup = await testSetup_1.TestSetup.setUp(testReqConfig);
    });
    (0, mocha_steps_1.step)('Execute command SFDX: Create Project', async () => {
        utilities.log(`Starting command SFDX: Create Project...`);
        const prompt = await utilities.executeQuickPick('SFDX: Create Project');
        await utilities.waitForQuickPick(prompt, 'Standard', {
            msg: 'Expected extension salesforcedx-core to be available within 5 seconds',
            timeout: utilities.Duration.seconds(5)
        });
        // Enter the project's name.
        await utilities.pause(utilities.Duration.seconds(1));
        await prompt.setText(testSetup.tempProjectName);
        await utilities.pause(utilities.Duration.seconds(2));
        // Press Enter/Return.
        await prompt.confirm();
        // Set the location of the project.
        await prompt.setText(testSetup.tempFolderPath);
        await utilities.pause(utilities.Duration.seconds(2));
        await utilities.clickFilePathOkButton();
        await utilities.pause(utilities.Duration.seconds(2));
    });
    (0, mocha_steps_1.step)('Verify the project is created and open in the workspace', async () => {
        // Verify the project was created and was loaded.
        await utilities.verifyProjectLoaded(testSetup.tempProjectName);
    });
    (0, vscode_extension_tester_1.after)('Tear down and clean up the testing environment', async () => {
        await testSetup?.tearDown();
    });
});
//# sourceMappingURL=createProject.e2e.js.map