/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Global, StateAggregator } from '@salesforce/core';
import assert from 'node:assert/strict';
import type * as Os from 'node:os';
import { join } from 'node:path';
import { Utils } from 'vscode-uri';
import { createMetadataOperationTest } from '../support/metadataOperation.js';

it('isolates SDK keychain and auth paths under one home and decrypts persisted credentials through a fresh SDK instance', async () => {
  const fixture = await createMetadataOperationTest();
  try {
    // setupVitest mocks ESM homedir to /tmp; the real SDK's CommonJS keychain uses the actual Node lookup.
    const { homedir } = await vi.importActual<typeof Os>('node:os');
    const home = Utils.joinPath(fixture.root, 'home').fsPath;
    expect(homedir()).toBe(home);
    expect(Global.DIR).toBe(join(home, Global.SFDX_STATE_FOLDER));
    expect(Global.SF_DIR).toBe(join(home, Global.SF_STATE_FOLDER));
    await StateAggregator.clearInstanceAsync();
    const username = fixture.connection.getUsername();
    assert.ok(username);
    const fresh = await AuthInfo.create({ username });
    expect(fresh.getFields(true)).toMatchObject({
      accessToken: 'fixture-secret',
      refreshToken: 'fixture-refresh-secret'
    });
  } finally {
    await fixture.dispose();
  }
});
