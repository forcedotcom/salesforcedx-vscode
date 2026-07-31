/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { FileChangeEvent } from '../vscode/fileChangePubSub';
import * as Clock from 'effect/Clock';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as PubSub from 'effect/PubSub';
import * as Ref from 'effect/Ref';
import * as Schema from 'effect/Schema';
import { URI } from 'vscode-uri';
import { MetadataChangeType } from './sdrGuards';

const WORKSPACE_CORRELATION_WINDOW_MS = 2000;

// URI has a protected constructor so Schema.instanceOf doesn't apply; use Schema.declare with instanceof predicate
const UriSchema = Schema.declare((u): u is URI => u instanceof URI, {
  identifier: 'URI',
  description: 'vscode-uri URI'
});

export const MetadataChangeEvent = Schema.Struct({
  metadataType: Schema.String,
  fullName: Schema.String,
  changeType: MetadataChangeType,
  fileUri: Schema.optionalWith(UriSchema, { as: 'Option' }),
  fileUris: UriSchema.pipe(Schema.Array, Schema.optional)
});
export type MetadataChangeEvent = Schema.Schema.Type<typeof MetadataChangeEvent>;

export const MetadataOperationEvent = Schema.Struct({
  orgId: Schema.optional(Schema.String),
  operation: Schema.Literal('deploy', 'retrieve', 'delete'),
  completedAt: Schema.String,
  changes: Schema.Array(MetadataChangeEvent)
});
export type MetadataOperationEvent = Schema.Schema.Type<typeof MetadataOperationEvent>;

const preferredFileUri = (existing: Option.Option<URI>, candidate: Option.Option<URI>): Option.Option<URI> => {
  const existingUri = Option.getOrUndefined(existing);
  const candidateUri = Option.getOrUndefined(candidate);
  if (!existingUri) return candidate;
  if (!candidateUri || !existingUri.path.endsWith('-meta.xml')) return existing;
  return candidateUri.path.endsWith('-meta.xml') ? existing : candidate;
};

const allFileUris = (change: MetadataChangeEvent): readonly URI[] => [
  ...(change.fileUris ?? []),
  ...Option.toArray(change.fileUri)
];

const canonicalFilePath = (uri: URI): string => uri.path.toLowerCase().replace(/-meta\.xml$/u, '');

const isExpectedOperationFileEvent = (
  event: FileChangeEvent,
  tracked: { readonly changeType: MetadataChangeEvent['changeType'] }
): boolean =>
  tracked.changeType === 'deleted' ? event.type === 'delete' : event.type === 'create' || event.type === 'change';

/** Collapse source/meta and bundle file responses to one change per metadata identity. */
export const dedupeMetadataChanges = (changes: readonly MetadataChangeEvent[]): readonly MetadataChangeEvent[] => [
  ...changes
    .reduce((deduped, change) => {
      const key = `${change.metadataType}\0${change.fullName}`;
      const existing = deduped.get(key);
      return deduped.set(
        key,
        existing
          ? {
              ...existing,
              fileUri: preferredFileUri(existing.fileUri, change.fileUri),
              fileUris: [
                ...new Map(
                  [...allFileUris(existing), ...allFileUris(change)].map(uri => [uri.toString(), uri])
                ).values()
              ]
            }
          : { ...change, fileUris: [...allFileUris(change)] }
      );
    }, new Map<string, MetadataChangeEvent>())
    .values()
];

/** Publishes one event per successful metadata operation. */
export class MetadataChangeNotificationService extends Effect.Service<MetadataChangeNotificationService>()(
  'MetadataChangeNotificationService',
  {
    effect: Effect.gen(function* () {
      const pubsub = yield* PubSub.sliding<MetadataOperationEvent>(1000);
      const operationFileUris = yield* Ref.make<
        ReadonlyMap<
          string,
          {
            readonly changeType: MetadataChangeEvent['changeType'];
            readonly expiresAt: number;
            readonly uri: URI;
          }
        >
      >(new Map());

      const publishOperation = Effect.fn('MetadataChangeNotificationService.publishOperation')(function* (
        event: MetadataOperationEvent
      ) {
        const now = yield* Clock.currentTimeMillis;
        const fileUris = event.changes.flatMap(allFileUris);
        yield* Effect.annotateCurrentSpan({
          operation: event.operation,
          componentChangeCount: event.changes.length,
          operationFileCount: fileUris.length
        });
        yield* Ref.update(
          operationFileUris,
          current =>
            new Map([
              ...[...current].filter(([, tracked]) => tracked.expiresAt > now),
              ...event.changes.flatMap(change =>
                allFileUris(change).map(
                  uri =>
                    [
                      canonicalFilePath(uri),
                      { changeType: change.changeType, expiresAt: now + WORKSPACE_CORRELATION_WINDOW_MS, uri }
                    ] as const
                )
              )
            ])
        );
        yield* PubSub.publish(pubsub, event);
      });

      const dedupeWorkspaceEvents = Effect.fn('MetadataChangeNotificationService.dedupeWorkspaceEvents')(function* (
        events: readonly FileChangeEvent[]
      ) {
        const now = yield* Clock.currentTimeMillis;
        const operationFiles = yield* Ref.updateAndGet(
          operationFileUris,
          current => new Map([...current].filter(([, tracked]) => tracked.expiresAt > now))
        );
        const unmatched = events.filter(event => {
          const tracked = operationFiles.get(canonicalFilePath(event.uri));
          return !tracked || !isExpectedOperationFileEvent(event, tracked);
        });
        yield* Effect.annotateCurrentSpan({
          workspaceEventCount: events.length,
          operationFileCount: operationFiles.size,
          suppressedWorkspaceEventCount: events.length - unmatched.length
        });
        return unmatched;
      });

      return { dedupeWorkspaceEvents, publishOperation, pubsub };
    })
  }
) {}
