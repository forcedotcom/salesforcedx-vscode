/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { createSoqlBuilderServer } from '../out/src/server.js';

test('drives the packaged UI through the standalone HTTP host', async () => {
  const dataSource = {
    listSObjects: async () => [
      { custom: false, label: 'Account', name: 'Account', queryable: true },
      { custom: false, label: 'Contact', name: 'Contact', queryable: true }
    ],
    describeSObject: async () => [
      { label: 'Account ID', name: 'Id', nillable: false, type: 'id' },
      { label: 'Account Name', name: 'Name', nillable: false, type: 'string' }
    ]
  };
  const server = createSoqlBuilderServer(dataSource);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(10_000);
  try {
    await page.goto(`http://127.0.0.1:${address.port}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => {
      const app = document.querySelector('soql-builder-app');
      return app?.host?.kind === 'http' && app.viewState?.sObjects?.includes('Account');
    });
    await page.evaluate(() => {
      const app = document.querySelector('soql-builder-app');
      const select = app?.shadowRoot?.querySelector('vscode-single-select');
      select?.shadowRoot?.querySelector('.face')?.click();
    });
    await page.waitForFunction(() => {
      const app = document.querySelector('soql-builder-app');
      const select = app?.shadowRoot?.querySelector('vscode-single-select');
      return Array.from(select?.shadowRoot?.querySelectorAll('li.option') ?? []).some(
        option => option.textContent?.trim() === 'Account'
      );
    });
    await page.evaluate(() => {
      const app = document.querySelector('soql-builder-app');
      const select = app?.shadowRoot?.querySelector('vscode-single-select');
      const option = Array.from(select?.shadowRoot?.querySelectorAll('li.option') ?? []).find(
        item => item.textContent?.trim() === 'Account'
      );
      option?.click();
    });
    await page.waitForFunction(() => {
      const app = document.querySelector('soql-builder-app');
      return app?.viewState?.availableFields?.includes('Name');
    });
    await page.evaluate(() => {
      const app = document.querySelector('soql-builder-app');
      app?.host?.selectFields(['Id', 'Name']);
    });
    const query = await page.evaluate(() => {
      const app = document.querySelector('soql-builder-app');
      return app?.shadowRoot?.querySelector('[data-testid="query-preview"]')?.textContent?.replace(/\s+/g, ' ').trim();
    });
    assert.equal(query, 'SELECT Id, Name FROM Account');
  } finally {
    await page.close();
    await browser.close();
    await new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  }
});
