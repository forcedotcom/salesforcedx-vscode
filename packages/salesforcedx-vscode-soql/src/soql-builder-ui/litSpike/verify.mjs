/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const distDirectory = fileURLToPath(new URL('../dist/', import.meta.url));
const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8']
]);

const server = createServer(async (request, response) => {
  const requestedPath = request.url === '/' ? '/lit-spike.html' : request.url;
  const normalizedPath = path.normalize(decodeURIComponent(requestedPath ?? '/lit-spike.html')).replace(/^[/\\]+/, '');
  const filePath = path.join(distDirectory, normalizedPath);

  if (!filePath.startsWith(distDirectory)) {
    response.writeHead(403).end();
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, { 'content-type': contentTypes.get(path.extname(filePath)) ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (!address || typeof address === 'string') {
  throw new Error('Unable to start the Lit spike verification server.');
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const browserErrors = [];
const failedRequests = [];
page.on('pageerror', error => browserErrors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') browserErrors.push(message.text());
});
page.on('requestfailed', request => failedRequests.push(`${request.url()}: ${request.failure()?.errorText ?? 'failed'}`));
page.on('response', response => {
  if (!response.ok()) failedRequests.push(`${response.url()}: HTTP ${response.status()}`);
});
page.setDefaultTimeout(10_000);

try {
  await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'networkidle' });

  await page.waitForFunction(() => {
    const app = document.querySelector('soql-builder-lit-spike');
    const select = app?.shadowRoot?.querySelector('vscode-single-select');
    return Boolean(select?.shadowRoot?.querySelector('.face'));
  });
  await page.evaluate(() => {
    const app = document.querySelector('soql-builder-lit-spike');
    const select = app?.shadowRoot?.querySelector('vscode-single-select');
    select?.shadowRoot?.querySelector('.face')?.click();
  });
  await page.waitForFunction(() => {
    const app = document.querySelector('soql-builder-lit-spike');
    const select = app?.shadowRoot?.querySelector('vscode-single-select');
    return Array.from(select?.shadowRoot?.querySelectorAll('li.option') ?? []).some(option => option.textContent?.trim() === 'Account');
  });
  await page.evaluate(() => {
    const app = document.querySelector('soql-builder-lit-spike');
    const select = app?.shadowRoot?.querySelector('vscode-single-select');
    const option = Array.from(select?.shadowRoot?.querySelectorAll('li.option') ?? []).find(item => item.textContent?.trim() === 'Account');
    option?.click();
  });

  await page.waitForFunction(() => {
    const app = document.querySelector('soql-builder-lit-spike');
    const select = app?.shadowRoot?.querySelector('vscode-multi-select');
    return Boolean(select && !select.hasAttribute('disabled') && select.querySelector('vscode-option[value="Name"]'));
  });
  await page.evaluate(() => {
    const app = document.querySelector('soql-builder-lit-spike');
    const select = app?.shadowRoot?.querySelector('vscode-multi-select');
    select?.shadowRoot?.querySelector('.face')?.click();
  });
  for (const fieldName of ['Id', 'Name']) {
    await page.waitForFunction(name => {
      const app = document.querySelector('soql-builder-lit-spike');
      const select = app?.shadowRoot?.querySelector('vscode-multi-select');
      return Array.from(select?.shadowRoot?.querySelectorAll('li.option') ?? []).some(option => option.textContent?.trim() === name);
    }, fieldName);
    await page.evaluate(name => {
      const app = document.querySelector('soql-builder-lit-spike');
      const select = app?.shadowRoot?.querySelector('vscode-multi-select');
      const option = Array.from(select?.shadowRoot?.querySelectorAll('li.option') ?? []).find(item => item.textContent?.trim() === name);
      option?.click();
    }, fieldName);
  }
  await page.evaluate(() => {
    const app = document.querySelector('soql-builder-lit-spike');
    const select = app?.shadowRoot?.querySelector('vscode-multi-select');
    select?.shadowRoot?.querySelector('vscode-button.button-accept')?.click();
  });

  await page.waitForFunction(() => {
    const app = document.querySelector('soql-builder-lit-spike');
    const previewText = app?.shadowRoot?.querySelector('[data-testid="query-preview"]')?.textContent;
    return previewText?.replace(/\s+/g, ' ').trim() === 'SELECT Id, Name FROM Account';
  });
  const previewText = await page.evaluate(() => {
    const text = document
      .querySelector('soql-builder-lit-spike')
      ?.shadowRoot?.querySelector('[data-testid="query-preview"]')?.textContent;
    return text?.replace(/\s+/g, ' ').trim();
  });
  if (previewText !== 'SELECT Id, Name FROM Account') {
    throw new Error(`Unexpected query preview: ${previewText ?? '<empty>'}`);
  }
  if (browserErrors.length > 0) {
    throw new Error(`Browser errors: ${browserErrors.join('; ')}`);
  }

  process.stdout.write(`Lit spike verified: ${previewText}\n`);
} catch (error) {
  const bodyText = await page.locator('body').innerText().catch(() => '<body unavailable>');
  const diagnostics = await page.evaluate(() => {
    const host = document.querySelector('soql-builder-lit-spike');
    return {
      customElementRegistered: Boolean(customElements.get('soql-builder-lit-spike')),
      hostConnected: host?.isConnected,
      hostFields: host?.fields,
      hostHasModelService: Boolean(host?.modelService),
      hostHasRuntime: Boolean(host?.runtime),
      hostHasToolingSdk: Boolean(host?.toolingSDK),
      hostIsObjectsLoading: host?.isObjectsLoading,
      hostObjects: host?.sObjects,
      hostShadowMarkup: host?.shadowRoot?.innerHTML ?? '<missing>',
      selectRegistered: Boolean(customElements.get('vscode-single-select')),
      selectShadowMarkup:
        host?.shadowRoot?.querySelector('vscode-single-select')?.shadowRoot?.innerHTML ?? '<missing>',
      mainMarkup: document.querySelector('#main')?.innerHTML ?? '<missing>',
      readyState: document.readyState,
      scripts: Array.from(document.scripts, script => ({ src: script.src, type: script.type }))
    };
  });
  throw new Error(
    `${error instanceof Error ? error.message : String(error)}\nBrowser errors: ${browserErrors.join('; ') || '<none>'}\nFailed requests: ${failedRequests.join('; ') || '<none>'}\nDiagnostics: ${JSON.stringify(diagnostics)}\nBody: ${bodyText}`
  );
} finally {
  await page.close();
  await browser.close();
  await new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
}
