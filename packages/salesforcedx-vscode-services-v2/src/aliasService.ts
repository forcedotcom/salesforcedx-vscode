/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';

export class AliasService extends Context.Service<
  AliasService,
  {
    readonly getAliasesFromUsername: (username: string) => Effect.Effect<string[]>;
  }
>()('@salesforce/vscode-services-v2/AliasService') {}
