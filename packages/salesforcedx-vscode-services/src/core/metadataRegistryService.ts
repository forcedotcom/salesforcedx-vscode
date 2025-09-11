/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type MetadataRegistry, RegistryAccess } from '@salesforce/source-deploy-retrieve';

import * as Effect from 'effect/Effect';
import { WorkspaceService } from '../vscode/workspaceService';

/** Create a new RegistryAccess instance */
const getRegistryAccess = (): Effect.Effect<RegistryAccess, Error, WorkspaceService> =>
  Effect.flatMap(WorkspaceService, service => service.getWorkspaceInfo).pipe(
    Effect.flatMap(workspaceInfo =>
      Effect.try({
        try: () => new RegistryAccess(undefined, workspaceInfo.fsPath),
        catch: (error: unknown) => new Error(`Failed to create RegistryAccess: ${String(error)}`)
      })
    ),
    Effect.withSpan('getRegistryAccess')
  );

export class MetadataRegistryService extends Effect.Service<MetadataRegistryService>()('MetadataRegistryService', {
  scoped: Effect.gen(function* () {
    // Create shared registry access once and cache it
    const cachedGetRegistryAccessEffect = yield* Effect.cached(getRegistryAccess());

    // Derive registry from the cached registry access
    const cachedGetRegistryEffect = yield* Effect.cached(
      Effect.flatMap(cachedGetRegistryAccessEffect, registryAccess =>
        Effect.try({
          try: () => registryAccess.getRegistry(),
          catch: (error: unknown) => new Error(`Failed to get registry: ${String(error)}`)
        })
      ).pipe(Effect.withSpan('getRegistry (cached)'))
    );

    return {
      /** Get the metadata registry (cached) */
      getRegistry: (): Effect.Effect<Readonly<MetadataRegistry>, Error, WorkspaceService> => cachedGetRegistryEffect,
      /** Get the registry access (cached) */
      getRegistryAccess: (): Effect.Effect<RegistryAccess, Error, WorkspaceService> => cachedGetRegistryAccessEffect
    } as const;
  })
}) {}
