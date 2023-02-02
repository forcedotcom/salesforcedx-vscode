/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ChildProcess, exec } from 'child_process';
import clipboard from 'clipboardy';
import os from 'os';
import { text } from 'stream/consumers';
import vscode from 'vscode';
import vscodeType from 'vscode';
import {
  DefaultTreeItem,
  InputBox,
  OutputView,
  QuickOpenBox,
  sleep,
  StatusBar,
  TerminalView,
  TextEditor,
  TreeItem,
  ViewItem,
  Workbench
} from 'wdio-vscode-service';
import { CMD_KEY } from 'wdio-vscode-service/dist/constants';
import {
  EnvironmentSettings
} from './environmentSettings';

// tslint:disable-next-line:no-shadowed-variable
async function openFile(vscode: typeof vscodeType, file: string): Promise<vscode.TextEditor> {
  const filePath = vscode.Uri.parse(file).fsPath;
  const textDocument = await vscode.workspace.openTextDocument(filePath);
  const textEditor = await vscode.window.showTextDocument(textDocument);

  return textEditor;
}

// tslint:disable-next-line:no-shadowed-variable
async function openFolder(vscode: typeof vscodeType, folderPath: string): Promise<unknown> {
  const folderPathUri = vscode.Uri.parse(folderPath);
  const result = await vscode.commands.executeCommand('vscode.openFolder', folderPathUri);

  // TODO: verify return type

  return result;
}

function createFolder(folderPath: string): ChildProcess {
  const childProcess = exec(`mkdir "${folderPath}"`);

  return childProcess;
}

function removeFolder(folderPath: string): ChildProcess {
  const childProcess = exec(`rm -rf "${folderPath}"`);

  return childProcess;
}

async function pause(durationInSeconds: number): Promise<void> {
  await sleep(durationInSeconds * EnvironmentSettings.getInstance().throttleFactor * 1000);
}

function log(message: string) {
  console.log(message);
}

async function clickFilePathOkButton(): Promise<void> {
  const okButton = await $('*:not([style*="display: none"]).quick-input-action .monaco-button');
  await okButton.click();
  await utilities.pause(1);
}

async function openCommandPromptWithCommand(workbench: Workbench, command: string): Promise<InputBox | QuickOpenBox> {
  const prompt = await workbench.openCommandPrompt();
  await pause(5);

  await prompt.setText(`>${command}`);
  await pause(1);

  return prompt;
}

async function runCommandFromCommandPalette(command: string, durationInSeconds: number = 0): Promise<InputBox | QuickOpenBox> {
  const workbench = await browser.getWorkbench();
  const prompt = await openCommandPromptWithCommand(workbench, command);
  await selectQuickPickItem(prompt, command);

  if (durationInSeconds > 0) {
    await utilities.pause(durationInSeconds);
  }

  return prompt;
}

async function selectQuickPickItem(prompt: InputBox | QuickOpenBox, text: string): Promise<void> {
  const quickPicks = await prompt.getQuickPicks();
  for (const quickPick of quickPicks) {
      const label = await quickPick.getLabel();
      if (label === text) {
          await quickPick.select();
          return;
      }
  }

  throw new Error(`Quick pick item ${text} was not found`);
}

async function getStatusBarItemWhichIncludes(statusBar: StatusBar, title: string): Promise<WebdriverIO.Element> {
  const items = await statusBar.item$$;
  for (const item of items) {
    const itemTitle = await item.getAttribute(statusBar.locators.itemTitle);
    if (itemTitle.includes(title)) {
        return item;
    }
  }

  throw new Error(`Status bar item containing ${title} was not found`);
}

async function waitForNotificationToGoAway(workbench: Workbench, notificationMessage: string, durationInSeconds: number): Promise<void> {
  // Change timeout from seconds to milliseconds
  durationInSeconds *= 1000;

  await pause(5);
  const startDate = new Date();
  while (true) {
    const notificationWasFound = await notificationIsPresent(workbench, notificationMessage);
    if (!notificationWasFound) {
      return;
    }

    const currentDate = new Date();
    const secondsPassed = Math.abs(currentDate.getTime() - startDate.getTime()) / 1000;
    if (secondsPassed >= durationInSeconds) {
      throw new Error(`Exceeded time limit - notification "${notificationMessage}" is still present`);
    }
  }
}

async function notificationIsPresent(workbench: Workbench, notificationMessage: string): Promise<boolean> {
  const notifications = await workbench.getNotifications();
  for (const notification of notifications) {
    const message = await notification.getMessage();
    if (message === notificationMessage) {
      return true;
    }
  }

  return false;
}

async function attemptToFindNotification(workbench: Workbench, notificationMessage: string, attempts: number): Promise<boolean> {
  while (attempts > 0) {
    if (await notificationIsPresent(workbench, notificationMessage)) {
      return true;
    }

    await pause(1);
    attempts--;
  }

  return false;
}

async function dismissAllNotifications(): Promise<void> {
  const workbench = await browser.getWorkbench();
  await browser.waitUntil(async () => {
    const notifications = await workbench.getNotifications();
    for (const notification of notifications) {
        await notification.dismiss();
    }

    return !(await workbench.hasNotifications());
  });
}

async function selectOutputChannel(outputView: OutputView, name: string): Promise<void> {
  // Wait for all notifications to go away.  If there is a notification that is overlapping and hiding the Output channel's
  // dropdown menu, calling select.click() doesn't work, so dismiss all notifications first before clicking the dropdown
  // menu and opening it.
  await dismissAllNotifications();

  // Find the channel the Output view is current set to.
  const dropDownMenu = await outputView.parent.$('select.monaco-select-box');
  const currentChannelName = await dropDownMenu.getValue();
  if (currentChannelName === name) {
    // If the output channel is already set, don't do anything and just return.
    return;
  }

  // Open the Output panel's dropdown menu.
  await dropDownMenu.click();

  // Click the target channel.
  const channels = await dropDownMenu.$$('option');
  for (const channel of channels) {
    const val = await channel.getValue();
    if (val === name) {
        await channel.click();
        // eslint-disable-next-line wdio/no-pause
        await browser.pause(200);
        await browser.keys(['Escape']);
        await utilities.pause(1);
        return;
    }
  }

  throw new Error(`Channel ${name} not found`);
}

async function openOutputView(): Promise<OutputView> {
  const workbench = await browser.getWorkbench();
  const bottomBar = await workbench.getBottomBar(); // selector is 'div[id="workbench.parts.panel"]'
  const outputView = await bottomBar.openOutputView(); // selector is 'div[id="workbench.panel.output"]'
  await utilities.pause(2);

  return outputView;
}

async function getOutputPanelText(outputChannelName: string = ''): Promise<string> {
  const outputView = await openOutputView();

  // Set the output channel, but only if the value is passed in.
  if (outputChannelName) {
    await selectOutputChannel(outputView, outputChannelName);
  }

  // Set focus to the contents in the Output panel.
  await (await outputView.elem).click();
  await utilities.pause(1);

  // Select all of the text within the panel.
  await browser.keys([CMD_KEY, 'a', 'c']);
  // Should be able to use Keys.Ctrl, but Keys is not exported from webdriverio
  // See https://webdriver.io/docs/api/browser/keys/

  const outputPanelText = await clipboard.read();

  return outputPanelText;
}

// If found, this function returns the entire text that's in the Output panel.
async function attemptToFindOutputPanelText(outputChannelName: string, searchString: string, attempts: number): Promise<string | undefined> {
  const outputView = await openOutputView();
  await selectOutputChannel(outputView, outputChannelName);

  while (attempts > 0) {
    const outputPanelText = await getOutputPanelText();
    if (outputPanelText.includes(searchString)) {
      return outputPanelText;
    }

    await pause(1);
    attempts--;
  }

  return undefined;
}

async function executeCommand(workbench: Workbench, command: string): Promise<TerminalView> {
  log(`Executing the command, "${command}"`);

  const terminalView = await getTerminalView(workbench);
  if (!terminalView) {
    throw new Error('In executeCommand(), the terminal view returned from getTerminalView() was null (or undefined)');
  }

  await terminalView.executeCommand(command);

  return terminalView;
}

async function getTerminalView(workbench: Workbench): Promise<TerminalView> {
  const bottomBar = await workbench.getBottomBar();
  const terminalView = await bottomBar.openTerminalView();
  await utilities.pause(5);

  return terminalView;
}

async function getTerminalViewText(terminalView: TerminalView, seconds: number): Promise<string> {
  for (let i = 0; i < seconds; i++) {
    await pause(1);

    // const terminalText = await terminalView.getText();
    // terminalView.getText() no longer works

    await browser.keys([CMD_KEY, 'a', 'c']);
    // Should be able to use Keys.Ctrl, but Keys is not exported from webdriverio
    // See https://webdriver.io/docs/api/browser/keys/
    const terminalText = await clipboard.read();

    if (terminalText && terminalText !== '') {
      return terminalText;
    }
  }

  throw new Error('Exceeded time limit - text in the terminal was not found');
}

async function getFilteredVisibleTreeViewItems(workbench: Workbench, projectName: string, searchString: string): Promise<ViewItem[]> {
  const sidebar = workbench.getSideBar();
  const treeViewSection = await sidebar.getContent().getSection(projectName);
  await treeViewSection.expand();

  // Warning, we can only retrieve the items which are visible.
  const visibleItems = (await treeViewSection.getVisibleItems()) as DefaultTreeItem[];
  const filteredItems = (await visibleItems.reduce(async (previousPromise: Promise<ViewItem[]>, currentItem: ViewItem) => {
    const results = await previousPromise;
    const label = await (currentItem as TreeItem).getLabel();
    if (label.startsWith(searchString)) {
      results.push(currentItem);
    }

    return results;
  }, Promise.resolve([])) as ViewItem[]);

  return filteredItems;
}

async function getFilteredVisibleTreeViewItemLabels(workbench: Workbench, projectName: string, searchString: string): Promise<string[]> {
  const sidebar = workbench.getSideBar();
  const treeViewSection = await sidebar.getContent().getSection(projectName);
  await treeViewSection.expand();

  // Warning, we can only retrieve the items which are visible.
  const visibleItems = (await treeViewSection.getVisibleItems()) as DefaultTreeItem[];
  const filteredItems = (await visibleItems.reduce(async (previousPromise: Promise<string[]>, currentItem: ViewItem) => {
    const results = await previousPromise;
    const label = await (currentItem as TreeItem).getLabel();
    if (label.startsWith(searchString)) {
      results.push(label);
    }

    return results;
  }, Promise.resolve([])) as string[]);

  return filteredItems;
}

async function createApexClassWithTest(): Promise<void> {
  const workbench = await browser.getWorkbench();
  let textEditor: TextEditor;

  // Using the Command palette, run SFDX: Create Apex Class to create the main class
  const inputBox = await utilities.runCommandFromCommandPalette('SFDX: Create Apex Class', 1);

  // Set the name of the new Apex Class
  await inputBox.setText('ExampleApexClass');
  await inputBox.confirm();

  // Select the default directory (press Enter/Return).
  await inputBox.confirm();
  await utilities.pause(1);

  // Modify class content
  const editorView = workbench.getEditorView();
  textEditor = await editorView.openEditor('ExampleApexClass.cls') as TextEditor;
  await textEditor.setText('public with sharing class ExampleApexClass {\n\tpublic static void SayHello(string name){\n\t\tSystem.debug(\'Hello, \' + name + \'!\');\t\n}\n}');
  await textEditor.save();
  await textEditor.toggleBreakpoint(4);
  await utilities.pause(1);

  // Using the Command palette, run SFDX: Create Apex Class to create the Test
  await utilities.runCommandFromCommandPalette('SFDX: Create Apex Class', 1);

  // Set the name of the new Apex Class Test
  await inputBox.setText('ExampleApexClassTest');
  await inputBox.confirm();

  // Select the default directory (press Enter/Return).
  await inputBox.confirm();
  await utilities.pause(1);

  // Modify class content
  textEditor = await editorView.openEditor('ExampleApexClassTest.cls') as TextEditor;
  await textEditor.setText('@isTest\npublic class ExampleApexClassTest {\n\t@isTest\n\tpublic validateSayHello(string name) {\n\t\tSystem.debug(\'Starting validate\');\n\t\tExampleApexClass.SayHello(\'Cody\');\n\t\tSystem.assertEquals(1, 1, \'all good\');\n\t}\n}');
  await textEditor.save();
  await utilities.pause(1);
}

function currentUserName(): string {
  const userName = os.userInfo().username ||
    process.env.SUDO_USER! ||
    process.env.C9_USER! ||
    process.env.LOGNAME! ||
    process.env.USER! ||
    process.env.LNAME! ||
    process.env.USERNAME!;

  return userName;
}

export const utilities = {
  openFile,
  openFolder,
  createFolder,
  removeFolder,
  pause,
  log,
  clickFilePathOkButton,
  openCommandPromptWithCommand,
  runCommandFromCommandPalette,
  selectQuickPickItem,
  getStatusBarItemWhichIncludes,
  waitForNotificationToGoAway,
  notificationIsPresent,
  attemptToFindNotification,
  dismissAllNotifications,
  selectOutputChannel,
  openOutputView,
  getOutputPanelText,
  attemptToFindOutputPanelText,
  executeCommand,
  getTerminalView,
  getTerminalViewText,
  getFilteredVisibleTreeViewItems,
  getFilteredVisibleTreeViewItemLabels,
  createApexClassWithTest,
  currentUserName
};
