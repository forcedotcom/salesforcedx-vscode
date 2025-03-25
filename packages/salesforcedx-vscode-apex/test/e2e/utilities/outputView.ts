/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { debug, Duration, log, pause } from './miscellaneous';
import { dismissAllNotifications } from './notifications';
import { executeQuickPick } from './commandPrompt';
import { BottomBarPanel, By, OutputView } from 'vscode-extension-tester';
import { expect } from 'chai';

export async function selectOutputChannel(name: string): Promise<OutputView> {
  // Wait for all notifications to go away.  If there is a notification that is overlapping and hiding the Output channel's
  // dropdown menu, calling select.click() doesn't work, so dismiss all notifications first before clicking the dropdown
  // menu and opening it.
  await dismissAllNotifications();

  // Find the given channel in the Output view
  const outputView = await new BottomBarPanel().openOutputView();
  await pause(Duration.seconds(1));
  if (!!name) {
    await outputView.selectChannel(name);
  }
  return outputView;
}

export async function getOutputViewText(outputChannelName: string = ''): Promise<string> {
  // Set the output channel, but only if the value is passed in.
  const outputView = await selectOutputChannel(outputChannelName);

  // Set focus to the contents in the Output panel.
  await executeQuickPick('Output: Focus on Output View', Duration.seconds(2));

  return await outputView.getText();
}

/**
 * Verifies that the output panel contains all expected text snippets.
 *
 * @param {string} outputPanelText - The output panel text as a string that needs to be verified.
 * @param {string[]} expectedTexts - An array of strings representing the expected text snippets that should be present in the output panel.
 *
 * @example
 * await verifyOutputPanelText(
 *   testResult,
 *   [
 *     '=== Test Summary',
 *     'Outcome              Passed',
 *     'Tests Ran            1',
 *     'Pass Rate            100%',
 *     'TEST NAME',
 *     'ExampleTest1  Pass',
 *     'ended SFDX: Run Apex Tests'
 *   ]
 * );
 */
export async function verifyOutputPanelText(outputPanelText: string, expectedTexts: string[]): Promise<void> {
  log(`verifyOutputPanelText() - ${outputPanelText}`);
  for (const expectedText of expectedTexts) {
    log(`Expected text:\n ${expectedText}`);
    expect(outputPanelText).to.include(expectedText);
  }
}

// If found, this function returns the entire text that's in the Output panel.
export async function attemptToFindOutputPanelText(
  outputChannelName: string,
  searchString: string,
  attempts: number
): Promise<string | undefined> {
  debug(`attemptToFindOutputPanelText in channel "${outputChannelName}: with string "${searchString}"`);
  while (attempts > 0) {
    const outputViewText = await getOutputViewText(outputChannelName);
    if (outputViewText.includes(searchString)) {
      return outputViewText;
    }

    await pause(Duration.seconds(1));
    attempts--;
  }

  return undefined;
}

export async function getOperationTime(outputText: string): Promise<string> {
  const tRegex = /((?<hours>\d+):(?<minutes>\d+):(?<seconds>\d+)(?<secondFraction>\.\d+))/g;
  let matches;
  const times: Date[] = [];
  while ((matches = tRegex.exec(outputText)) !== null) {
    if (matches.groups) {
      const { hours, minutes, seconds, secondFraction } = matches.groups;
      const time = new Date(1970, 0, 1, Number(hours), Number(minutes), Number(seconds), Number(secondFraction) * 1000);
      times.push(time);
    }
  }
  if (times.length < 2) {
    return 'Insufficient timestamps found.';
  }
  const [startTime, endTime] = times;
  let diff = endTime.getTime() - startTime.getTime();

  const hours = Math.floor(diff / 3600000); // 1000 * 60 * 60
  diff %= 3600000;
  const minutes = Math.floor(diff / 60000); // 1000 * 60
  diff %= 60000;
  const seconds = Math.floor(diff / 1000);
  const milliseconds = diff % 1000;

  return `${formatTimeComponent(hours)}:${formatTimeComponent(minutes)}:${formatTimeComponent(seconds)}.${formatTimeComponent(milliseconds, 3)}`;
}

export async function clearOutputView(wait = Duration.seconds(1)) {
  if (process.platform === 'linux') {
    // In Linux, clear the output by clicking the "Clear Output" button in the Output Tab
    const outputView = await new BottomBarPanel().openOutputView();
    const clearButton = await outputView.findElement(By.className('codicon-clear-all'));
    await outputView.getDriver().executeScript("arguments[0].click();", clearButton);
  } else {
    // In Mac and Windows, clear the output by calling the "View: Clear Output" command in the command palette
    await executeQuickPick('View: Clear Output', wait);
  }
}

function formatTimeComponent(component: number, padLength: number = 2): string {
  return component.toString().padStart(padLength, '0');
}
