/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container port of codeCoverageColorizer.headless.spec.ts. Running Apex tests with code
 * coverage requires salesforcedx-vscode-apex, which has no browser bundle, so the web twin cannot
 * produce coverage. The Code Builder image runs the DESKTOP build in a Node host, so the covered
 * (green) / uncovered (red) line colorizer works end-to-end against the boot org (one tracking
 * scratch org authed as default target-org). This scenario needs a class with one covered and one
 * uncovered branch, so it authors uniquely-named classes (rather than reusing the seeded classes)
 * and deploys them. Theme is pinned (constants.ts PINNED_THEME) so the covered/uncovered RGBA
 * constants resolve identically.
 */

import { expect, type Page } from '@playwright/test';
import {
  clearAllNotifications,
  clearOutputChannel,
  closeAllEditors,
  createApexClass,
  deployCurrentSourceToOrg,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  openFileByName,
  saveScreenshot,
  selectOutputChannel,
  selectQuickInputOptionByTyping,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  upsertSettings,
  validateNoCriticalErrors,
  waitForOutputChannelText,
  waitForRunApexTestsProgressNotificationGone
} from '@salesforce/playwright-vscode-ext';

import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';
import { COVERED_BG_RGBA, PINNED_THEME, TEST_RUN_TIMEOUT, UNCOVERED_BG_RGBA } from '../../constants';

/**
 * Count `.view-overlays` decoration divs whose computed background-color exactly matches
 * `targetRgba`. The colorizer renders covered/uncovered line backgrounds as decoration divs nested
 * under `.view-overlays` (matched here via `.view-overlays > div > div`); matching by the
 * pinned-theme RGBA isolates the coverage decorations from unrelated overlays (e.g. the
 * current-line highlight).
 */
const countOverlaysWithBg = async (editor: ReturnType<Page['locator']>, targetRgba: string): Promise<number> =>
  editor.evaluate((el, rgba) => {
    const children = el.querySelectorAll('.view-overlays > div > div');
    return Array.from(children).filter(child => getComputedStyle(child).backgroundColor === rgba).length;
  }, targetRgba);

test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
  await ensureOutputPanelOpen(page);
  await selectOutputChannel(page, 'Apex Testing');
  await clearOutputChannel(page);
});

test('Code coverage colorizer: green covered + red uncovered lines, cleared on toggle-off', async ({ page }) => {
  test.setTimeout(TEST_RUN_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const className = `ColorizerBranch${Date.now()}`;
  const testClassName = `ColorizerBranchTest${Date.now()}`;
  const editor = page.locator(`.monaco-editor[data-uri$="${className}.cls"]`).first();

  // Deploy the currently open editor to the boot org, waiting on the Salesforce Metadata channel.
  const deployActiveEditor = async (): Promise<void> => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', TEST_RUN_TIMEOUT);
    await clearOutputChannel(page);
    await deployCurrentSourceToOrg(page, { waitViaOutputChannel: true });
  };

  await test.step('pin theme + enable coverage retrieval', async () => {
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
    await deployActiveEditor();
    await saveScreenshot(page, 'step.branch-class-deployed.png');
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
    await createApexClass(page, testClassName, testContent);
    await deployActiveEditor();
    await saveScreenshot(page, 'step.test-class-deployed.png');
  });

  await test.step('run the test class via command palette (coverage enabled)', async () => {
    await executeCommandWithCommandPalette(page, packageNls.apex_test_run_text);
    await selectQuickInputOptionByTyping(page, testClassName);
    await waitForRunApexTestsProgressNotificationGone(page, { timeout: TEST_RUN_TIMEOUT });
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await waitForOutputChannelText(page, { expectedText: '=== Test Summary', timeout: TEST_RUN_TIMEOUT });
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Run Apex Tests' });
    await saveScreenshot(page, 'step.test-run-complete.png');
  });

  await test.step('open NON-test class and toggle colorizer ON', async () => {
    await openFileByName(page, `${className}.cls`);
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    await editor.locator('.view-line').first().waitFor({ state: 'visible', timeout: 10_000 });

    const toggle = page.getByRole('button', { name: /Highlight Apex Code Coverage/ });
    await toggle.waitFor({ state: 'visible', timeout: 15_000 });
    await toggle.click();
    await saveScreenshot(page, 'step.colorizer-on.png');
  });

  await test.step('GATE: no missing-coverage notification', async () => {
    // getCoverageData throws (surfacing colorizer_no_code_coverage_* as a warning notification)
    // when test-result*.json with codecoverage is absent. Its absence proves coverage JSON was written.
    const noCoverageNotification = page
      .locator('.notification-list-item')
      .filter({ hasText: /No (code coverage|test run) information was found/i });
    await expect(noCoverageNotification, 'colorizer coverage gate: no missing-coverage notification').toHaveCount(0);
  });

  await test.step('assert >=1 green (covered) and >=1 red (uncovered) line highlighted', async () => {
    await expect
      .poll(() => countOverlaysWithBg(editor, COVERED_BG_RGBA), {
        message: `expected >=1 covered (green ${COVERED_BG_RGBA}) overlay`,
        timeout: 15_000
      })
      .toBeGreaterThan(0);
    await expect
      .poll(() => countOverlaysWithBg(editor, UNCOVERED_BG_RGBA), {
        message: `expected >=1 uncovered (red ${UNCOVERED_BG_RGBA}) overlay`,
        timeout: 15_000
      })
      .toBeGreaterThan(0);
    await saveScreenshot(page, 'step.colorizer-highlighted.png');
  });

  await test.step('toggle colorizer OFF and assert all highlighting cleared', async () => {
    const toggle = page.getByRole('button', { name: /Highlight Apex Code Coverage/ });
    await toggle.click();
    await expect
      .poll(() => countOverlaysWithBg(editor, COVERED_BG_RGBA), {
        message: 'expected zero covered (green) overlays after toggle-off',
        timeout: 15_000
      })
      .toBe(0);
    await expect
      .poll(() => countOverlaysWithBg(editor, UNCOVERED_BG_RGBA), {
        message: 'expected zero uncovered (red) overlays after toggle-off',
        timeout: 15_000
      })
      .toBe(0);
    await saveScreenshot(page, 'step.colorizer-cleared.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
