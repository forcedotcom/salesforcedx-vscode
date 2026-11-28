/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Context from 'effect/Context';

export class PromptMessages extends Context.Service<
  PromptMessages,
  {
    readonly overwriteConfirmation: (path: string) => string;
    readonly overwriteButton: string;
    readonly chooseDifferentFolder: string;
    readonly selectFolder: string;
  }
>()('@salesforce/vscode-services/internal/PromptMessages') {}
