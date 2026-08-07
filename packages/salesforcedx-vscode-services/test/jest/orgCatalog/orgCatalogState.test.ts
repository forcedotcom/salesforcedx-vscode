/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { MetadataTypeObservation, TypeInventory } from '../../../src/orgCatalog/orgCatalogInternalTypes';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { URI } from 'vscode-uri';
import { OrgCatalogState } from '../../../src/orgCatalog/orgCatalogState';
import {
  OrgMetadataCatalogStore,
  type OrgMetadataCatalogSnapshot
} from '../../../src/orgCatalog/orgMetadataCatalogStore';

const makeStore = (snapshot?: OrgMetadataCatalogSnapshot) => {
  const saved: OrgMetadataCatalogSnapshot[] = [];
  const load = jest.fn(() => Effect.succeed(snapshot));
  const save = jest.fn((next: OrgMetadataCatalogSnapshot) =>
    Effect.sync(() => {
      saved.push(next);
      return URI.file(`/workspace/${next.orgId}/catalog.json`);
    })
  );
  const store = new OrgMetadataCatalogStore({ load, save } as unknown as InstanceType<typeof OrgMetadataCatalogStore>);
  const stateLayer = OrgCatalogState.DefaultWithoutDependencies.pipe(
    Layer.provide(Layer.succeed(OrgMetadataCatalogStore, store))
  );
  return { load, save, saved, stateLayer };
};

const metadataTypeObservation = (xmlName: string): MetadataTypeObservation => ({
  xmlName,
  directoryName: xmlName === 'ApexClass' ? 'classes' : 'objects',
  inFolder: false,
  metaFile: true,
  childXmlNames: [],
  observedAt: '2026-08-07T12:00:00.000Z',
  ...(xmlName === 'ApexClass' ? { suffix: 'cls' } : {})
});

describe('OrgCatalogState', () => {
  it('persists remote inventory without retaining workspace-only presence', async () => {
    const { saved, stateLayer } = makeStore();
    const inventory: TypeInventory = {
      observedAt: '2026-08-03T12:00:00.000Z',
      folders: new Map(),
      components: new Map([
        [
          'RemoteAndLocal',
          {
            orgId: 'org-one',
            observedAt: '2026-08-03T12:00:00.000Z',
            provenance: 'metadata-api+workspace',
            reference: { xmlName: 'ApexClass', fullName: 'RemoteAndLocal' },
            documentUri: URI.parse('sf-org-metadata:/orgs/org-one/ApexClass/RemoteAndLocal.cls'),
            workspaceUri: URI.file('/workspace/RemoteAndLocal.cls'),
            name: 'RemoteAndLocal',
            kind: 'component',
            inOrg: true,
            inWorkspace: true
          }
        ],
        [
          'LocalOnly',
          {
            orgId: 'org-one',
            observedAt: '2026-08-03T12:00:00.000Z',
            provenance: 'workspace',
            reference: { xmlName: 'ApexClass', fullName: 'LocalOnly' },
            documentUri: URI.file('/workspace/LocalOnly.cls'),
            workspaceUri: URI.file('/workspace/LocalOnly.cls'),
            name: 'LocalOnly',
            kind: 'component',
            inOrg: false,
            inWorkspace: true
          }
        ]
      ])
    };

    await Effect.runPromise(
      Effect.gen(function* () {
        const state = yield* OrgCatalogState;
        yield* state.ensureHydrated('org-one');
        yield* state.setInventory('org-one', 'ApexClass', inventory);
        yield* state.persistOrg('org-one');
      }).pipe(Effect.provide(stateLayer))
    );

    expect(saved).toHaveLength(1);
    expect(saved[0]?.inventory[0]?.components).toEqual([expect.objectContaining({ fullName: 'RemoteAndLocal' })]);
  });

  it('hydrates once and advances the persisted generation', async () => {
    const snapshot: OrgMetadataCatalogSnapshot = {
      version: 2,
      orgId: 'org-one',
      writtenAt: '2026-08-03T12:00:00.000Z',
      generation: 7,
      inventory: [
        {
          xmlName: 'ApexClass',
          observedAt: '2026-08-03T11:00:00.000Z',
          components: [{ fullName: 'RemoteTest' }],
          folders: []
        }
      ],
      sobjects: { descriptions: [] },
      tracking: [{ xmlName: 'ApexClass', fullName: 'RemoteTest', signature: 'Changed|7' }],
      metadataTypes: [],
      metadataListings: []
    };
    const { load, saved, stateLayer } = makeStore(snapshot);

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const state = yield* OrgCatalogState;
        yield* state.ensureHydrated('org-one');
        yield* state.ensureHydrated('org-one');
        const inventory = yield* state.getPersistedInventory('org-one', 'ApexClass');
        const tracking = yield* state.getTracking('org-one');
        yield* state.persistOrg('org-one');
        return { inventory, tracking };
      }).pipe(Effect.provide(stateLayer))
    );

    expect(load).toHaveBeenCalledTimes(1);
    expect(result.inventory?.components).toEqual([expect.objectContaining({ fullName: 'RemoteTest' })]);
    expect(result.tracking.get('ApexClass\0RemoteTest')?.signature).toBe('Changed|7');
    expect(saved[0]?.generation).toBe(8);
  });

  it('flushes dirty state when its scope closes before the debounce elapses', async () => {
    const { saved, stateLayer } = makeStore();

    await Effect.runPromise(
      Effect.gen(function* () {
        const state = yield* OrgCatalogState;
        yield* state.ensureHydrated('org-one');
        yield* state.setMetadataTypes('org-one', [metadataTypeObservation('ApexClass')]);
        yield* state.queuePersist('org-one');
      }).pipe(Effect.provide(stateLayer))
    );

    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      version: 2,
      orgId: 'org-one',
      generation: 1,
      metadataTypes: [expect.objectContaining({ xmlName: 'ApexClass' })]
    });
  });

  it('flushes every dirty org exactly once when its scope closes', async () => {
    const { saved, stateLayer } = makeStore();

    await Effect.runPromise(
      Effect.gen(function* () {
        const state = yield* OrgCatalogState;
        yield* state.ensureHydrated('org-one');
        yield* state.ensureHydrated('org-two');
        yield* state.setMetadataTypes('org-one', [metadataTypeObservation('ApexClass')]);
        yield* state.setMetadataTypes('org-two', [metadataTypeObservation('CustomObject')]);
        yield* state.queuePersist('org-one');
        yield* state.queuePersist('org-two');
      }).pipe(Effect.provide(stateLayer))
    );

    expect(saved).toHaveLength(2);
    expect(saved).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ orgId: 'org-one', generation: 1 }),
        expect.objectContaining({ orgId: 'org-two', generation: 1 })
      ])
    );
  });

  it('does not persist a clean hydrated org when its scope closes', async () => {
    const { saved, stateLayer } = makeStore();

    await Effect.runPromise(
      Effect.gen(function* () {
        const state = yield* OrgCatalogState;
        yield* state.ensureHydrated('org-one');
      }).pipe(Effect.provide(stateLayer))
    );

    expect(saved).toHaveLength(0);
  });

  it('does not persist a clean org when it is explicitly flushed', async () => {
    const { saved, stateLayer } = makeStore();

    const persisted = await Effect.runPromise(
      Effect.gen(function* () {
        const state = yield* OrgCatalogState;
        yield* state.ensureHydrated('org-one');
        return yield* state.flushOrg('org-one');
      }).pipe(Effect.provide(stateLayer))
    );

    expect(persisted).toBe(false);
    expect(saved).toHaveLength(0);
  });

  it('persists a dirty org exactly once when it is explicitly flushed', async () => {
    const { saved, stateLayer } = makeStore();

    const results = await Effect.runPromise(
      Effect.gen(function* () {
        const state = yield* OrgCatalogState;
        yield* state.ensureHydrated('org-one');
        yield* state.setMetadataTypes('org-one', [metadataTypeObservation('ApexClass')]);
        yield* state.queuePersist('org-one');
        const first = yield* state.flushOrg('org-one');
        const second = yield* state.flushOrg('org-one');
        return [first, second] as const;
      }).pipe(Effect.provide(stateLayer))
    );

    expect(results).toEqual([true, false]);
    expect(saved).toEqual([expect.objectContaining({ orgId: 'org-one', generation: 1 })]);
  });
});
