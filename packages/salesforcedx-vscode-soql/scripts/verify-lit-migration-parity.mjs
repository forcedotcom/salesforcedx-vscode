/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [desktopExtension, webExtension, application, html] = await Promise.all([
  readFile(new URL('../dist-migration/index.js', import.meta.url), 'utf8'),
  readFile(new URL('../dist-migration/web/index.js', import.meta.url), 'utf8'),
  readFile(new URL('../dist-migration/soql-builder-ui/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../dist-migration/soql-builder-ui/index.html', import.meta.url), 'utf8')
]);

for (const [runtime, extension] of [
  ['desktop', desktopExtension],
  ['web', webExtension]
]) {
  assert.match(extension, /soql-builder-ui/u, `${runtime} extension must resolve the shared SOQL Builder assets`);
}

assert.match(application, /soql-builder-action/u, 'shared migration assets must contain the Lit action contract');
assert.doesNotMatch(application, /lit[-_ ]?spike/iu, 'shared migration assets must not retain spike naming');
assert.match(html, /src="\.\/app\.js"/u, 'shared migration HTML must load its local Lit bundle');

console.log('Verified Lit migration parity for desktop and web extension bundles.');
