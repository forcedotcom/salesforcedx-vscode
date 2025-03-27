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
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
const mocha_steps_1 = require("mocha-steps");
const testSetup_1 = require("../testSetup");
const utilities = __importStar(require("../utilities/index"));
const path_1 = __importDefault(require("path"));
const chai_1 = require("chai");
const vscode_extension_tester_1 = require("vscode-extension-tester");
describe('Customize sfdx-project.json', async () => {
    let testSetup;
    const testReqConfig = {
        projectConfig: {
            projectShape: utilities.ProjectShapeOption.NEW
        },
        isOrgRequired: false,
        testSuiteSuffixName: 'sfdxProjectJson'
    };
    (0, mocha_steps_1.step)('Set up the testing environment', async () => {
        testSetup = await testSetup_1.TestSetup.setUp(testReqConfig);
        await createSfdxProjectJsonWithAllFields(testSetup);
        await utilities.reloadAndEnableExtensions();
    });
    (0, mocha_steps_1.step)('Verify our extensions are loaded after updating sfdx-project.json', async () => {
        (0, chai_1.expect)(await utilities.verifyExtensionsAreRunning(utilities.getExtensionsToVerifyActive())).to.equal(true);
    });
    (0, vscode_extension_tester_1.after)('Tear down and clean up the testing environment', async () => {
        await testSetup?.tearDown();
    });
});
async function createSfdxProjectJsonWithAllFields(testSetup) {
    const workbench = utilities.getWorkbench();
    const sfdxConfig = [
        `{`,
        `\t"packageDirectories": [`,
        `\t\t{`,
        `\t\t\t"path": "force-app",`,
        `\t\t\t"default": true`,
        `\t\t}`,
        `\t],`,
        `\t"namespace": "",`,
        `\t"sourceApiVersion": "61.0",`,
        `\t"sourceBehaviorOptions": ["decomposeCustomLabelsBeta", "decomposePermissionSetBeta", "decomposeWorkflowBeta", "decomposeSharingRulesBeta"]`,
        `}`
    ].join('\n');
    await utilities.openFile(path_1.default.join(testSetup.projectFolderPath, 'sfdx-project.json'));
    const textEditor = await utilities.getTextEditor(workbench, 'sfdx-project.json');
    await textEditor.setText(sfdxConfig);
    await textEditor.save();
    await utilities.pause();
}
//# sourceMappingURL=sfdxProjectJson.e2e.js.map