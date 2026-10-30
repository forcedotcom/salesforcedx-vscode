/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { FsServiceError } from './errors.js';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';
import type * as Option from 'effect/Option';

export class AliasService extends Context.Service<
  AliasService,
  {
    readonly getAliasesFromUsername: (username: string) => Effect.Effect<string[]>;
    readonly getAllAliases: () => Effect.Effect<Readonly<Record<string, string>>, FsServiceError>;
    readonly getUsernameFromAlias: (alias: string) => Effect.Effect<Option.Option<string>>;
    readonly unsetAliases: (aliases: readonly string[]) => Effect.Effect<void>;
  }
>()('@salesforce/vscode-services-v2/AliasService') {}
