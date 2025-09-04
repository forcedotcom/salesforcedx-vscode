/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type MetadataRegistry, RegistryAccess } from '@salesforce/source-deploy-retrieve';

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { WorkspaceService } from '../vscode/workspaceService';

export type MetadataRegistryService = {
  /** Get the metadata registry (cached) */
  readonly getRegistry: () => Effect.Effect<Readonly<MetadataRegistry>, Error, WorkspaceService>;
  /** Get the registry access (cached) */
  readonly getRegistryAccess: () => Effect.Effect<RegistryAccess, Error, WorkspaceService>;
};

export const MetadataRegistryService = Context.GenericTag<MetadataRegistryService>('MetadataRegistryService');

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

export const MetadataRegistryServiceLive = Layer.scoped(
  MetadataRegistryService,
  Effect.gen(function* () {
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
      getRegistry: (): Effect.Effect<Readonly<MetadataRegistry>, Error, WorkspaceService> => cachedGetRegistryEffect,
      getRegistryAccess: (): Effect.Effect<RegistryAccess, Error, WorkspaceService> => cachedGetRegistryAccessEffect
    };
  })
);
