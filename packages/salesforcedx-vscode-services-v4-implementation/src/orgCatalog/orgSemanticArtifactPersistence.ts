/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  SObjectSemanticModelSchema,
  TransmogrifierService,
  type OrgId,
  type RestSObjectDescribeTransmogrifierInput
} from '@salesforce/vscode-services-v2';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import { ServiceOperations, ServiceOperationsLayer } from '../serviceOperations.js';
import { OrgSemanticArtifactStore, type SemanticArtifactStoreKey } from './orgSemanticArtifactStore.js';

type SemanticArtifactPersistenceInput = RestSObjectDescribeTransmogrifierInput & {
  readonly orgId: OrgId;
  readonly capabilityVersion: string;
  readonly revision: string | null;
};
class SemanticArtifactPersistenceError extends Schema.TaggedError<SemanticArtifactPersistenceError>()(
  'SemanticArtifactPersistenceError',
  { message: Schema.String, cause: Schema.Unknown }
) {}
const makeOrgSemanticArtifactPersistence = Effect.gen(function* () {
  const store = yield* OrgSemanticArtifactStore;
  const transmogrifier = yield* TransmogrifierService;
  const operations = yield* ServiceOperations;
  const persist = Effect.fn('OrgSemanticArtifactPersistence.persist')(function* (
    input: SemanticArtifactPersistenceInput
  ) {
    const model = yield* transmogrifier.toSemanticModel(input);
    const key: SemanticArtifactStoreKey = {
      orgId: input.orgId,
      identity: model.value.identity,
      projection: { kind: 'semantic-model', model: 'sobject' },
      provider: 'rest-api',
      capabilityVersion: input.capabilityVersion,
      revision: input.revision
    };
    const encoded = yield* Schema.encodeEffect(SObjectSemanticModelSchema)(model).pipe(
      Effect.catchTag('SchemaError', cause =>
        Effect.fail(
          new SemanticArtifactPersistenceError({
            message: 'Failed to encode the canonical semantic model for persistence',
            cause
          })
        )
      )
    );
    const stored = yield* store.save(key, encoded);
    return { key, writtenAt: stored.writtenAt, uri: stored.uri, model };
  }, operations.run);
  const hydrate = Effect.fn('OrgSemanticArtifactPersistence.hydrate')(function* (key: SemanticArtifactStoreKey) {
    const stored = yield* store.load(key);
    if (!stored) return undefined;
    return yield* transmogrifier.toSemanticModel({
      source: 'persisted-semantic-model',
      identity: key.identity,
      value: stored.value
    });
  }, operations.run);
  yield* Effect.addFinalizer(() => operations.close);
  return { persist, hydrate };
});
export class OrgSemanticArtifactPersistence extends Context.Service<
  OrgSemanticArtifactPersistence,
  Effect.Success<typeof makeOrgSemanticArtifactPersistence>
>()('@salesforce/vscode-services-v4-implementation/OrgSemanticArtifactPersistence') {}
export const OrgSemanticArtifactPersistenceLayer = Layer.effect(
  OrgSemanticArtifactPersistence,
  makeOrgSemanticArtifactPersistence
).pipe(Layer.provideMerge(ServiceOperationsLayer));
