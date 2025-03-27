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
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
const mocha_steps_1 = require("mocha-steps");
const testSetup_1 = require("../testSetup");
const utilities = __importStar(require("../utilities/index"));
const vscode_extension_tester_1 = require("vscode-extension-tester");
const chai_1 = require("chai");
describe('Aura LSP', async () => {
    let testSetup;
    const testReqConfig = {
        projectConfig: {
            projectShape: utilities.ProjectShapeOption.NEW
        },
        isOrgRequired: false,
        testSuiteSuffixName: 'AuraLsp'
    };
    (0, mocha_steps_1.step)('Set up the testing environment', async () => {
        utilities.log('AuraLsp - Set up the testing environment');
        testSetup = await testSetup_1.TestSetup.setUp(testReqConfig);
        // Create Aura Component
        await utilities.createAura('aura1');
        // Reload the VSCode window to allow the Aura Component to be indexed by the Aura Language Server
        await utilities.reloadWindow(utilities.Duration.seconds(20));
    });
    (0, mocha_steps_1.step)('Verify LSP finished indexing', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Verify LSP finished indexing`);
        // Get output text from the LSP
        const outputViewText = await utilities.getOutputViewText('Aura Language Server');
        (0, chai_1.expect)(outputViewText).to.contain('language server started');
        utilities.log('Output view text');
        utilities.log(outputViewText);
    });
    (0, mocha_steps_1.step)('Go to Definition', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Go to Definition`);
        // Get open text editor
        const workbench = await utilities.getWorkbench();
        const textEditor = await utilities.getTextEditor(workbench, 'aura1.cmp');
        // Move cursor to the middle of "simpleNewContact"
        await textEditor.moveCursor(8, 15);
        // Go to definition through F12
        await utilities.executeQuickPick('Go to Definition', utilities.Duration.seconds(2));
        // Verify 'Go to definition'
        const definition = await textEditor.getCoordinates();
        (0, chai_1.expect)(definition[0]).to.equal(3);
        (0, chai_1.expect)(definition[1]).to.equal(27);
    });
    (0, mocha_steps_1.step)('Autocompletion', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Autocompletion`);
        // Get open text editor
        const workbench = await utilities.getWorkbench();
        const textEditor = await utilities.getTextEditor(workbench, 'aura1.cmp');
        await textEditor.typeTextAt(2, 1, '<aura:appl');
        await utilities.pause(utilities.Duration.seconds(1));
        // Verify autocompletion options are present
        const autocompletionOptions = await workbench.findElements(vscode_extension_tester_1.By.css('div.monaco-list-row.show-file-icons'));
        const ariaLabel = await autocompletionOptions[0].getAttribute('aria-label');
        (0, chai_1.expect)(ariaLabel).to.contain('aura:application');
        // Verify autocompletion options can be selected and therefore automatically inserted into the file
        await autocompletionOptions[0].click();
        await textEditor.typeText('>');
        await textEditor.save();
        await utilities.pause(utilities.Duration.seconds(1));
        const line3Text = await textEditor.getTextAtLine(2);
        (0, chai_1.expect)(line3Text).to.include('aura:application');
    });
    (0, vscode_extension_tester_1.after)('Tear down and clean up the testing environment', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Tear down and clean up the testing environment`);
        await testSetup?.tearDown();
    });
});
//# sourceMappingURL=auraLsp.e2e.js.map