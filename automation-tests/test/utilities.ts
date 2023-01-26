/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ChildProcess, exec } from 'child_process';
import clipboard from 'clipboardy'
import os from 'os';
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
  TreeItem,
  ViewItem,
  Workbench
} from 'wdio-vscode-service';
import { CMD_KEY } from 'wdio-vscode-service/dist/constants';
import {
  EnvironmentSettings
} from './environmentSettings';


async function openFile(vscode: typeof vscodeType, file: string): Promise<vscode.TextEditor> {
  const filePath = vscode.Uri.parse(file).fsPath;
  const textDocument = await vscode.workspace.openTextDocument(filePath);
  const textEditor = await vscode.window.showTextDocument(textDocument);

  return textEditor;
}

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

async function pause(durationSeconds: number): Promise<void> {
  await sleep(durationSeconds * EnvironmentSettings.getInstance().throttleFactor * 1000);
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
  await prompt.wait(5000);

  await prompt.setText(`>${command}`);
  await pause(1);

  return prompt;
}

async function executeQuickPick(workbench: Workbench, command: string): Promise<InputBox | QuickOpenBox> {
  const prompt = await openCommandPromptWithCommand(workbench, command);
  await selectQuickPickItem(prompt, command);

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

async function waitForNotificationToGoAway(workbench: Workbench, notificationMessage: string, timeout: number): Promise<void> {
  // Change timeout from seconds to milliseconds
  timeout *= 1000;

  pause(5);
  const startDate = new Date();
  while (true) {
    let notificationWasFound = await notificationIsPresent(workbench, notificationMessage);
    if (!notificationWasFound) {
      return;
    }

    const currentDate = new Date();
    const secondsPassed = Math.abs(currentDate.getTime() - startDate.getTime()) / 1000;
    if (secondsPassed >= timeout) {
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

async function selectChannel(outputView: OutputView, name: string): Promise<void> {
  // Open the Output panel's dropdown menu.
  const select = await outputView.parent.$('select.monaco-select-box');
  await select.click();

  // const channels = await outputView1.parent.$$(`${outputView1.locatorMap.BottomBarViews.outputChannels} option`);
  const channels = await select.$$('option');
  for (const channel of channels) {
    const val = await channel.getValue();
    if (val === name) {
        await channel.click();
        // eslint-disable-next-line wdio/no-pause
        await browser.pause(200);
        await browser.keys(['Escape']);
        return;
    }
  }

  throw new Error(`Channel ${name} not found`);
}

async function getOutputPanelText(outputChannelName: string): Promise<string> {
  const workbench = await browser.getWorkbench();
  const bottomBar = await workbench.getBottomBar(); // selector is 'div[id="workbench.parts.panel"]'
  const outputView = await bottomBar.openOutputView(); // selector is 'div[id="workbench.panel.output"]'
  await utilities.pause(2);

  selectChannel(outputView, outputChannelName);
  await utilities.pause(1);

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

// If found, this function returns the entire text that's in the Output panel
async function attemptToFindOutputPanelText(outputChannelName: string, searchString: string, attempts: number) : Promise<string | undefined> {
  while (attempts > 0) {
    const outputPanelText = await getOutputPanelText(outputChannelName);
    if (outputPanelText.includes(searchString)) {
      return outputPanelText;
    }

    pause(1);
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
  for (let i=0; i<seconds; i++) {
    await pause(1);

    // const terminalText = await terminalView.getText();
    // terminalView.getText() no longer works

    await browser.keys([CMD_KEY, 'a', 'c']);
    // Should be able to use Keys.Ctrl, but Keys is not exported from webdriverio
    // See https://webdriver.io/docs/api/browser/keys/
    const terminalText = await clipboard.read();

    if (terminalText && terminalText !== '') {
      return terminalText
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
  executeQuickPick,
  selectQuickPickItem,
  getStatusBarItemWhichIncludes,
  waitForNotificationToGoAway,
  notificationIsPresent,
  attemptToFindNotification,
  selectChannel,
  getOutputPanelText,
  attemptToFindOutputPanelText,
  executeCommand,
  getTerminalView,
  getTerminalViewText,
  getFilteredVisibleTreeViewItems,
  getFilteredVisibleTreeViewItemLabels,
  currentUserName,
};
