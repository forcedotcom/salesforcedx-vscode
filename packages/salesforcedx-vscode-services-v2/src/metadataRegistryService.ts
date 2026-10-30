/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { GetRegistryAccessError, NoWorkspaceOpenError } from './errors.js';
import type { RegistryAccess } from '@salesforce/source-deploy-retrieve';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';

export class MetadataRegistryService extends Context.Service<
  MetadataRegistryService,
  {
    readonly getRegistryAccess: () => Effect.Effect<RegistryAccess, GetRegistryAccessError | NoWorkspaceOpenError>;
    readonly getRegistry: () => Effect.Effect<
      ReturnType<RegistryAccess['getRegistry']>,
      GetRegistryAccessError | NoWorkspaceOpenError
    >;
  }
>()('@salesforce/vscode-services-v2/MetadataRegistryService') {}
