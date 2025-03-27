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
Object.defineProperty(exports, "__esModule", { value: true });
/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
const chai_1 = require("chai");
const mocha_steps_1 = require("mocha-steps");
const vscode_extension_tester_1 = require("vscode-extension-tester");
const testSetup_1 = require("../testSetup");
const utilities = __importStar(require("../utilities/index"));
describe('SOQL', async () => {
    let testSetup;
    const testReqConfig = {
        projectConfig: {
            projectShape: utilities.ProjectShapeOption.NEW
        },
        isOrgRequired: false,
        testSuiteSuffixName: 'SOQL'
    };
    (0, mocha_steps_1.step)('Set up the testing environment', async () => {
        testSetup = await testSetup_1.TestSetup.setUp(testReqConfig);
    });
    (0, mocha_steps_1.step)('SFDX: Create Query in SOQL Builder', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - SFDX: Create Query in SOQL Builder`);
        await utilities.pause(utilities.Duration.seconds(20));
        // Run SFDX: Create Query in SOQL Builder
        await utilities.executeQuickPick('SFDX: Create Query in SOQL Builder', utilities.Duration.seconds(3));
        // Verify the command took us to the soql builder
        const workbench = await utilities.getWorkbench();
        const editorView = workbench.getEditorView();
        const activeTab = await editorView.getActiveTab();
        const title = await activeTab?.getTitle();
        (0, chai_1.expect)(title).to.equal('untitled.soql');
    });
    (0, mocha_steps_1.step)('Switch Between SOQL Builder and Text Editor - from SOQL Builder', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Switch Between SOQL Builder and Text Editor - from SOQL Builder`);
        // Click Switch Between SOQL Builder and Text Editor
        const workbench = await utilities.getWorkbench();
        const editorView = workbench.getEditorView();
        const toggleSOQLButton = await editorView.getAction('Switch Between SOQL Builder and Text Editor');
        (0, chai_1.expect)(toggleSOQLButton).to.not.be.undefined;
        await toggleSOQLButton?.click();
        // Verify 'Switch Between SOQL Builder and Text Editor' took us to the soql builder
        const activeTab = await editorView.getActiveTab();
        const title = await activeTab?.getTitle();
        (0, chai_1.expect)(title).to.equal('untitled.soql');
        const openTabs = await editorView.getOpenEditorTitles();
        (0, chai_1.expect)(openTabs.length).to.equal(3);
        (0, chai_1.expect)(openTabs[1]).to.equal('untitled.soql');
        (0, chai_1.expect)(openTabs[2]).to.equal('untitled.soql');
    });
    (0, mocha_steps_1.step)('Switch Between SOQL Builder and Text Editor - from file', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Switch Between SOQL Builder and Text Editor - from file`);
        await utilities.reloadWindow(utilities.Duration.seconds(5));
        // Click Switch Between SOQL Builder and Text Editor
        const workbench = await utilities.getWorkbench();
        const editorView = workbench.getEditorView();
        const toggleSOQLButton = await editorView.getAction('Switch Between SOQL Builder and Text Editor');
        (0, chai_1.expect)(toggleSOQLButton).to.not.be.undefined;
    });
    (0, mocha_steps_1.xstep)('Verify the contents of the SOQL Builder', async () => {
        //TODO
    });
    (0, mocha_steps_1.xstep)('Create query in SOQL Builder', async () => {
        //TODO
    });
    (0, mocha_steps_1.xstep)('Verify the contents of the soql file', async () => {
        const expectedText = ['SELECT COUNT()', 'from Account'].join('\n');
        const workbench = await utilities.getWorkbench();
        const textEditor = await utilities.getTextEditor(workbench, 'countAccounts.soql');
        const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
        (0, chai_1.expect)(textGeneratedFromTemplate).to.be(expectedText);
    });
    (0, vscode_extension_tester_1.after)('Tear down and clean up the testing environment', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Tear down and clean up the testing environment`);
        await testSetup?.tearDown();
    });
});
//# sourceMappingURL=soql.e2e.js.map