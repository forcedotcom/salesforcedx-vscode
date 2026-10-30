/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { RegistryAccess } from '@salesforce/source-deploy-retrieve';
import { GetRegistryAccessError, MetadataRegistryService, WorkspaceService } from '@salesforce/vscode-services-v2';
import * as Cache from 'effect/Cache';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { unknownToErrorCause } from './errorCause.js';
import { ServiceOperations, ServiceOperationsLayer } from './serviceOperations.js';

const registryError = (error: unknown) => {
  const { cause } = unknownToErrorCause(error);
  return new GetRegistryAccessError({ cause, message: `Failed to access metadata registry: ${cause.message}` });
};
export const MetadataRegistryServiceLayer = Layer.effect(
  MetadataRegistryService,
  Effect.gen(function* () {
    const workspace = yield* WorkspaceService;
    const operations = yield* ServiceOperations;
    const cache = yield* Cache.make({
      capacity: 10,
      timeToLive: Duration.minutes(10),
      lookup: (fsPath: string) =>
        Effect.try({ try: () => new RegistryAccess(undefined, fsPath), catch: registryError }).pipe(
          Effect.withSpan('createRegistryAccess', { attributes: { fsPath } })
        )
    }).pipe(Effect.withSpan('registryAccessCache'));
    yield* Effect.addFinalizer(() => Cache.invalidateAll(cache));
    const getRegistryAccess = Effect.fn('MetadataRegistryService.getRegistryAccess')(function* () {
      return yield* workspace.getWorkspaceInfoOrThrow().pipe(Effect.flatMap(info => Cache.get(cache, info.fsPath)));
    }, operations.run);
    const getRegistry = Effect.fn('MetadataRegistryService.getRegistry')(function* () {
      const registry = yield* getRegistryAccess();
      return yield* Effect.try({ try: () => registry.getRegistry(), catch: registryError });
    }, operations.run);
    yield* Effect.addFinalizer(() => operations.close);
    return MetadataRegistryService.of({ getRegistryAccess, getRegistry });
  })
).pipe(Layer.provideMerge(ServiceOperationsLayer));
