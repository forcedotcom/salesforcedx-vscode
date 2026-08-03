/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { TypeInventory } from '../../../src/orgCatalog/orgCatalogInternalTypes';
import * as Effect from 'effect/Effect';
import { URI } from 'vscode-uri';
import { makeOrgCatalogState } from '../../../src/orgCatalog/orgCatalogState';
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
  return { load, save, saved, store };
};

describe('OrgCatalogState', () => {
  it('persists remote inventory without retaining workspace-only presence', async () => {
    const { saved, store } = makeStore();
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
        const state = yield* makeOrgCatalogState(store);
        yield* state.ensureHydrated('org-one');
        yield* state.setInventory('org-one', 'ApexClass', inventory);
        yield* state.persistOrg('org-one');
      })
    );

    expect(saved).toHaveLength(1);
    expect(saved[0]?.inventory[0]?.components).toEqual([expect.objectContaining({ fullName: 'RemoteAndLocal' })]);
  });

  it('hydrates once and advances the persisted generation', async () => {
    const snapshot: OrgMetadataCatalogSnapshot = {
      version: 1,
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
      tracking: [{ xmlName: 'ApexClass', fullName: 'RemoteTest', signature: 'Changed|7' }]
    };
    const { load, saved, store } = makeStore(snapshot);

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const state = yield* makeOrgCatalogState(store);
        yield* state.ensureHydrated('org-one');
        yield* state.ensureHydrated('org-one');
        const inventory = yield* state.getPersistedInventory('org-one', 'ApexClass');
        const tracking = yield* state.getTracking('org-one');
        yield* state.persistOrg('org-one');
        return { inventory, tracking };
      })
    );

    expect(load).toHaveBeenCalledTimes(1);
    expect(result.inventory?.components).toEqual([expect.objectContaining({ fullName: 'RemoteTest' })]);
    expect(result.tracking.get('ApexClass\0RemoteTest')?.signature).toBe('Changed|7');
    expect(saved[0]?.generation).toBe(8);
  });
});
