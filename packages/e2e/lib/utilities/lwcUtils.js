"use strict";
/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLwc = createLwc;
exports.createAura = createAura;
const commandPrompt_1 = require("./commandPrompt");
const miscellaneous_1 = require("./miscellaneous");
const textEditorView_1 = require("./textEditorView");
const workbench_1 = require("./workbench");
async function createLwc(name) {
    (0, miscellaneous_1.log)('createLwc() - calling getWorkbench()');
    const workbench = (0, workbench_1.getWorkbench)();
    (0, miscellaneous_1.log)('createLwc() - Running SFDX: Create Lightning Web Component');
    // Using the Command palette, run SFDX: Create Lightning Web Component.
    const inputBox = await (0, commandPrompt_1.executeQuickPick)('SFDX: Create Lightning Web Component', miscellaneous_1.Duration.seconds(1));
    (0, miscellaneous_1.log)('createLwc() - Set the name of the new component');
    // Set the name of the new component
    await inputBox.setText(name);
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
    await inputBox.confirm();
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
    await inputBox.confirm();
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
    (0, miscellaneous_1.log)('createLwc() - Modify js content');
    // Modify js content
    let textEditor = await (0, textEditorView_1.getTextEditor)(workbench, name + '.js');
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
    const jsText = [
        `import { LightningElement } from 'lwc';`,
        ``,
        `export default class ${name} extends LightningElement {`,
        `\tgreeting = 'World';`,
        `}`
    ].join('\n');
    await textEditor.setText(jsText);
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
    await textEditor.save();
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
    (0, miscellaneous_1.log)('createLwc() - Modify html content');
    (0, miscellaneous_1.log)('');
    // Modify html content
    textEditor = await (0, textEditorView_1.getTextEditor)(workbench, name + '.html');
    const htmlText = [
        `<template>`,
        `\t<lightning-card title="${name}" icon-name="custom:custom14">`,
        `\t\t<div class="slds-var-m-around_medium">Hello, {greeting}!</div>`,
        `\t</lightning-card>`,
        ``,
        `</template>`
    ].join('\n');
    await textEditor.setText(htmlText);
    await textEditor.save();
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
    (0, miscellaneous_1.log)('createLwc() - Modify test content');
    (0, miscellaneous_1.log)('');
    textEditor = await (0, textEditorView_1.getTextEditor)(workbench, name + '.test.js');
    const nameCapitalized = name.charAt(0).toUpperCase() + name.slice(1);
    const testText = [
        `import { createElement } from 'lwc';`,
        `import ${nameCapitalized} from 'c/${name}';`,
        '',
        `describe('c-${name}', () => {`,
        `    afterEach(() => {`,
        `        while (document.body.firstChild) {`,
        `            document.body.removeChild(document.body.firstChild);`,
        `        }`,
        `    });`,
        ``,
        `    it('displays greeting', () => {`,
        `        const element = createElement('c-${name}', {`,
        `            is: ${nameCapitalized}`,
        `        });`,
        `        document.body.appendChild(element);`,
        `        const div = element.shadowRoot.querySelector('div');`,
        `        expect(div.textContent).toBe('Hello, World!');`,
        `    });`,
        ``,
        `    it('is defined', async () => {`,
        `        const element = createElement('c-${name}', {`,
        `            is: ${nameCapitalized}`,
        `        });`,
        `        document.body.appendChild(element);`,
        `        await expect(element).toBeDefined();`,
        `    });`,
        `});`
    ].join('\n');
    await textEditor.setText(testText);
    await textEditor.save();
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
    // Set breakpoints
    await textEditor.toggleBreakpoint(17);
    await textEditor.toggleBreakpoint(25);
}
async function createAura(name) {
    const workbench = (0, workbench_1.getWorkbench)();
    (0, miscellaneous_1.log)('createAura() - Running SFDX: Create Aura Component');
    const inputBox = await (0, commandPrompt_1.executeQuickPick)('SFDX: Create Aura Component', miscellaneous_1.Duration.seconds(1));
    (0, miscellaneous_1.log)('createAura() - Set the name of the new component');
    // Set the name of the new component
    await inputBox.setText(name);
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
    await inputBox.confirm();
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
    await inputBox.confirm();
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
    (0, miscellaneous_1.log)('createAura() - Modify html content');
    // Modify html content
    const textEditor = await (0, textEditorView_1.getTextEditor)(workbench, name + '.cmp');
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
    const htmlText = [
        '<aura:component>',
        '\t',
        '\t<aura:attribute name="simpleNewContact" type="Object"/>',
        '\t<div class="slds-page-header" role="banner">',
        '\t\t<h1 class="slds-m-right_small">Create New Contact</h1>',
        '\t</div>',
        '\t<aura:if isTrue="{!not(empty(v.simpleNewContact))}">',
        '\t\t{!v.simpleNewContact}',
        '\t</aura:if>',
        '</aura:component>'
    ].join('\n');
    await textEditor.setText(htmlText);
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
    await textEditor.save();
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
}
//# sourceMappingURL=lwcUtils.js.map