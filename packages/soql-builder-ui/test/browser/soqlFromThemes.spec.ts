/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, test } from '@playwright/test';
import { builder, fromSelect, mountBuilder } from './helpers.js';

const themes = [
  {
    className: 'vscode-light',
    description: 'rgb(70, 80, 90)',
    error: 'rgb(180, 20, 30)'
  },
  {
    className: 'vscode-dark',
    description: 'rgb(170, 180, 190)',
    error: 'rgb(255, 120, 130)'
  },
  {
    className: 'vscode-high-contrast',
    description: 'rgb(255, 255, 255)',
    error: 'rgb(255, 255, 0)'
  }
] as const;

test('uses VS Code theme tokens in light, dark, and high-contrast themes', async ({ page }) => {
  await mountBuilder(page, {
    metadata: { objects: [] },
    query: {
      parseErrors: [
        {
          charInLine: 9,
          lineNumber: 1,
          message: 'Expected an object after FROM',
          type: 'INCOMPLETEFROM'
        }
      ]
    }
  });

  for (const theme of themes) {
    await test.step(theme.className, async () => {
      await page.evaluate(currentTheme => {
        document.body.className = currentTheme.className;
        document.body.style.setProperty('--vscode-descriptionForeground', currentTheme.description);
        document.body.style.setProperty('--vscode-inputValidation-errorForeground', currentTheme.error);
      }, theme);

      await expect(fromSelect(page)).toBeVisible();
      await expect
        .poll(() =>
          builder(page)
            .locator('soql-builder-from .status')
            .evaluate(node => getComputedStyle(node).color)
        )
        .toBe(theme.description);
      await expect
        .poll(() =>
          builder(page)
            .locator('soql-builder-from .required')
            .evaluate(node => getComputedStyle(node).color)
        )
        .toBe(theme.error);
    });
  }
});
