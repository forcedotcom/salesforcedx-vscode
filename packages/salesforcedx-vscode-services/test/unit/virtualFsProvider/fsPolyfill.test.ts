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
  const loadFsPolyfill = (file: string, memfs: ReturnType<typeof getVirtualFs>): unknown => {
    const module = { exports: {} as Record<string, unknown> };
    const source = readFileSync(new URL(`../../../../../scripts/bundling/${file}`, import.meta.url), 'utf8');
    runInNewContext(source, {
      module,
      require: () => ({ fs: memfs, getVirtualFs: () => memfs }),
    });
    return module.exports;
  };

  const makeMemfs = () => {
    const originalForceMemfs = process.env.FORCE_MEMFS;
    process.env.FORCE_MEMFS = 'true';
    const memfs = getVirtualFs();
    if (originalForceMemfs === undefined) delete process.env.FORCE_MEMFS;
    else process.env.FORCE_MEMFS = originalForceMemfs;
    memfs.mkdirSync('/workspace', { recursive: true });
    return memfs;
  };

  it('normalizes undefined options for callback and sync writes', async () => {
    const memfs = makeMemfs();
    const fs = loadFsPolyfill('fs-polyfill.js', memfs) as unknown as typeof memfs;
    const options = { signal: new AbortController().signal, flag: undefined, mode: undefined };
    await new Promise<void>((resolve, reject) => {
      fs.writeFile('/workspace/callback.txt', 'callback', options, (error: NodeJS.ErrnoException | null) =>
        error ? reject(error) : resolve()
      );
    });
    fs.writeFileSync('/workspace/sync.txt', 'sync', options);

    expect(fs.readFileSync('/workspace/callback.txt', 'utf8')).toBe('callback');
    expect(fs.readFileSync('/workspace/sync.txt', 'utf8')).toBe('sync');
  });

  it('exposes promise APIs when a package imports node:fs/promises', async () => {
    const memfs = makeMemfs();
    const fsPromises = loadFsPolyfill('fs-promises-polyfill.js', memfs) as {
      lstat: (path: string) => Promise<{ isDirectory: () => boolean }>;
      writeFile: (path: string, data: string, options: { flag?: undefined; mode?: undefined }) => Promise<void>;
    };

    await fsPromises.writeFile('/workspace/promise.txt', 'promise', { flag: undefined, mode: undefined });

    expect((await fsPromises.lstat('/workspace/promise.txt')).isDirectory()).toBe(false);
    expect(memfs.readFileSync('/workspace/promise.txt', 'utf8')).toBe('promise');
  });
});
