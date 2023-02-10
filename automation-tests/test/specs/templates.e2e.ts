/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  step
} from 'mocha-steps';
import {
  TextEditor
} from 'wdio-vscode-service';
import {
  ScratchOrg
} from '../scratchOrg';
import * as utilities from '../utilities';

describe('Templates', async () => {
  let scratchOrg: ScratchOrg;

  // Set up
  step('Set up the testing environment', async () => {
    scratchOrg = new ScratchOrg('Templates', false);
    await scratchOrg.setUp();
  });

  // Aura Component
  step('Create an Aura Component', async () => {
    // Using the Command palette, run SFDX: Create Aura Component.
    const workbench = await browser.getWorkbench();
    const inputBox = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Create Aura Component', 1);

    // Set the name of the new component to auraComponent1.
    await inputBox.setText('auraComponent1');
    await inputBox.confirm();
    await utilities.pause(1);

    // Select the default directory (press Enter/Return).
    await inputBox.confirm();

    const successNotificationWasFound = await utilities.attemptToFindNotification(workbench, 'SFDX: Create Aura Component successfully ran', 10);
    expect(successNotificationWasFound).toBe(true);

    const outputPanelText = await utilities.attemptToFindOutputPanelText('Salesforce CLI', 'Finished SFDX: Create Aura Component', 10);
    expect(outputPanelText).not.toBeUndefined();

    // Check for the presence of the directory, "auraComponent1".
    const filteredTreeViewItems = await utilities.getFilteredVisibleTreeViewItemLabels(workbench, 'TEMPPROJECT-TEMPLATES', 'auraComponent1');
    expect(filteredTreeViewItems.includes('auraComponent1')).toBe(true);

    // It's a tree, but it's also a list.  Everything in the view is actually flat
    // and returned from the call to visibleItems.reduce().
    expect(filteredTreeViewItems.includes('auraComponent1.cmp')).toBe(true);
    expect(filteredTreeViewItems.includes('auraComponent1.cmp-meta.xml')).toBe(true);
    expect(filteredTreeViewItems.includes('auraComponent1Controller.js')).toBe(true);
    expect(filteredTreeViewItems.includes('auraComponent1Helper.js')).toBe(true);
    expect(filteredTreeViewItems.includes('auraComponent1Renderer.js')).toBe(true);

    // Could also check for .auradoc, .css, .design, and .svg, but not as critical
    // and since this could change w/o our knowing, only check for what we need to here.
  });

  step('Verify the contents of the Aura Component', async () => {
    const expectedText = [
      '<aura:component>',
      '',
      '</aura:component>'
    ].join('\n');
    const workbench = await browser.getWorkbench();
    const editorView = await workbench.getEditorView();
    const textEditor = await editorView.openEditor('auraComponent1.cmp') as TextEditor;
    const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd();
    expect(textGeneratedFromTemplate).toEqual(expectedText);
  });

  step('Push the Aura Component', async () => {
    // Run "SFDX: Push Source to Default Scratch Org".
    const workbench = await browser.getWorkbench();
    await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Push Source to Default Scratch Org', 5);

    const successNotificationWasFound = await utilities.attemptToFindNotification(workbench, 'SFDX: Push Source to Default Scratch Org successfully ran', 10);
    expect(successNotificationWasFound).toBe(true);

    // Check the output.
    const outputPanelText = await utilities.attemptToFindOutputPanelText('Salesforce CLI', '=== Pushed Source', 10);
    expect(outputPanelText).not.toBeUndefined();
    expect(outputPanelText).toContain('Created  auraComponent1  AuraDefinitionBundle');
  });

  // Aura Event
  step('Create an Aura Event', async () => {
    // Using the Command palette, run SFDX: Create Aura Component.
    const workbench = await browser.getWorkbench();
    const inputBox = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Create Aura Event', 1);

    // Set the name of the new component to auraComponent1.
    await inputBox.setText('auraEvent1');
    await inputBox.confirm();
    await utilities.pause(1);

    // Select the default directory (press Enter/Return).
    await inputBox.confirm();

    const successNotificationWasFound = await utilities.attemptToFindNotification(workbench, 'SFDX: Create Aura Event successfully ran', 10);
    expect(successNotificationWasFound).toBe(true);

    const outputPanelText = await utilities.attemptToFindOutputPanelText('Salesforce CLI', 'Finished SFDX: Create Aura Event', 10);
    expect(outputPanelText).not.toBeUndefined();

    // Check for expected items in the Explorer view.
    const sidebar = workbench.getSideBar();
    const treeViewSection = await sidebar.getContent().getSection('TEMPPROJECT-TEMPLATES');
    await treeViewSection.expand();

    // Check for the presence of the directory, "auraEvent1".
    const filteredTreeViewItems = await utilities.getFilteredVisibleTreeViewItemLabels(workbench, 'TEMPPROJECT-TEMPLATES', 'auraEvent1');
    expect(filteredTreeViewItems.includes('auraEvent1')).toBe(true);

    // It's a tree, but it's also a list.  Everything in the view is actually flat
    // and returned from the call to visibleItems.reduce().
    expect(filteredTreeViewItems.includes('auraEvent1.evt')).toBe(true);
    expect(filteredTreeViewItems.includes('auraEvent1.evt-meta.xml')).toBe(true);
  });

  step('Verify the contents of the Aura Event', async () => {
    const expectedText = [
      '<aura:event type="APPLICATION" description="Event template"/>'
    ].join('\n');
    const workbench = await browser.getWorkbench();
    const editorView = await workbench.getEditorView();
    const textEditor = await editorView.openEditor('auraEvent1.evt') as TextEditor;
    const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd();
    expect(textGeneratedFromTemplate).toEqual(expectedText);
  });

  step('Push the Aura Event', async () => {
    // Run "SFDX: Push Source to Default Scratch Org".
    const workbench = await browser.getWorkbench();
    await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Push Source to Default Scratch Org', 5);

    const successNotificationWasFound = await utilities.attemptToFindNotification(workbench, 'SFDX: Push Source to Default Scratch Org successfully ran', 10);
    expect(successNotificationWasFound).toBe(true);

    // Check the output.
    const outputPanelText = await utilities.attemptToFindOutputPanelText('Salesforce CLI', '=== Pushed Source', 10);
    expect(outputPanelText).not.toBeUndefined();
    expect(outputPanelText).toContain('Created  auraEvent1  AuraDefinitionBundle');
  });

  // Apex Class
  step('Create an Apex Class', async () => {
    // Using the Command palette, run SFDX: Create Apex Class.
    const workbench = await browser.getWorkbench();
    const inputBox = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Create Apex Class', 1);

    // Set the name of the new component to auraComponent1.
    await inputBox.setText('apexClass1');
    await inputBox.confirm();
    await utilities.pause(1);

    // Select the default directory (press Enter/Return).
    await inputBox.confirm();

    const successNotificationWasFound = await utilities.attemptToFindNotification(workbench, 'SFDX: Create Apex Class successfully ran', 10);
    expect(successNotificationWasFound).toBe(true);

    const outputPanelText = await utilities.attemptToFindOutputPanelText('Salesforce CLI', 'Finished SFDX: Create Apex Class', 10);
    expect(outputPanelText).not.toBeUndefined();

    // Check for expected items in the Explorer view.
    const sidebar = workbench.getSideBar();
    const treeViewSection = await sidebar.getContent().getSection('TEMPPROJECT-TEMPLATES');
    await treeViewSection.expand();

    // Get the matching (visible) items within the tree which contain "apexClass1".
    const filteredTreeViewItems = await utilities.getFilteredVisibleTreeViewItemLabels(workbench, 'TEMPPROJECT-TEMPLATES', 'apexClass1');

    // It's a tree, but it's also a list.  Everything in the view is actually flat
    // and returned from the call to visibleItems.reduce().
    expect(filteredTreeViewItems.includes('apexClass1.cls')).toBe(true);
    expect(filteredTreeViewItems.includes('apexClass1.cls-meta.xml')).toBe(true);
  });

  step('Verify the contents of the Apex Class', async () => {
    const expectedText = [
      'public with sharing class apexClass1 {',
      '    public apexClass1() {',
      '',
      '    }',
      '}'
    ].join('\n');
    const workbench = await browser.getWorkbench();
    const editorView = await workbench.getEditorView();
    const textEditor = await editorView.openEditor('apexClass1.cls') as TextEditor;
    const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd();
    expect(textGeneratedFromTemplate).toEqual(expectedText);
  });

  step('Push the Apex Class', async () => {
    // Run "SFDX: Push Source to Default Scratch Org".
    const workbench = await browser.getWorkbench();
    await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Push Source to Default Scratch Org', 5);

    const successNotificationWasFound = await utilities.attemptToFindNotification(workbench, 'SFDX: Push Source to Default Scratch Org successfully ran', 10);
    expect(successNotificationWasFound).toBe(true);

    // Check the output.
    const outputPanelText = await utilities.attemptToFindOutputPanelText('Salesforce CLI', '=== Pushed Source', 10);
    expect(outputPanelText).not.toBeUndefined();
    expect(outputPanelText).toContain('Created  apexClass1  ApexClass');
  });

  // Lightning Web Component
  step('Create Lightning Web Component', async () => {
    // Using the Command palette, run SFDX: Create Apex Class.
    const workbench = await browser.getWorkbench();
    const inputBox = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Create Lightning Web Component', 1);

    // Set the name of the new component to auraComponent1.
    await inputBox.setText('lightningWebComponent1');
    await inputBox.confirm();
    await utilities.pause(1);

    // Select the default directory (press Enter/Return).
    await inputBox.confirm();

    const successNotificationWasFound = await utilities.attemptToFindNotification(workbench, 'SFDX: Create Lightning Web Component successfully ran', 10);
    expect(successNotificationWasFound).toBe(true);

    const outputPanelText = await utilities.attemptToFindOutputPanelText('Salesforce CLI', 'Finished SFDX: Create Lightning Web Component', 10);
    expect(outputPanelText).not.toBeUndefined();

    // Check for expected items in the Explorer view.
    const sidebar = workbench.getSideBar();
    const treeViewSection = await sidebar.getContent().getSection('TEMPPROJECT-TEMPLATES');
    await treeViewSection.expand();

    // Check for the presence of the directory, "lightningWebComponent1".
    const filteredTreeViewItems = await utilities.getFilteredVisibleTreeViewItemLabels(workbench, 'TEMPPROJECT-TEMPLATES', 'lightningWebComponent1');
    expect(filteredTreeViewItems.includes('lightningWebComponent1')).toBe(true);

    // It's a tree, but it's also a list.  Everything in the view is actually flat
    // and returned from the call to visibleItems.reduce() above.
    expect(filteredTreeViewItems.includes('lightningWebComponent1.html')).toBe(true);
    expect(filteredTreeViewItems.includes('lightningWebComponent1.js')).toBe(true);
    expect(filteredTreeViewItems.includes('lightningWebComponent1.js-meta.xml')).toBe(true);
  });

  step('Verify the contents of the Lightning Web Component', async () => {
    const expectedText = [
      `import { LightningElement } from 'lwc';`,
      '',
      'export default class LightningWebComponent1 extends LightningElement {}'
    ].join('\n');
    const workbench = await browser.getWorkbench();
    const editorView = await workbench.getEditorView();
    const textEditor = await editorView.openEditor('lightningWebComponent1.js') as TextEditor;
    const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd();
    expect(textGeneratedFromTemplate).toEqual(expectedText);
  });

  step('Push the Lightning Web Component', async () => {
    // Run "SFDX: Push Source to Default Scratch Org".
    const workbench = await browser.getWorkbench();
    await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Push Source to Default Scratch Org', 5);

    const successNotificationWasFound = await utilities.attemptToFindNotification(workbench, 'SFDX: Push Source to Default Scratch Org successfully ran', 10);
    expect(successNotificationWasFound).toBe(true);

    // Check the output.
    const outputPanelText = await utilities.attemptToFindOutputPanelText('Salesforce CLI', '=== Pushed Source', 10);
    expect(outputPanelText).not.toBeUndefined();
    expect(outputPanelText).toContain('Created  lightningWebComponent1  LightningComponentBundle');
  });

  // Tear down
  step('Tear down and clean up the testing environment', async () => {
    await scratchOrg.tearDown();
  });
});
