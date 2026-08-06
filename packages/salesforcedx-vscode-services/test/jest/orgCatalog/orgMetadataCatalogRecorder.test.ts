/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as PubSub from 'effect/PubSub';
import * as Queue from 'effect/Queue';
import { URI } from 'vscode-uri';
import { TransmogrifierService } from '../../../src/core/transmogrifierService';
import { OrgCatalogState } from '../../../src/orgCatalog/orgCatalogState';
import { OrgMetadataCatalogRecorder } from '../../../src/orgCatalog/orgMetadataCatalogRecorder';
import {
  OrgMetadataCatalogChangePubSub,
  type OrgMetadataCatalogChange
} from '../../../src/orgCatalog/orgMetadataCatalogChangePubSub';
import {
  OrgMetadataCatalogStore,
  type OrgMetadataCatalogSnapshot
} from '../../../src/orgCatalog/orgMetadataCatalogStore';

const makeHarness = () => {
  const saves: OrgMetadataCatalogSnapshot[] = [];
  const catalogChanges = Effect.runSync(PubSub.unbounded<OrgMetadataCatalogChange>({ replay: 16 }));
  const dependencies = Layer.mergeAll(
    Layer.succeed(OrgMetadataCatalogStore, {
      load: () => Effect.succeed(undefined),
      save: (snapshot: OrgMetadataCatalogSnapshot) =>
        Effect.sync(() => {
          saves.push(snapshot);
          return URI.file('/workspace/catalog.json');
        })
    } as unknown as InstanceType<typeof OrgMetadataCatalogStore>),
    Layer.succeed(
      OrgMetadataCatalogChangePubSub,
      catalogChanges as unknown as InstanceType<typeof OrgMetadataCatalogChangePubSub>
    ),
    TransmogrifierService.Default
  );
  const stateLayer = OrgCatalogState.DefaultWithoutDependencies.pipe(Layer.provide(dependencies));
  const layer = Layer.mergeAll(
    stateLayer,
    OrgMetadataCatalogRecorder.DefaultWithoutDependencies.pipe(Layer.provide(Layer.mergeAll(dependencies, stateLayer)))
  );
  return { catalogChanges, layer, saves };
};

describe('OrgMetadataCatalogRecorder', () => {
  it('updates memory before returning and coalesces unchanged observations on disk', async () => {
    const { layer, saves } = makeHarness();

    const cached = await Effect.runPromise(
      Effect.gen(function* () {
        const recorder = yield* OrgMetadataCatalogRecorder;
        const state = yield* OrgCatalogState;
        const summaries = [{ name: 'Account', custom: false, queryable: true }];
        yield* recorder.recordSObjectList('org-one', summaries);
        const immediate = yield* state.getSObjectList('org-one');
        yield* recorder.recordSObjectList('org-one', summaries);
        yield* Effect.sleep('350 millis');
        return immediate;
      }).pipe(Effect.provide(layer))
    );

    expect(cached).toEqual([expect.objectContaining({ name: 'Account', orgId: 'org-one' })]);
    expect(saves).toHaveLength(1);
    expect(saves[0]).toMatchObject({ version: 2, orgId: 'org-one' });
  });

  it('records normalized metadata describe and listing observations', async () => {
    const { layer, saves } = makeHarness();

    await Effect.runPromise(
      Effect.gen(function* () {
        const recorder = yield* OrgMetadataCatalogRecorder;
        yield* recorder.recordMetadataTypes('org-one', [
          { xmlName: 'ApexClass', directoryName: 'classes', suffix: 'cls', metaFile: true }
        ]);
        yield* recorder.recordMetadataListing('org-one', 'ApexClass', undefined, [
          { fullName: 'Foo', lastModifiedDate: '2026-08-06T00:00:00.000Z' }
        ]);
        yield* Effect.sleep('350 millis');
      }).pipe(Effect.provide(layer))
    );

    expect(saves).toHaveLength(1);
    expect(saves[0]?.metadataTypes).toEqual([
      expect.objectContaining({ xmlName: 'ApexClass', directoryName: 'classes' })
    ]);
    expect(saves[0]?.metadataListings).toEqual([
      expect.objectContaining({ xmlName: 'ApexClass', components: [expect.objectContaining({ fullName: 'Foo' })] })
    ]);
  });

  it('publishes one targeted tracking change and suppresses an identical observation', async () => {
    const { catalogChanges, layer } = makeHarness();

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const recorder = yield* OrgMetadataCatalogRecorder;
          const subscription = yield* PubSub.subscribe(catalogChanges);
          const status = [{ origin: 'remote', type: 'ApexClass', fullName: 'Foo', state: 'modify' }];
          const remote = [{ type: 'ApexClass', name: 'Foo', revisionCounter: 1 }];
          const first = yield* recorder.recordTrackingStatus('org-one', status, remote);
          const event = yield* Queue.take(subscription);
          const second = yield* recorder.recordTrackingStatus('org-one', status, remote);
          return { event, first, second, queued: yield* Queue.size(subscription) };
        })
      ).pipe(Effect.provide(layer))
    );

    expect(result.first).toEqual([{ xmlName: 'ApexClass', fullName: 'Foo' }]);
    expect(result.second).toEqual([]);
    expect(result.event).toMatchObject({ kind: 'tracking', orgId: 'org-one' });
    expect(result.queued).toBe(0);
  });

  it('invalidates affected state and publishes an operation before returning', async () => {
    const { catalogChanges, layer } = makeHarness();

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const recorder = yield* OrgMetadataCatalogRecorder;
          const state = yield* OrgCatalogState;
          const subscription = yield* PubSub.subscribe(catalogChanges);
          yield* state.setTracking(
            'org-one',
            new Map([
              [
                'ApexClass\0Foo',
                { reference: { xmlName: 'ApexClass', fullName: 'Foo' }, signature: 'modify\0revision-1' }
              ]
            ])
          );
          yield* recorder.recordOperation({
            orgId: 'org-one',
            operation: 'retrieve',
            completedAt: '2026-08-06T00:00:00.000Z',
            changes: [{ metadataType: 'ApexClass', fullName: 'Foo', changeType: 'created', fileUri: Option.none() }]
          });
          return {
            event: yield* Queue.take(subscription),
            tracking: yield* state.getTracking('org-one')
          };
        })
      ).pipe(Effect.provide(layer))
    );

    expect(result.event).toMatchObject({ kind: 'operation', event: { orgId: 'org-one' } });
    expect(result.tracking.size).toBe(0);
  });
});
