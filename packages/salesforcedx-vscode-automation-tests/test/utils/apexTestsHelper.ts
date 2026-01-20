/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { getWorkbench } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import { BottomBarPanel, By, InputBox, QuickOpenBox, VSBrowser } from 'vscode-extension-tester';

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

/** Opens the Test Results tab and returns all xterm output text including scrolled content */
export const getTestResultsTabText = async (): Promise<string> => {
  await new BottomBarPanel().openTab('Test Results');

  // xterm.js virtualizes content, so .xterm-rows only shows visible rows.
  // We need to extract all lines from the terminal buffer via JavaScript.
  const driver = VSBrowser.instance.driver;
  const text = await driver.executeScript<string>(`
    const container = document.querySelector('.test-output-peek-message-container .xterm');
    if (!container) return '';
    // xterm.js stores the Terminal instance on the element
    const term = container._xterm || container.terminal;
    if (term && term.buffer && term.buffer.active) {
      const buffer = term.buffer.active;
      const lines = [];
      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) {
          lines.push(line.translateToString(true));
        }
      }
      return lines.join('\\n');
    }
    // Fallback: just get visible text from DOM
    const rows = document.querySelector('.test-output-peek-message-container .xterm-rows');
    return rows ? rows.innerText : '';
  `);

  return text ?? '';
};
