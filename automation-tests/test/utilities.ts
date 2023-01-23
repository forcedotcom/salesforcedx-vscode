/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ChildProcess, exec } from 'child_process';
import os from 'os';
import vscode from 'vscode';
import vscodeType from 'vscode';
import {
  InputBox,
  QuickOpenBox,
  sleep,
  StatusBar,
  TerminalView,
  Workbench
} from 'wdio-vscode-service';
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

async function pause(duration: number): Promise<void> {
  await sleep(duration * EnvironmentSettings.getInstance().throttleFactor * 1000);
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
    const notificationWasFound = await notificationIsPresent(workbench, notificationMessage);
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

async function textIsPresentInOutputPanel(workbench: Workbench, text: string): Promise<boolean> {
  const bottomBar = await workbench.getBottomBar();

  // const outputView = await (await bottomBar.openOutputView()).wait();
  const outputView = await bottomBar.openOutputView();
  await outputView.wait(5000);

  const outputViewText = await outputView.getText();
  for (const outputLine of outputViewText) {
    if (outputLine.includes(text)) {
      return true;
    }
  }

  return false;
}

async function executeCommand(workbench: Workbench, command: string): Promise<TerminalView> {
  log(`Executing the command, "${command}"`);

  const terminalView = await getTerminalView(workbench);
  expect(terminalView).not.toBeNull();
  expect(terminalView).not.toBeUndefined();

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
    const terminalText = await terminalView.getText();
    if (terminalText && terminalText !== '') {
      return terminalText;
    }
  }

  throw new Error('Exceeded time limit - text in the terminal was not found');
}

function currentUserName(): string {
  const userName = os.userInfo().username ||
    process.env.SUDO_USER ||
    process.env.C9_USER ||
    process.env.LOGNAME ||
    process.env.USER ||
    process.env.LNAME ||
    process.env.USERNAME;

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
  textIsPresentInOutputPanel,
  executeCommand,
  getTerminalView,
  getTerminalViewText,
  currentUserName
};
