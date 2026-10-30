/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { FsProvider } from '@salesforce/vscode-services-v2';
import * as Context from 'effect/Context';

/** Host-owned provider getter; web bootstrap supplies its existing provider, never a second filesystem. */
export class WebFileSystemProvider extends Context.Service<
  WebFileSystemProvider,
  {
    readonly get: () => FsProvider | undefined;
  }
>()('@salesforce/vscode-services-v4-implementation/WebFileSystemProvider') {}
