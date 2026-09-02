/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import type { URI } from 'vscode-uri';
import { SObjectSemanticModelSchema, type SObjectSemanticModel } from '../core/artifactProjection';
import { TransmogrifierService, type RestSObjectDescribeTransmogrifierInput } from '../core/transmogrifierService';
import { OrgSemanticArtifactStore, type SemanticArtifactStoreKey } from './orgSemanticArtifactStore';

type SemanticArtifactPersistenceFields = {
  readonly orgId: string;
  readonly capabilityVersion: string;
  readonly revision: string | null;
};

export type SemanticArtifactPersistenceInput = SemanticArtifactPersistenceFields & RestSObjectDescribeTransmogrifierInput;
export type SObjectSemanticArtifactStoreKey = Extract<
  SemanticArtifactStoreKey,
  { readonly identity: { readonly kind: 'sobject' } }
>;

class SemanticArtifactPersistenceError extends Schema.TaggedError<SemanticArtifactPersistenceError>()(
  'SemanticArtifactPersistenceError',
  { message: Schema.String, cause: Schema.optional(Schema.Unknown) }
) {}

const semanticArtifactKey = (
  input: SemanticArtifactPersistenceInput,
  model: SObjectSemanticModel
): SObjectSemanticArtifactStoreKey => ({
  orgId: input.orgId,
  identity: model.value.identity,
  projection: { kind: 'semantic-model', model: 'sobject' },
  provider: 'rest-api',
  capabilityVersion: input.capabilityVersion,
  revision: input.revision
});

/** Typed canonical persistence boundary for remote semantic projections. Actual source remains in metadata-shadow. */
export class OrgSemanticArtifactPersistence extends Effect.Service<OrgSemanticArtifactPersistence>()(
  'OrgSemanticArtifactPersistence',
  {
    accessors: true,
    dependencies: [OrgSemanticArtifactStore.Default, TransmogrifierService.Default],
    effect: Effect.gen(function* () {
      const [store, transmogrifier] = yield* Effect.all([OrgSemanticArtifactStore, TransmogrifierService]);

      const persist: (input: SemanticArtifactPersistenceInput) => Effect.Effect<
        {
          readonly key: SObjectSemanticArtifactStoreKey;
          readonly writtenAt: string;
          readonly uri: URI;
          readonly model: SObjectSemanticModel;
        },
        unknown
      > = Effect.fn('OrgSemanticArtifactPersistence.persist')(function* (input: SemanticArtifactPersistenceInput) {
        const model = yield* transmogrifier.toSemanticModel(input);
        const key = semanticArtifactKey(input, model);
        const encoded = yield* Schema.encode(SObjectSemanticModelSchema)(model).pipe(
          Effect.mapError(
            cause =>
              new SemanticArtifactPersistenceError({
                message: 'Failed to encode the canonical semantic model for persistence',
                cause
              })
          )
        );
        const stored = yield* store.save(key, encoded);
        return { key, writtenAt: stored.writtenAt, uri: stored.uri, model };
      });

      const hydrate: (
        key: SObjectSemanticArtifactStoreKey
      ) => Effect.Effect<SObjectSemanticModel | undefined, unknown> = Effect.fn(
        'OrgSemanticArtifactPersistence.hydrate'
      )(function* (key: SObjectSemanticArtifactStoreKey) {
          const stored = yield* store.load(key);
          if (!stored) return undefined;
          return yield* transmogrifier.toSemanticModel({
            source: 'persisted-semantic-model',
            identity: key.identity,
            value: stored.value
          });
        });

      return { hydrate, persist };
    })
  }
) {}
