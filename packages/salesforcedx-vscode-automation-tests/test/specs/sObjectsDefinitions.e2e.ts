/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { step } from 'mocha-steps';
import { DefaultTreeItem, TreeItem, ViewSection, Workbench, after } from 'vscode-extension-tester';
import { TestSetup } from '../testSetup';
import * as utilities from '../utilities/index';
import { expect } from 'chai';

describe('SObjects Definitions', async () => {
  let testSetup: TestSetup;
  const testReqConfig: utilities.TestReqConfig = {
    projectConfig: {
      projectShape: utilities.ProjectShapeOption.NEW
    },
    isOrgRequired: true,
    testSuiteSuffixName: 'sObjectsDefinitions'
  };
  let projectName: string;

  step('Set up the testing environment', async () => {
    testSetup = await TestSetup.setUp(testReqConfig);
    projectName = testSetup.tempProjectName;

    utilities.log(`${testSetup.testSuiteSuffixName} - calling createCustomObjects()`);
    await utilities.createCustomObjects(testSetup);
  });

  step(`Check Custom Objects 'Customer__c' and 'Product__c' are within objects folder`, async () => {
    utilities.log(
      `${testSetup.testSuiteSuffixName} - Check Custom Objects 'Customer__c' and 'Product__c' are within objects folder`
    );
    const workbench = await utilities.getWorkbench();
    const sidebar = await workbench.getSideBar().wait();
    const content = await sidebar.getContent().wait();

    const treeViewSection = await content.getSection(projectName);
    expect(treeViewSection).to.not.be.undefined;

    const objectTreeItem = (await treeViewSection.findItem('objects')) as DefaultTreeItem;
    expect(objectTreeItem).to.not.be.undefined;
    await objectTreeItem.select();

    const customerObjectFolder = (await objectTreeItem.findChildItem('Customer__c')) as DefaultTreeItem;
    expect(customerObjectFolder).to.not.be.undefined;

    await customerObjectFolder?.expand();
    expect(await customerObjectFolder?.isExpanded()).to.equal(true);

    const customerCustomObject = await customerObjectFolder.findChildItem('Customer__c.object-meta.xml');
    expect(customerCustomObject).to.not.be.undefined;

    const productObjectFolder = (await objectTreeItem.findChildItem('Product__c')) as DefaultTreeItem;
    expect(productObjectFolder).to.not.be.undefined;

    await productObjectFolder?.expand();
    expect(await productObjectFolder?.isExpanded()).to.equal(true);

    const productCustomObject = await productObjectFolder.findChildItem('Product__c.object-meta.xml');
    expect(productCustomObject).to.not.be.undefined;
  });

  step('Push Source to Org', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Push Source to Org`);
    await utilities.executeQuickPick('SFDX: Push Source to Default Org', utilities.Duration.seconds(5));
    await utilities.pause(utilities.Duration.seconds(1));

    const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
      /SFDX: Push Source to Default Org successfully ran/,
      utilities.Duration.TEN_MINUTES
    );
    expect(successNotificationWasFound).to.equal(true);

    const outputPanelText = await utilities.attemptToFindOutputPanelText(
      'Salesforce CLI',
      'Starting SFDX: Push Source to Default Org',
      5
    );
    expect(outputPanelText).to.not.be.undefined;
    expect(outputPanelText).to.contain('Pushed Source');
  });

  step('Refresh SObject Definitions for Custom SObjects', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Refresh SObject Definitions for Custom SObjects`);
    await refreshSObjectDefinitions('Custom SObjects');

    await verifyOutputPanelText('Custom sObjects', 2);

    const workbench = await utilities.getWorkbench();
    const treeViewSection = await verifySObjectFolders(workbench, projectName, 'customObjects');

    // Verify if custom Objects Customer__c and Product__c are within 'customObjects' folder
    const customerCustomObject = await treeViewSection.findItem('Customer__c.cls');
    expect(customerCustomObject).to.not.be.undefined;
    const productCustomObject = await treeViewSection.findItem('Product__c.cls');
    expect(productCustomObject).to.not.be.undefined;
  });

  step('Refresh SObject Definitions for Standard SObjects', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Refresh SObject Definitions for Standard SObjects`);
    await refreshSObjectDefinitions('Standard SObjects');

    await verifyOutputPanelText('Standard sObjects');

    const workbench = await utilities.getWorkbench();
    const treeViewSection = await verifySObjectFolders(workbench, projectName, 'standardObjects');

    const accountSObject = await treeViewSection.findItem('Account.cls');
    expect(accountSObject).to.not.be.undefined;

    const accountCleanInfoSObject = await treeViewSection.findItem('AccountCleanInfo.cls');
    expect(accountCleanInfoSObject).to.not.be.undefined;

    const acceptedEventRelationSObject = await treeViewSection.findItem('AcceptedEventRelation.cls');
    expect(acceptedEventRelationSObject).to.not.be.undefined;
  });

  step('Refresh SObject Definitions for All SObjects', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Refresh SObject Definitions for All SObjects`);
    await refreshSObjectDefinitions('All SObjects');

    await verifyOutputPanelText('Standard sObjects');
    await verifyOutputPanelText('Custom sObjects', 2);
  });

  after('Tear down and clean up the testing environment', async () => {
    await testSetup?.tearDown();
  });
});

async function verifyOutputPanelText(type: string, qty?: number): Promise<void> {
  utilities.log(`calling verifyOutputPanelText(${type})`);
  const outputPanelText = (await utilities.attemptToFindOutputPanelText('Salesforce CLI', 'sObjects', 10)) as string;
  expect(outputPanelText).to.not.be.undefined;
  const expectedTexts = [
    `Starting SFDX: Refresh SObject Definitions`,
    `sf sobject definitions refresh`,
    `Processed ${qty || ''}`,
    `${type}`,
    `ended with exit code 0`
  ];
  await utilities.verifyOutputPanelText(outputPanelText, expectedTexts);
}

async function refreshSObjectDefinitions(type: string): Promise<void> {
  utilities.log(`calling refreshSObjectDefinitions(${type})`);
  await utilities.clearOutputView(utilities.Duration.seconds(2));
  const prompt = await utilities.executeQuickPick('SFDX: Refresh SObject Definitions', utilities.Duration.seconds(2));
  await prompt.setText(type);
  await prompt.selectQuickPick(type);
  await utilities.pause(utilities.Duration.seconds(1));

  const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
    /SFDX: Refresh SObject Definitions successfully ran/,
    utilities.Duration.TEN_MINUTES
  );
  expect(successNotificationWasFound).to.equal(true);
}

async function verifySObjectFolders(workbench: Workbench, projectName: string, folder: string): Promise<ViewSection> {
  utilities.log(`calling verifySObjectFolders(workbench, ${projectName}, ${folder})`);
  const sidebar = workbench.getSideBar();
  const content = sidebar.getContent();
  const treeViewSection = await content.getSection(projectName);
  expect(treeViewSection).to.not.be.undefined;

  // Verify if '.sfdx' folder is in side panel
  const sfdxTreeItem = (await treeViewSection.findItem('.sfdx')) as DefaultTreeItem;
  expect(sfdxTreeItem).to.not.be.undefined;
  await sfdxTreeItem.expand();
  expect(await sfdxTreeItem.isExpanded()).to.equal(true);
  await utilities.pause(utilities.Duration.seconds(1));

  // Verify if 'tools' folder is within '.sfdx'
  const toolsTreeItem = (await sfdxTreeItem.findChildItem('tools')) as TreeItem;
  expect(toolsTreeItem).to.not.be.undefined;
  await toolsTreeItem.expand();
  expect(await toolsTreeItem.isExpanded()).to.equal(true);
  await utilities.pause(utilities.Duration.seconds(1));

  // Verify if 'sobjects' folder is within 'tools'
  const sobjectsTreeItem = (await toolsTreeItem.findChildItem('sobjects')) as TreeItem;
  expect(sobjectsTreeItem).to.not.be.undefined;
  await sobjectsTreeItem.expand();
  expect(await sobjectsTreeItem.isExpanded()).to.equal(true);
  await utilities.pause(utilities.Duration.seconds(1));

  // Verify if 'type' folder is within 'sobjects'
  const objectsTreeItem = (await sobjectsTreeItem.findChildItem(folder)) as TreeItem;
  expect(objectsTreeItem).to.not.be.undefined;
  await objectsTreeItem.expand();
  expect(await objectsTreeItem.isExpanded()).to.equal(true);
  await utilities.pause(utilities.Duration.seconds(1));

  return treeViewSection;
}
