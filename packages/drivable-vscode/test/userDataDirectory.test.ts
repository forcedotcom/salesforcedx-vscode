/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { userDataTempOptions } from '../src/userDataDirectory';

const socketPath = (base: string) => `${base}/dvt-xxxxxx/1.14-main.sock`;

describe('VS Code user data temp directory', () => {
  test('keeps the default macOS temp directory when the shortened prefix fits', () => {
    const base = '/var/folders/r4/pj95jr_j41707b_yfx_pfwf80000gn/T';

    expect(userDataTempOptions(base, 'darwin')).toEqual({ prefix: 'dvt-' });
    expect(Buffer.byteLength(socketPath(base))).toBeLessThanOrEqual(103);
  });

  test('uses a short base when the macOS socket path would exceed 103 bytes', () => {
    const baseAtLimit = `/${'a'.repeat(103 - Buffer.byteLength(socketPath('')) - 1)}`;

    expect(Buffer.byteLength(socketPath(baseAtLimit))).toBe(103);
    expect(userDataTempOptions(baseAtLimit, 'darwin')).toEqual({ prefix: 'dvt-' });
    expect(userDataTempOptions(`${baseAtLimit}a`, 'darwin')).toEqual({ prefix: 'dvt-', directory: '/tmp' });
    expect(Buffer.byteLength(socketPath('/tmp'))).toBeLessThanOrEqual(103);
  });

  test('counts UTF-8 bytes and leaves non-macOS temp directory selection unchanged', () => {
    const base = `/${'é'.repeat(40)}`;

    expect(userDataTempOptions(base, 'darwin')).toEqual({ prefix: 'dvt-', directory: '/tmp' });
    expect(userDataTempOptions(base, 'linux')).toEqual({ prefix: 'dvt-' });
  });
});
