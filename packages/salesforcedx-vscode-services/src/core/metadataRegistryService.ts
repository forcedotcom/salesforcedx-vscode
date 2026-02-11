/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RegistryAccess } from '@salesforce/source-deploy-retrieve';
import * as Cache from 'effect/Cache';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { WorkspaceService } from '../vscode/workspaceService';
import { unknownToErrorCause } from './shared';

export class GetRegistryAccessError extends Schema.TaggedError<GetRegistryAccessError>()('GetRegistryAccessError', {
  cause: Schema.Unknown
}) {}

const createRegistryAccess = (fsPath: string) =>
  Effect.try({
    try: () => new RegistryAccess(undefined, fsPath),
    catch: error => new GetRegistryAccessError({ cause: unknownToErrorCause(error).cause })
  }).pipe(Effect.withSpan('createRegistryAccess', { attributes: { fsPath } }));

// Global cache - created once at module level
const globalRegistryAccessCache = Effect.runSync(
  Cache.make({
    capacity: 10,
    timeToLive: Duration.minutes(10),
    lookup: createRegistryAccess
  }).pipe(Effect.withSpan('registryAccessCache'))
);

export class MetadataRegistryService extends Effect.Service<MetadataRegistryService>()('MetadataRegistryService', {
  accessors: true,
  dependencies: [WorkspaceService.Default],
  effect: Effect.gen(function* () {
    const workspaceService = yield* WorkspaceService;

    /** Get the registry access (cached by fsPath) */
    const getRegistryAccess = Effect.fn('MetadataRegistryService.getRegistryAccess')(function* () {
      const workspaceInfo = yield* workspaceService.getWorkspaceInfoOrThrow();
      return yield* globalRegistryAccessCache.get(workspaceInfo.fsPath);
    });

    /** Get the metadata registry (cached by fsPath) */
    const getRegistry = Effect.fn('MetadataRegistryService.getRegistry')(function* () {
      const registryAccess = yield* getRegistryAccess();
      return yield* Effect.try({
        try: () => registryAccess.getRegistry(),
        catch: error => new GetRegistryAccessError({ cause: unknownToErrorCause(error).cause })
      });
    });

    return { getRegistry, getRegistryAccess };
  })
}) {}
