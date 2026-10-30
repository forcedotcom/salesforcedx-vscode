/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { GetRegistryAccessError, MetadataDeleteError, NoWorkspaceOpenError } from './errors.js';
import type { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';

export class MetadataDeleteService extends Context.Service<
  MetadataDeleteService,
  {
    readonly markComponentsForDeletion: (
      components: ComponentSet
    ) => Effect.Effect<ComponentSet, GetRegistryAccessError | NoWorkspaceOpenError>;
    readonly deleteLocalFiles: (components: ComponentSet) => Effect.Effect<void, MetadataDeleteError>;
  }
>()('@salesforce/vscode-services-v2/MetadataDeleteService') {}
