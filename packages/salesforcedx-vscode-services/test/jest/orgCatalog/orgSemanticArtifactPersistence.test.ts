/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import { URI } from 'vscode-uri';
import { type DescribeSObjectResult, TransmogrifierService } from '../../../src/core/transmogrifierService';
import {
  OrgSemanticArtifactPersistence,
  type SemanticArtifactPersistenceInput
} from '../../../src/orgCatalog/orgSemanticArtifactPersistence';
import {
  OrgSemanticArtifactStore,
  type SemanticArtifactStoreKey
} from '../../../src/orgCatalog/orgSemanticArtifactStore';

type StoredRecord = {
  readonly key: SemanticArtifactStoreKey;
  readonly writtenAt: string;
  readonly value: unknown;
  readonly uri: URI;
};

const makeHarness = () => {
  let record: StoredRecord | undefined;
  const store = new OrgSemanticArtifactStore({
    save: (key: SemanticArtifactStoreKey, value: unknown) =>
      Effect.sync(() => {
        record = {
          key,
          writtenAt: '2026-08-25T12:00:00.000Z',
          value,
          uri: URI.file('/workspace/.sf/orgs/00D/semantic-artifacts/artifact.json')
        };
        return record;
      }),
    load: () => Effect.sync(() => record)
  } as unknown as OrgSemanticArtifactStore);
  const run = <A, E>(effect: Effect.Effect<A, E, OrgSemanticArtifactPersistence>) =>
    Effect.runPromise(
      effect.pipe(
        Effect.provide(OrgSemanticArtifactPersistence.DefaultWithoutDependencies),
        Effect.provide(TransmogrifierService.Default),
        Effect.provideService(OrgSemanticArtifactStore, store)
      )
    );
  return {
    getRecord: () => record,
    run,
    setRecord: (value: StoredRecord) => {
      record = value;
    }
  };
};

const describeResult = {
  name: 'Invoice__c',
  label: 'Invoice',
  custom: true,
  queryable: true,
  fields: [],
  childRelationships: []
} as unknown as DescribeSObjectResult;

const restInput: SemanticArtifactPersistenceInput = {
  source: 'rest-sobject-describe',
  orgId: '00D',
  identity: { kind: 'sobject', namespace: null, name: 'Invoice__c' },
  value: describeResult,
  capabilityVersion: '66.0',
  revision: '2026-08-25T11:00:00.000Z'
};

describe('OrgSemanticArtifactPersistence', () => {
  it('transforms, persists, and rehydrates REST SObject semantics through one typed boundary', async () => {
    const { getRecord, run } = makeHarness();
    const [persisted, hydrated] = await run(
      Effect.gen(function* () {
        const persistence = yield* OrgSemanticArtifactPersistence;
        const saved = yield* persistence.persist(restInput);
        return [saved, yield* persistence.hydrate(saved.key)] as const;
      })
    );

    expect(persisted.key).toEqual({
      orgId: '00D',
      identity: { kind: 'sobject', namespace: null, name: 'Invoice__c' },
      projection: { kind: 'semantic-model', model: 'sobject' },
      provider: 'rest-api',
      capabilityVersion: '66.0',
      revision: '2026-08-25T11:00:00.000Z'
    });
    expect(hydrated).toEqual(persisted.model);
    expect(getRecord()?.value).not.toHaveProperty('workspaceUri');
    expect(getRecord()?.value).not.toHaveProperty('presence');
  });

  it('rejects corrupt persisted semantic values during hydration', async () => {
    const { run, setRecord } = makeHarness();
    const key: SemanticArtifactStoreKey = {
      orgId: '00D',
      identity: { kind: 'sobject', namespace: null, name: 'Invoice__c' },
      projection: { kind: 'semantic-model', model: 'sobject' },
      provider: 'rest-api',
      capabilityVersion: '66.0',
      revision: null
    };
    setRecord({ key, writtenAt: '2026-08-25T12:00:00.000Z', value: { kind: 'sobject' }, uri: URI.file('/corrupt') });

    await expect(
      run(
        Effect.gen(function* () {
          return yield* (yield* OrgSemanticArtifactPersistence).hydrate(key);
        })
      )
    ).rejects.toThrow('Failed to validate the persisted canonical semantic model');
  });

  it('rejects a persisted value whose namespace-aware identity does not match its key', async () => {
    const { run, setRecord } = makeHarness();
    const key: SemanticArtifactStoreKey = {
      orgId: '00D',
      identity: { kind: 'sobject', namespace: 'OtherPackage', name: 'Invoice__c' },
      projection: { kind: 'semantic-model', model: 'sobject' },
      provider: 'rest-api',
      capabilityVersion: '66.0',
      revision: null
    };
    setRecord({
      key,
      writtenAt: '2026-08-25T12:00:00.000Z',
      value: {
        kind: 'sobject',
        value: {
          identity: { kind: 'sobject', namespace: null, name: 'Invoice__c' },
          fields: [],
        }
      },
      uri: URI.file('/mismatched')
    });

    await expect(
      run(
        Effect.gen(function* () {
          return yield* (yield* OrgSemanticArtifactPersistence).hydrate(key);
        })
      )
    ).rejects.toThrow('Persisted semantic model identity does not match the requested artifact identity');
  });
});
