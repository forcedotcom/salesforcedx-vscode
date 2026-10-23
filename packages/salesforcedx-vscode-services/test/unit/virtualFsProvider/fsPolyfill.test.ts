/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createFsFromVolume, Volume } from 'memfs';

describe('browser fs polyfill', () => {
  it('removes undefined writeFile options before passing them to memfs', async () => {
    const memfs = createFsFromVolume(new Volume());
    memfs.mkdirSync('/workspace', { recursive: true });
    const module = { exports: {} as Record<string, unknown> };
    const source = readFileSync(new URL('../../../../../scripts/bundling/fs-polyfill.js', import.meta.url), 'utf8');

    runInNewContext(source, {
      module,
      require: () => ({ fs: memfs, getVirtualFs: () => memfs }),
    });

    const fs = module.exports as unknown as typeof memfs;
    const options = { flag: undefined, mode: undefined };
    await new Promise<void>((resolve, reject) => {
      fs.writeFile('/workspace/callback.txt', 'callback', options, error => (error ? reject(error) : resolve()));
    });
    await fs.promises.writeFile('/workspace/promise.txt', 'promise', options);
    fs.writeFileSync('/workspace/sync.txt', 'sync', options);

    expect(fs.readFileSync('/workspace/callback.txt', 'utf8')).toBe('callback');
    expect(fs.readFileSync('/workspace/promise.txt', 'utf8')).toBe('promise');
    expect(fs.readFileSync('/workspace/sync.txt', 'utf8')).toBe('sync');
  });
});
