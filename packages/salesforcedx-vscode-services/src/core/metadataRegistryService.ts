/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RegistryAccess } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { WorkspaceService } from '../vscode/workspaceService';
import { unknownToErrorCause } from './shared';

export class GetRegistryAccessError extends Schema.TaggedError<GetRegistryAccessError>()(
  'GetRegistryAccessError',
  {
    cause: Schema.Unknown
  }
) {}

export class MetadataRegistryService extends Effect.Service<MetadataRegistryService>()('MetadataRegistryService', {
  accessors: true,
  dependencies: [WorkspaceService.Default],
  effect: Effect.gen(function* () {
    /** Create a new RegistryAccess instance */
    const createRegistryAccess = () =>
      Effect.gen(function* () {
        const workspaceService = yield* WorkspaceService;
        const workspaceInfo = yield* workspaceService.getWorkspaceInfoOrThrow;
        return yield* Effect.try({
          try: () => new RegistryAccess(undefined, workspaceInfo.fsPath),
          catch: error => new GetRegistryAccessError({ cause: unknownToErrorCause(error).cause })
        });
      }).pipe(Effect.withSpan('getRegistryAccess'));

    // Create shared registry access once and cache it
    const cachedGetRegistryAccessEffect = yield* Effect.cached(createRegistryAccess());

    // Derive registry from the cached registry access
    const cachedGetRegistryEffect = yield* Effect.cached(
      Effect.flatMap(cachedGetRegistryAccessEffect, registryAccess =>
        Effect.try({
          try: () => registryAccess.getRegistry(),
          catch: error => new GetRegistryAccessError({ cause: unknownToErrorCause(error).cause })
        })
      ).pipe(Effect.withSpan('getRegistry (cached)'))
    );

    /** Get the metadata registry (cached) */
    const getRegistry = Effect.fn('MetadataRegistryService.getRegistry')(function* () {
      return yield* cachedGetRegistryEffect;
    });

    /** Get the registry access (cached) */
    const getRegistryAccess = Effect.fn('MetadataRegistryService.getRegistryAccess')(function* () {
      return yield* cachedGetRegistryAccessEffect;
    });

    return { getRegistry, getRegistryAccess } as const;
  })
}) {}
