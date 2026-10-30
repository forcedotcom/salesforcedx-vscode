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
  metadataChangeFileUris,
  type FileChangeEvent,
  type MetadataChangeEvent,
  type MetadataOperationEvent,
  type OrgMetadataCatalogChange
} from '@salesforce/vscode-services-v2';
import * as Arr from 'effect/Array';
import * as Cache from 'effect/Cache';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as PubSub from 'effect/PubSub';
import * as Semaphore from 'effect/Semaphore';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type { URI } from 'vscode-uri';
import { ServiceOperations, ServiceOperationsLayer } from './serviceOperations.js';

const correlationWindow = Duration.seconds(2);
const canonicalFilePath = (uri: URI): string => uri.path.toLowerCase().replace(/-meta\.xml$/u, '');
type TrackedFile = { readonly changeType: MetadataChangeEvent['changeType']; readonly uri: URI };
const isExpected = (event: FileChangeEvent, tracked: TrackedFile) =>
  tracked.changeType === 'deleted' ? event.type === 'delete' : event.type === 'create' || event.type === 'change';

export const MetadataChangeNotificationServiceLayer = Layer.effect(
  MetadataChangeNotificationService,
  Effect.gen(function* () {
    const operations = yield* ServiceOperations;
    const permit = yield* Semaphore.make(1);
    const pubsub = yield* Effect.acquireRelease(PubSub.sliding<MetadataOperationEvent>(1000), PubSub.shutdown);
    const files = yield* Cache.make({
      capacity: Number.POSITIVE_INFINITY,
      timeToLive: correlationWindow,
      lookup: (_path: string) => Effect.succeed(Option.none<TrackedFile>())
    });
    yield* Effect.addFinalizer(() => Cache.invalidateAll(files));
    // Iteration prunes every expired cache entry, not only paths observed in the current batch.
    const activeFiles = Cache.entries(files).pipe(Effect.map(entries => Array.from(entries)));
    const publishOperation = Effect.fn('MetadataChangeNotificationService.publishOperation')(
      (event: MetadataOperationEvent) =>
        permit.withPermit(
          Effect.uninterruptible(
            Effect.gen(function* () {
              yield* activeFiles;
              const uris = event.changes.flatMap(metadataChangeFileUris);
              yield* Effect.annotateCurrentSpan({
                operation: event.operation,
                componentChangeCount: event.changes.length,
                operationFileCount: uris.length
              });
              yield* Effect.forEach(
                event.changes,
                change =>
                  Effect.forEach(
                    metadataChangeFileUris(change),
                    uri =>
                      Cache.set(files, canonicalFilePath(uri), Option.some({ uri, changeType: change.changeType })),
                    { discard: true }
                  ),
                { discard: true }
              );
              const published = yield* PubSub.publish(pubsub, event);
              if (!published) return yield* Effect.interrupt;
            })
          )
        ),
      operations.run
    );
    const dedupeWorkspaceEvents = Effect.fn('MetadataChangeNotificationService.dedupeWorkspaceEvents')(
      (events: readonly FileChangeEvent[]) =>
        permit.withPermit(
          Effect.gen(function* () {
            const active = yield* activeFiles;
            const unmatched = yield* Effect.forEach(events, event =>
              Cache.getSuccess(files, canonicalFilePath(event.uri)).pipe(
                Effect.map(Option.flatten),
                Effect.map(tracked =>
                  Option.match(tracked, {
                    onNone: () => Option.some(event),
                    onSome: value => (isExpected(event, value) ? Option.none<FileChangeEvent>() : Option.some(event))
                  })
                )
              )
            ).pipe(Effect.map(Arr.getSomes));
            yield* Effect.annotateCurrentSpan({
              workspaceEventCount: events.length,
              operationFileCount: active.length,
              suppressedWorkspaceEventCount: events.length - unmatched.length
            });
            return unmatched;
          })
        ),
      operations.run
    );
    yield* Effect.addFinalizer(() => operations.close);
    return MetadataChangeNotificationService.of({ pubsub, publishOperation, dedupeWorkspaceEvents });
  })
).pipe(Layer.provideMerge(ServiceOperationsLayer));

export const ActiveMetadataOperationRefLayer = Layer.effect(
  ActiveMetadataOperationRef,
  Effect.acquireRelease(SubscriptionRef.make(0), ref => PubSub.shutdown(ref.pubsub))
);
export const OrgMetadataCatalogChangePubSubLayer = Layer.effect(
  OrgMetadataCatalogChangePubSub,
  Effect.acquireRelease(PubSub.sliding<OrgMetadataCatalogChange>(100), PubSub.shutdown)
);
