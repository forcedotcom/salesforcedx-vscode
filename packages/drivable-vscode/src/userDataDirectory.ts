/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

const prefix = 'dvt-';

/** Keep VS Code's main IPC socket below macOS's 103-byte pathname limit. */
export const userDataTempOptions = (temporaryDirectory: string, platform: NodeJS.Platform) => ({
  prefix,
  // mkdtemp adds six characters; VS Code 1.141 puts this socket inside --user-data-dir.
  ...(platform === 'darwin' && Buffer.byteLength(`${temporaryDirectory}/${prefix}xxxxxx/1.14-main.sock`, 'utf8') > 103
    ? { directory: '/tmp' }
    : {})
});
