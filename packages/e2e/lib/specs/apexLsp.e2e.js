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
const testSetup_1 = require("../testSetup");
const utilities = __importStar(require("../utilities/index"));
const environmentSettings_1 = require("../environmentSettings");
const vscode_extension_tester_1 = require("vscode-extension-tester");
const mocha_steps_1 = require("mocha-steps");
const chai_1 = require("chai");
describe('Apex LSP', async () => {
    let testSetup;
    const testReqConfig = {
        projectConfig: {
            projectShape: utilities.ProjectShapeOption.NEW
        },
        isOrgRequired: false,
        testSuiteSuffixName: 'ApexLsp'
    };
    (0, mocha_steps_1.step)('Set up the testing environment', async () => {
        utilities.log('ApexLsp - Set up the testing environment');
        utilities.log(`ApexLsp - JAVA_HOME: ${environmentSettings_1.EnvironmentSettings.getInstance().javaHome}`);
        testSetup = await testSetup_1.TestSetup.setUp(testReqConfig);
        await utilities.pause(utilities.Duration.seconds(10));
        // Create Apex Class
        await utilities.createApexClassWithTest('ExampleClass');
    });
    (0, mocha_steps_1.step)('Verify LSP finished indexing', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Verify LSP finished indexing`);
        // Go to apex class file
        const workbench = await utilities.getWorkbench();
        await utilities.getTextEditor(workbench, 'ExampleClass.cls');
        // Get Apex LSP Status Bar
        const statusBar = await utilities.getStatusBarItemWhichIncludes('Editor Language Status');
        await statusBar.click();
        (0, chai_1.expect)(await statusBar.getAttribute('aria-label')).to.include('Indexing complete');
        // Get output text from the LSP
        const outputViewText = await utilities.getOutputViewText('Apex Language Server');
        utilities.log('Output view text');
        utilities.log(outputViewText);
    });
    (0, mocha_steps_1.step)('Go to Definition', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Go to Definition`);
        // Get open text editor
        const workbench = utilities.getWorkbench();
        const textEditor = await utilities.getTextEditor(workbench, 'ExampleClassTest.cls');
        // Move cursor to the middle of "ExampleClass.SayHello() call"
        await textEditor.moveCursor(6, 20);
        await utilities.pause(utilities.Duration.seconds(1));
        // Go to definition through F12
        await utilities.executeQuickPick('Go to Definition', utilities.Duration.seconds(2));
        // Verify 'Go to definition' took us to the definition file
        const editorView = workbench.getEditorView();
        const activeTab = await editorView.getActiveTab();
        const title = await activeTab?.getTitle();
        (0, chai_1.expect)(title).to.equal('ExampleClass.cls');
    });
    (0, mocha_steps_1.step)('Autocompletion', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Autocompletion`);
        // Get open text editor
        const workbench = await utilities.getWorkbench().wait();
        const textEditor = await utilities.getTextEditor(workbench, 'ExampleClassTest.cls');
        // Move cursor to line 7 and type ExampleClass.say
        await textEditor.typeTextAt(7, 1, '\tExampleClass.say');
        await utilities.pause(utilities.Duration.seconds(1));
        // Verify autocompletion options are present
        const autocompletionOptions = await workbench.findElements(vscode_extension_tester_1.By.css('div.monaco-list-row.show-file-icons'));
        const ariaLabel = await autocompletionOptions[0].getAttribute('aria-label');
        (0, chai_1.expect)(ariaLabel).to.contain('SayHello(name)');
        await autocompletionOptions[0].click();
        // Verify autocompletion options can be selected and therefore automatically inserted into the file
        await textEditor.typeText(`'Jack`);
        await textEditor.typeTextAt(7, 38, ';');
        await textEditor.save();
        await utilities.pause(utilities.Duration.seconds(1));
        const line7Text = await textEditor.getTextAtLine(7);
        (0, chai_1.expect)(line7Text).to.include(`ExampleClass.SayHello('Jack');`);
    });
    (0, vscode_extension_tester_1.after)('Tear down and clean up the testing environment', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Tear down and clean up the testing environment`);
        await testSetup?.tearDown();
    });
});
//# sourceMappingURL=apexLsp.e2e.js.map