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
const chai_1 = require("chai");
const mocha_steps_1 = require("mocha-steps");
const path_1 = __importDefault(require("path"));
const vscode_extension_tester_1 = require("vscode-extension-tester");
const testSetup_1 = require("../testSetup");
const utilities = __importStar(require("../utilities/index"));
// In future we will merge the test together with deployAndRetrieve
describe('metadata mdDeployRetrieve', async () => {
    let testSetup;
    const testReqConfig = {
        projectConfig: {
            projectShape: utilities.ProjectShapeOption.NAMED,
            githubRepoUrl: 'https://github.com/mingxuanzhangsfdx/DeployInv.git'
        },
        isOrgRequired: true,
        testSuiteSuffixName: 'mdDeployRetrieve'
    };
    let mdPath;
    let textV1;
    let textV2;
    let textV2AfterRetrieve;
    (0, mocha_steps_1.step)('Set up the testing environment', async () => {
        utilities.log(`mdDeployRetrieve - Set up the testing environment`);
        testSetup = await testSetup_1.TestSetup.setUp(testReqConfig);
        mdPath = path_1.default.join(testSetup.projectFolderPath, 'force-app/main/default/objects/Account/fields/Deploy_Test__c.field-meta.xml');
    });
    (0, mocha_steps_1.step)('Open and deploy MD v1', async () => {
        utilities.log(`mdDeployRetrieve - Open and deploy MD v1`);
        await utilities.openFile(mdPath);
        textV1 = await utilities.attemptToFindTextEditorText(mdPath);
        await runAndValidateCommand('Deploy', 'to', 'ST');
        await utilities.clearOutputView();
        await utilities.closeAllEditors(); // close editor to make sure editor is up to date
    });
    (0, mocha_steps_1.step)('Update MD v2 and deploy again', async () => {
        utilities.log(`mdDeployRetrieve - Update MD v2 and deploy again`);
        await utilities.gitCheckout('updated-md', testSetup.projectFolderPath);
        await utilities.openFile(mdPath);
        textV2 = await utilities.attemptToFindTextEditorText(mdPath);
        (0, chai_1.expect)(textV1).not.to.equal(textV2); // MD file should be updated
        await runAndValidateCommand('Deploy', 'to', 'ST');
        await utilities.clearOutputView();
    });
    (0, mocha_steps_1.step)('Retrieve MD v2 and verify the text not changed', async () => {
        utilities.log(`mdDeployRetrieve - Retrieve MD v2 and verify the text not changed`);
        await utilities.openFile(mdPath);
        await runAndValidateCommand('Retrieve', 'from', 'ST');
        textV2AfterRetrieve = await utilities.attemptToFindTextEditorText(mdPath);
        (0, chai_1.expect)(textV2AfterRetrieve).to.contain(textV2); // should be same
    });
    (0, vscode_extension_tester_1.after)('Tear down and clean up the testing environment', async () => {
        utilities.log(`mdDeployRetrieve - Tear down and clean up the testing environment`);
        await utilities.gitCheckout('main', testSetup.projectFolderPath);
        await testSetup?.tearDown();
    });
    const runAndValidateCommand = async (operation, fromTo, type) => {
        utilities.log(`runAndValidateCommand()`);
        await utilities.executeQuickPick(`SFDX: ${operation} This Source ${fromTo} Org`, utilities.Duration.seconds(5));
        await validateCommand(operation, fromTo, type);
    };
    const validateCommand = async (operation, fromTo, type // Text to identify operation type (if it has source tracking enabled, disabled or if it was a deploy on save)
    ) => {
        utilities.log(`validateCommand()`);
        const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(`SFDX: ${operation} This Source ${fromTo} Org successfully ran`, utilities.Duration.TEN_MINUTES);
        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
        // Verify Output tab
        const outputPanelText = await utilities.attemptToFindOutputPanelText('Salesforce CLI', `Starting SFDX: ${operation} This Source ${fromTo}`, 10);
        utilities.log(`${operation} time ${type}: ` + (await utilities.getOperationTime(outputPanelText)));
        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
        (0, chai_1.expect)(outputPanelText).to.contain(`${operation}ed Source`.replace('Retrieveed', 'Retrieved'));
        (0, chai_1.expect)(outputPanelText).to.contain(`Account.Deploy_Test__c  CustomField`);
        (0, chai_1.expect)(outputPanelText).to.contain(`ended SFDX: ${operation} This Source ${fromTo} Org`);
    };
});
//# sourceMappingURL=metadataDeployRetrieve.e2e.js.map