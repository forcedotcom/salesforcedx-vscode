/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { pause, Duration } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core';
import { getWorkbench } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import { BottomBarPanel, By, InputBox, QuickOpenBox, WebElement } from 'vscode-extension-tester';

/** Finds a checkbox element using multiple selectors for VS Code version compatibility */
export const findCheckboxElement = async (prompt: InputBox | QuickOpenBox) => {
  const selectors = [
    'div.monaco-custom-toggle.monaco-checkbox', // VSCode 1.103.0
    'div.monaco-custom-toggle.codicon.codicon-check.monaco-checkbox',
    'input.quick-input-list-checkbox'
  ];

  for (const selector of selectors) {
    try {
      const element = await prompt.findElement(By.css(selector));
      if (element) {
        return element;
      }
    } catch {
      continue;
    }
  }

  throw new Error(`Could not find checkbox element with any of the selectors: ${selectors.join(', ')}`);
};

/** Verifies expected test items appear in the Test Explorer tree */
export const verifyTestItems = async (expectedTestNames: string[]): Promise<string[]> => {
  for (const testName of expectedTestNames) {
    const testRow = await getWorkbench().findElement(
      By.css(`.monaco-list-row[role="treeitem"][aria-label*="${testName}"]`)
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(testRow).to.not.be.undefined;
  }

  return expectedTestNames;
};

/** Verifies test items have the expected icon (pass/fail) after test execution */
export const verifyTestItemsIconColor = async (
  testNames: string[],
  expectedIcon: 'testPass' | 'testFail'
): Promise<void> => {
  const iconClass = expectedIcon === 'testPass' ? 'codicon-testing-passed-icon' : 'codicon-testing-failed-icon';

  for (const testName of testNames) {
    const testRow = await getWorkbench().findElement(
      By.css(`.monaco-list-row[role="treeitem"][aria-label*="${testName}"]`)
    );
    const iconElement = await testRow.findElement(By.css('.computed-state'));
    const classList = await iconElement.getAttribute('class');
    expect(classList).to.include(iconClass, `Expected ${testName} to have ${expectedIcon} icon`);
  }
};

/** Wrapper for test tree items with common actions */
export type TestTreeItem = {
  click: () => Promise<void>;
  getActionButton: (label: string) => Promise<WebElement | undefined>;
};

/** Finds a test item in the Test Explorer by name using aria-label selector */
export const findTestItemByName = async (testName: string): Promise<TestTreeItem> => {
  const row = await getWorkbench().findElement(
    By.css(`.monaco-list-row[role="treeitem"][aria-label*="${testName}"]`)
  );

  if (!row) {
    throw new Error(`Could not find test item: ${testName}`);
  }

  return {
    click: async () => await row.click(),
    getActionButton: async (label: string) => {
      try {
        return await row.findElement(By.css(`a[aria-label="${label}"]`));
      } catch {
        return undefined;
      }
    }
  };
};

/** Opens the Test Results tab, maximizes panel, and returns the xterm output text */
export const getTestResultsTabText = async (): Promise<string> => {
  const bottomBar = new BottomBarPanel();
  await bottomBar.openTab('Test Results');

  // Maximize the panel to ensure all content is visible (not hidden by scroll)
  await bottomBar.maximize();
  await pause(Duration.seconds(1));

  const xtermRows = await getWorkbench().findElement(By.css('.xterm-rows'));
  const text = await xtermRows.getText();

  // Restore the panel to original size
  await bottomBar.restore();

  return text;
};
