/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import coreFs from '@salesforce/core/fs';
import * as Context from 'effect/Context';
// eslint-disable-next-line no-restricted-imports -- Type-only shared Node/memfs watch signature; no Node filesystem runtime is imported.
import type * as NodeFs from 'node:fs';

/** Read the SDK's current backend at watch acquisition, including a web bootstrap replacement. */
type WatchFile = (filePath: NodeFs.PathLike, listener: NodeFs.WatchListener<string>) => NodeFs.FSWatcher;
export const HostFileSystem = Context.Reference<{ readonly get: () => { readonly watch: WatchFile } }>(
  '@salesforce/vscode-services-v4-implementation/HostFileSystem',
  // SDK VirtualFs erases incompatible Node/memfs overloads to any. This supported watch
  // signature is checked against both real backends by the host watcher integration tests.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Restore only the SDK-erased watch signature at this external API boundary.
  { defaultValue: () => ({ get: () => ({ watch: coreFs.fs.watch as WatchFile }) }) }
);
