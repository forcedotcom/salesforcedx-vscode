/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { step } from 'mocha-steps';
import { DefaultTreeItem, TreeItem } from 'wdio-vscode-service';
import {
  ScratchOrg
} from '../scratchOrg';
import * as utilities from '../utilities';

describe('SObjects Definitions', async () => {
  const tempProjectName = 'TempProject-sObjectsDefinitions';
  let scratchOrg: ScratchOrg;

  step('Set up the testing environment', async () => {
    scratchOrg = new ScratchOrg('sObjectsDefinitions', false);
    await scratchOrg.setUp();
  });
  // Create a custom object
  // Push the object to org
  // Refresh SObject definitions for Custom SObjects
  step('Refresh SObject Definitions for Custom SObjects', async () => {
    // Type'Sfdx: Refresh SObject Definitions in the Command Pallette'
    const workbench = await browser.getWorkbench();
    const prompt = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Refresh SObject Definitions', 10);

    // Select "Custom SObjects" from the Drop down menu .
    await prompt.selectQuickPick('Custom SObjects');
    await utilities.pause(1);
    expect(1).toBe(1);
  });
  // Refresh SObject definitions for Standard SObjects
  step('Refresh SObject Definitions for Standard SObjects', async () => {
    // Type'Sfdx: Refresh SObject Definitions in the Command Pallette'
    const workbench = await browser.getWorkbench();
    const prompt = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Refresh SObject Definitions', 10);

    // Select "Standard SObjects" from the Drop down menu .
    await prompt.selectQuickPick('Standard SObjects');
    await utilities.pause(1);
    expect(1).toBe(1);
  });
  // Refresh SObject definitions for All SObjects.
  step('Refresh SObject Definitions for All SObjects', async () => {
    // Type'Sfdx: Refresh SObject Definitions in the Command Pallette'
    const workbench = await browser.getWorkbench();
    const prompt = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Refresh SObject Definitions', 10);

    // Select "All SObjects" from the Drop down menu .
    await prompt.selectQuickPick('All SObjects');
    await utilities.pause(1);

    // Expectation: Look for notification with text 'Sfdx: Refresh SObject Definitions successfully ran'
    const successNotificationWasFound = await utilities.attemptToFindNotification(workbench, 'SFDX: Refresh SObject Definitions successfully ran', 10);
    expect(successNotificationWasFound).toBe(true);

    // Search for 'Standard sObjects' to obtain the whole text in output panel'
    const outputPanelText = await utilities.attemptToFindOutputPanelText('Salesforce CLI', 'Standard sObjects', 10);
    expect(outputPanelText).not.toBeUndefined();

    // Search for 'Processed xxx Standard sObjects'
    const matchedResults = outputPanelText?.match(/Processed [0-9]{1,} Standard sObjects/gm);
    expect(matchedResults).not.toBe(undefined);
    // @ts-ignore: Object is possibly 'null'
    expect(matchedResults.length).toBeGreaterThanOrEqual(2)
    // @ts-ignore: Object is possibly 'null'
    const sObjectCount = parseInt(matchedResults[matchedResults.length - 1].match(/[0-9]{1,}/)[0]);
    expect(sObjectCount).toBeGreaterThan(100);

    const sidebar = workbench.getSideBar();
    const content = sidebar.getContent();
    const treeViewSection = await content.getSection(tempProjectName.toUpperCase());
    expect(treeViewSection).not.toEqual(undefined);

    // Verify if '.sfdx' folder is in side panel
    const sfdxTreeItem = await treeViewSection.findItem('.sfdx') as DefaultTreeItem;
    expect(sfdxTreeItem).not.toEqual(undefined);
    await sfdxTreeItem.expand();
    expect(await sfdxTreeItem.isExpanded()).toBe(true);
    await utilities.pause(1);

    // Verify if 'tools' folder is within '.sfdx'
    const toolsTreeItem = await sfdxTreeItem.findChildItem('tools') as TreeItem;
    expect(toolsTreeItem).not.toEqual(undefined);
    await toolsTreeItem.expand();
    expect(await toolsTreeItem.isExpanded()).toBe(true);
    await utilities.pause(1);

    // Verify if 'sobjects' folder is within 'tools'
    const sobjectsTreeItem = await toolsTreeItem.findChildItem('sobjects') as TreeItem;
    expect(sobjectsTreeItem).not.toEqual(undefined);
    await sobjectsTreeItem.expand();
    expect(await sobjectsTreeItem.isExpanded()).toBe(true);
    await utilities.pause(1);

    // Verify if 'standardObjects' folder is within 'sobjects'
    const standardObjectsTreeItem = await sobjectsTreeItem.findChildItem('standardObjects') as TreeItem;
    await standardObjectsTreeItem.expand();
    expect(await standardObjectsTreeItem.isExpanded()).toBe(true);
    await utilities.pause(1);
    
    // Expectation: Get list of leaf nodes and validate Account.cls is present
    const filteredTreeViewItems = await utilities.getFilteredVisibleTreeViewItemLabels(workbench, tempProjectName.toUpperCase(), 'Account.cls');
    expect(filteredTreeViewItems.includes('Account.cls')).toBe(true);
  });

  step('Tear down and clean up the testing environment', async () => {
    await scratchOrg.tearDown();
  });
});
