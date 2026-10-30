/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { HostFileNotFoundError, HostFileWatchError } from './errors.js';
import type { FileChangeEvent } from './fileChangePubSub.js';
import * as Context from 'effect/Context';
import type * as Stream from 'effect/Stream';

export class HostFileWatcher extends Context.Service<
  HostFileWatcher,
  {
    readonly watch: (filePath: string) => Stream.Stream<FileChangeEvent, HostFileNotFoundError | HostFileWatchError>;
  }
>()('@salesforce/vscode-services-v2/HostFileWatcher') {}
