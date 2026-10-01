/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [application, html] = await Promise.all([
  readFile(new URL('../src/soql-builder-ui/dist-lit/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/soql-builder-ui/dist-lit/index.html', import.meta.url), 'utf8')
]);

assert.match(application, /soql-builder-action/u, 'bundle must contain the Lit application action event');
assert.doesNotMatch(application, /lit[-_ ]?spike/iu, 'bundle must not retain spike naming');
assert.doesNotMatch(html, /<script[^>]+https?:/iu, 'webview HTML must not load remote scripts');
assert.match(html, /<!-- CSP TAG -->/u, 'webview HTML must retain the extension CSP placeholder');
assert.match(html, /src="\.\/app\.js"/u, 'webview HTML must load the local application bundle');

console.log('Verified the production-shaped Lit migration bundle.');
