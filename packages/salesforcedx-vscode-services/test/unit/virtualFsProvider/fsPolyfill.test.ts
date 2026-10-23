/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { getVirtualFs } from '@salesforce/core/fs';

describe('browser fs polyfill', () => {
  it('removes undefined writeFile options before passing them to memfs', async () => {
    const originalForceMemfs = process.env.FORCE_MEMFS;
    process.env.FORCE_MEMFS = 'true';
    const memfs = getVirtualFs();
    if (originalForceMemfs === undefined) delete process.env.FORCE_MEMFS;
    else process.env.FORCE_MEMFS = originalForceMemfs;

    memfs.mkdirSync('/workspace', { recursive: true });
    const module = { exports: {} as Record<string, unknown> };
    const source = readFileSync(new URL('../../../../../scripts/bundling/fs-polyfill.js', import.meta.url), 'utf8');

    runInNewContext(source, {
      module,
      require: () => ({ fs: memfs, getVirtualFs: () => memfs }),
    });

    const fs = module.exports as unknown as typeof memfs;
    const options = { signal: new AbortController().signal, flag: undefined, mode: undefined };
    await new Promise<void>((resolve, reject) => {
      fs.writeFile('/workspace/callback.txt', 'callback', options, (error: NodeJS.ErrnoException | null) =>
        error ? reject(error) : resolve()
      );
    });
    await fs.promises.writeFile('/workspace/promise.txt', 'promise', options);
    await Reflect.apply(fs.writeFile, fs, ['/workspace/no-callback.txt', 'no callback', options]);
    fs.writeFileSync('/workspace/sync.txt', 'sync', options);

    expect(fs.readFileSync('/workspace/callback.txt', 'utf8')).toBe('callback');
    expect(fs.readFileSync('/workspace/promise.txt', 'utf8')).toBe('promise');
    expect(fs.readFileSync('/workspace/no-callback.txt', 'utf8')).toBe('no callback');
    expect(fs.readFileSync('/workspace/sync.txt', 'utf8')).toBe('sync');
  });
});
