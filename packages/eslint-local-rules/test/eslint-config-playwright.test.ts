/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { spawnSync } from 'node:child_process';
import * as path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');
const playwrightFile = path.join(
  repoRoot,
  'packages/playwright-vscode-ext/test/playwright/specs/commandPalette.headless.spec.ts'
);
const ruleId = 'playwright/no-force-option';

const lintPlaywright = (code: string): number => {
  const eslint = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, 'node_modules/eslint/bin/eslint.js'),
      '--stdin',
      '--stdin-filename',
      playwrightFile,
      '--format',
      'json'
    ],
    { cwd: repoRoot, encoding: 'utf8', input: code }
  );
  if (eslint.error) throw eslint.error;
  const [result] = JSON.parse(eslint.stdout) as Array<{ messages: Array<{ ruleId: string | null }> }>;
  return result.messages.filter(message => message.ruleId === ruleId).length;
};

describe('Playwright ESLint configuration', () => {
  it('reports an ordinary forced Playwright action', () => {
    expect(
      lintPlaywright(`import { test } from '@playwright/test';
test('click', async ({ page }) => {
  await page.getByRole('button').click({ force: true });
});`)
    ).toBe(1);
  });

  it('allows the documented Windows Test Explorer tooltip workaround', () => {
    expect(
      lintPlaywright(`import { test } from '@playwright/test';
test('click', async ({ page }) => {
  // eslint-disable-next-line playwright/no-force-option -- Windows Test Explorer tooltip intercepts pointer events
  await page.getByRole('button').click({ force: true });
});`)
    ).toBe(0);
  });

  it('does not report Node filesystem force options', () => {
    expect(
      lintPlaywright(`import { test } from '@playwright/test';
import * as fs from 'node:fs/promises';
test('remove', async () => {
  await fs.rm('tmp', { force: true });
});`)
    ).toBe(0);
  });
});
