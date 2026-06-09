/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  createApexClass,
  createAndDeployApexTestClass,
  deployCurrentSourceToOrg,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  isDesktop,
  openFileByName,
  QUICK_INPUT_LIST_ROW,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  setupNonTrackingOrgAndAuth,
  upsertSettings,
  validateNoCriticalErrors,
  waitForOutputChannelText,
  waitForRunApexTestsProgressNotificationGone
} from '@salesforce/playwright-vscode-ext';

import packageNls from '../../../package.nls.json';
import { test } from '../fixtures';
import { TEST_RUN_TIMEOUT } from '../contants';

// Pin the theme so resolved RGB(A) for testing.coveredBackground / testing.uncoveredBackground
// is deterministic across CI + local. The harness workspace default is "Dark 2026"; pin it
// explicitly (matches the exact combobox option label in the Settings UI).
const PINNED_THEME = 'Dark 2026';

test('Code coverage colorizer spike: DOM queryable, theme pinned, coverage JSON gate', async ({ page }) => {
  test.setTimeout(TEST_RUN_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const className = `ColorizerBranch${Date.now()}`;
  const testClassName = `ColorizerBranchTest${Date.now()}`;

  await test.step('setup non-tracking org + pin theme + enable coverage retrieval', async () => {
    await setupNonTrackingOrgAndAuth(page);
    await ensureSecondarySideBarHidden(page);
    await upsertSettings(page, {
      'workbench.colorTheme': PINNED_THEME,
      'salesforcedx-vscode-apex-testing.retrieve-test-code-coverage': 'true'
    });
  });

  await test.step('deploy NON-test branch class (one path covered, one not)', async () => {
    // The test exercises ONLY the true branch, so the else branch line stays uncovered.
    const branchContent = [
      `public class ${className} {`,
      '    public static Integer pick(Boolean flag) {',
      '        if (flag) {',
      '            return 1;',
      '        } else {',
      '            return 2;',
      '        }',
      '    }',
      '}'
    ].join('\n');
    await createApexClass(page, className, branchContent);
    if (isDesktop()) {
      await deployCurrentSourceToOrg(page, { waitViaOutputChannel: true });
    }
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', TEST_RUN_TIMEOUT);
    await waitForOutputChannelText(page, { expectedText: className, timeout: TEST_RUN_TIMEOUT });
    await saveScreenshot(page, 'spike.branch-class-deployed.png');
  });

  await test.step('deploy test class exercising only the covered (true) path', async () => {
    const testContent = [
      '@isTest',
      `public class ${testClassName} {`,
      '    @isTest',
      '    static void coversTruePath() {',
      `        System.assertEquals(1, ${className}.pick(true), 'true path returns 1');`,
      '    }',
      '}'
    ].join('\n');
    await createAndDeployApexTestClass(page, testClassName, testContent);
    await saveScreenshot(page, 'spike.test-class-deployed.png');
  });

  await test.step('run the test class via command palette (coverage enabled)', async () => {
    await executeCommandWithCommandPalette(page, packageNls.apex_test_run_text);
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
    await page.keyboard.type(testClassName);
    const testClassOption = page.locator(QUICK_INPUT_LIST_ROW).filter({ hasText: new RegExp(testClassName, 'i') });
    await testClassOption.waitFor({ state: 'visible', timeout: 10_000 });
    await testClassOption.click();
    await waitForRunApexTestsProgressNotificationGone(page, { timeout: TEST_RUN_TIMEOUT });
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await waitForOutputChannelText(page, { expectedText: '=== Test Summary', timeout: TEST_RUN_TIMEOUT });
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests' });
    await saveScreenshot(page, 'spike.test-run-complete.png');
  });

  await test.step('open NON-test class and toggle colorizer ON', async () => {
    await openFileByName(page, `${className}.cls`);
    const editor = page.locator(`.monaco-editor[data-uri$="${className}.cls"]`);
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    await editor.locator('.view-line').first().waitFor({ state: 'visible', timeout: 10_000 });

    const toggle = page.getByRole('button', { name: /Highlight Apex Code Coverage/ });
    await toggle.waitFor({ state: 'visible', timeout: 15_000 });
    await toggle.click();
    await saveScreenshot(page, 'spike.colorizer-on.png');
  });

  await test.step('GATE: no missing-coverage notification', async () => {
    // getCoverageData throws (surfacing colorizer_no_code_coverage_* as a warning notification)
    // when test-result*.json with codecoverage is absent. Its absence proves coverage JSON was written.
    const noCoverageNotification = page
      .locator('.notification-list-item')
      .filter({ hasText: /No (code coverage|test run) information was found/i });
    await expect(noCoverageNotification, 'colorizer coverage gate: no missing-coverage notification').toHaveCount(0);
  });

  await test.step('SPIKE: dump .view-overlays DOM + capture computed RGB per theme', async () => {
    const editor = page.locator(`.monaco-editor[data-uri$="${className}.cls"]`);
    // Read every overlay child div's computed background-color so we can confirm the
    // TextEditorDecorationType backgrounds render into queryable DOM (not canvas / ::before).
    const overlayInfo = await editor.evaluate(el => {
      const overlays = el.querySelectorAll('.view-overlays > div');
      const colors: { idx: number; bg: string; html: string }[] = [];
      overlays.forEach((node, idx) => {
        const children = node.querySelectorAll('div');
        children.forEach(child => {
          const bg = getComputedStyle(child).backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
            colors.push({ idx, bg, html: child.outerHTML.slice(0, 200) });
          }
        });
      });
      return {
        theme: document.body.className,
        overlayCount: overlays.length,
        coloredChildren: colors
      };
    });
    console.log('[COLORIZER SPIKE] view-overlays computed bg:', JSON.stringify(overlayInfo, null, 2));

    expect(
      overlayInfo.coloredChildren.length,
      'spike: expected >=1 .view-overlays child div with a non-transparent computed background-color'
    ).toBeGreaterThan(0);
    await saveScreenshot(page, 'spike.view-overlays-dumped.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
