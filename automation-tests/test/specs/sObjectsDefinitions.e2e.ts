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

  step('Refresh SObject Definitions for All SObjects', async () => {
    // TODO: implement
    // debugger
    //Open Command Pallette
    //Type in 'Sfdx: Refresh SObject Definitions'
    const workbench = await browser.getWorkbench();
    const prompt = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Refresh SObject Definitions', 10);

    //After Drop down menu appears, select All SObjects.
    // Select the "All SObjects" menu item.
    await prompt.selectQuickPick('All SObjects');
    await utilities.pause(1);

    //Expectation: Look for notification with text 'Sfdx: Refresh SObject Definitions successfully ran'
    const successNotificationWasFound = await utilities.attemptToFindNotification(workbench, 'SFDX: Refresh SObject Definitions successfully ran', 10);
    expect(successNotificationWasFound).toBe(true);
    //TODO: verify the command has run successfully
    // const outputPanelText = await utilities.attemptToFindOutputPanelText('Salesforce CLI', ' SFDX: Refresh SObject Definitions', 10);
    // expect(outputPanelText).not.toBeUndefined();

    //Open Output View and search for the text 'Processed 678 Standard sObjects'
    //ToDO: change to regex to deal with the number of objects
    const outputPanelText = await utilities.attemptToFindOutputPanelText('Salesforce CLI', 'Processed 678 Standard sObjects', 10);
    expect(outputPanelText).not.toBeUndefined();

    //Verify if '.sfdx' folder is there in side panel
    const sidebar = workbench.getSideBar();
    const content = sidebar.getContent();
    const treeViewSection = await content.getSection(tempProjectName.toUpperCase());
    expect(treeViewSection).not.toEqual(undefined);
    const sfdxTreeItem = await treeViewSection.findItem('.sfdx') as DefaultTreeItem;
    expect(sfdxTreeItem).not.toEqual(undefined);
    //Expand '.sfdx'
    await sfdxTreeItem.expand();
    await utilities.pause(1);

    //Verify if 'tools' folder is there under '.sfdx'
    const toolsTreeItem = await sfdxTreeItem.findChildItem('tools') as TreeItem;
    expect(toolsTreeItem).not.toEqual(undefined);
    //Expand 'tools'
    await toolsTreeItem.expand();
    await utilities.pause(1);

    //Verify if 'sobjects' folder is there under 'tools'
    const sobjectsTreeItem = await toolsTreeItem.findChildItem('sobjects') as TreeItem;
    expect(sobjectsTreeItem).not.toEqual(undefined);
    //Expand 'sobjects'
    await sobjectsTreeItem.expand();
    await utilities.pause(1);

    //Verify if 'standardObjects' folder is there under 'sobjects'
    const standardObjectsTreeItem = await sobjectsTreeItem.findChildItem('standardObjects') as TreeItem;
    expect(standardObjectsTreeItem).not.toEqual(undefined);
    //Expand 'standardObjects'
    await standardObjectsTreeItem.expand();
    await utilities.pause(1);
    const sObjectsList = await standardObjectsTreeItem.getChildren();

    //Expectation: Get list of leaf nodes and validate that Account.cls present
    // const filteredTreeViewItems = await utilities.getFilteredVisibleTreeViewItemLabels(workbench, 'standardObjects', 'Account.cls');
    // debugger
    // expect(filteredTreeViewItems.includes('Account')).toBe(true);
    // function to convert TreeItem[] to TreeItem.label[] or string[]

    //
    //
    //
    //
    //
    //
    //
    //
    //
    expect(1).toBe(1);
  });

  step('Tear down and clean up the testing environment', async () => {
    await scratchOrg.tearDown();
  });
});
