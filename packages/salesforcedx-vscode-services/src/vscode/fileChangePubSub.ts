/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as PubSub from 'effect/PubSub';
import type { URI } from 'vscode-uri';

export type FileChangeEvent = {
  readonly type: 'create' | 'change' | 'delete';
  readonly uri: URI;
};

/** PubSub that broadcasts all workspace file-system change events.
 * The VS Code wiring (FileWatcherLayer) writes to this; consumers subscribe read-only. */
export class FileChangePubSub extends Effect.Service<FileChangePubSub>()('FileChangePubSub', {
  scoped: PubSub.sliding<FileChangeEvent>(10_000)
}) {}
