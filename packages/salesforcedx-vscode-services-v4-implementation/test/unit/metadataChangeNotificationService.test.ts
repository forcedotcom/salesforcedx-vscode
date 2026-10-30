/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ActiveMetadataOperationRef,
  MetadataChangeNotificationService,
  OrgMetadataCatalogChangePubSub,
  dedupeMetadataChanges
} from '@salesforce/vscode-services-v2';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Option from 'effect/Option';
import * as PubSub from 'effect/PubSub';
import * as TestClock from 'effect/testing/TestClock';
import { URI } from 'vscode-uri';
import {
  ActiveMetadataOperationRefLayer,
  MetadataChangeNotificationServiceLayer,
  OrgMetadataCatalogChangePubSubLayer
} from '../../src/metadataChangeNotificationService.js';

it('deduplicates source/sidecar and bundle responses while preserving every distinct path', () => {
  const source = URI.file('/project/lwc/example/example.js');
  const sidecar = URI.file('/project/lwc/example/example.js-meta.xml');
  const template = URI.file('/project/lwc/example/example.html');
  const result = dedupeMetadataChanges(
    [sidecar, source, template].map(uri => ({
      metadataType: 'LightningComponentBundle',
      fullName: 'example',
      changeType: 'changed',
      fileUri: Option.some(uri)
    }))
  );
  expect(result).toHaveLength(1);
  expect(Option.getOrUndefined(result[0].fileUri)).toBe(source);
  expect(result[0].fileUris).toEqual([sidecar, source, template]);
});

it('correlates all operation paths for exactly two seconds and retains contradictory manual changes', async () => {
  const source = URI.file('/project/classes/Foo.cls');
  const sidecar = URI.file('/project/classes/Foo.cls-meta.xml');
  const other = URI.file('/project/classes/Bar.cls');
  await Effect.runPromise(
    Effect.gen(function* () {
      const service = yield* MetadataChangeNotificationService;
      yield* service.publishOperation({
        operation: 'retrieve',
        completedAt: '2026-10-30T00:00:00.000Z',
        changes: [
          {
            metadataType: 'ApexClass',
            fullName: 'Foo',
            changeType: 'created',
            fileUri: Option.some(source),
            fileUris: [source, sidecar]
          }
        ]
      });
      expect(
        yield* service.dedupeWorkspaceEvents([
          { type: 'create', uri: source },
          { type: 'change', uri: sidecar },
          { type: 'change', uri: other }
        ])
      ).toEqual([{ type: 'change', uri: other }]);
      expect(yield* service.dedupeWorkspaceEvents([{ type: 'delete', uri: source }])).toEqual([
        { type: 'delete', uri: source }
      ]);
      yield* TestClock.adjust(Duration.millis(1999));
      expect(yield* service.dedupeWorkspaceEvents([{ type: 'change', uri: source }])).toEqual([]);
      yield* TestClock.adjust(Duration.millis(1));
      expect(yield* service.dedupeWorkspaceEvents([{ type: 'change', uri: source }])).toEqual([
        { type: 'change', uri: source }
      ]);
    }).pipe(Effect.provide(MetadataChangeNotificationServiceLayer), Effect.provide(TestClock.layer()))
  );
});

it('owns notification/catalog/active-operation subscriptions and rejects retained publishers after close', async () => {
  const runtime = ManagedRuntime.make(
    Layer.mergeAll(
      MetadataChangeNotificationServiceLayer,
      ActiveMetadataOperationRefLayer,
      OrgMetadataCatalogChangePubSubLayer
    )
  );
  const [service, active, catalog] = await runtime.runPromise(
    Effect.all([MetadataChangeNotificationService, ActiveMetadataOperationRef, OrgMetadataCatalogChangePubSub])
  );
  await runtime.dispose();
  expect(await Effect.runPromise(PubSub.isShutdown(service.pubsub))).toBe(true);
  expect(await Effect.runPromise(PubSub.isShutdown(active.pubsub))).toBe(true);
  expect(await Effect.runPromise(PubSub.isShutdown(catalog))).toBe(true);
  expect(
    Exit.isFailure(
      await Effect.runPromiseExit(service.publishOperation({ operation: 'retrieve', completedAt: '', changes: [] }))
    )
  ).toBe(true);
});
