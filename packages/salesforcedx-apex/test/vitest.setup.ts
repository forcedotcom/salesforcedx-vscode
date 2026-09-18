/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// @salesforce/core TestContext resolves the alias file under
// `${os.tmpdir()}/.sfdx/alias.json` and AliasAccessor.init reads it eagerly.
// Ensure the file exists so the read does not surface a fatal ENOENT under jest.
const aliasFile = join(tmpdir(), '.sfdx', 'alias.json');
if (!existsSync(aliasFile)) {
  mkdirSync(join(tmpdir(), '.sfdx'), { recursive: true });
  writeFileSync(aliasFile, '{}');
}
