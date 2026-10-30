/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Context from 'effect/Context';
import type * as PubSub from 'effect/PubSub';
import type { URI } from 'vscode-uri';

export type FileChangeEvent = { readonly type: 'create' | 'change' | 'delete'; readonly uri: URI };
export class FileChangePubSub extends Context.Service<FileChangePubSub, PubSub.PubSub<FileChangeEvent>>()(
  '@salesforce/vscode-services-v2/FileChangePubSub'
) {}
