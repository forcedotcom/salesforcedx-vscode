/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { FileChangeEvent } from './fileChangePubSub.js';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import type * as PubSub from 'effect/PubSub';
import * as Schema from 'effect/Schema';
import type { URI } from 'vscode-uri';
import { OrgId } from './defaultOrgInfo.js';
import { UriSchema } from './uriSchema.js';

export const MetadataChangeType = Schema.Literals(['created', 'changed', 'unchanged', 'deleted']);
export type MetadataChangeType = typeof MetadataChangeType.Type;
export const MetadataChangeEvent = Schema.Struct({
  metadataType: Schema.String,
  fullName: Schema.String,
  changeType: MetadataChangeType,
  fileUri: Schema.OptionFromOptional(UriSchema),
  fileUris: UriSchema.pipe(Schema.Array, Schema.optional)
});
export type MetadataChangeEvent = typeof MetadataChangeEvent.Type;
export const MetadataOperationEvent = Schema.Struct({
  orgId: Schema.optional(OrgId),
  operation: Schema.Literals(['deploy', 'retrieve', 'delete']),
  completedAt: Schema.String,
  changes: Schema.Array(MetadataChangeEvent)
});
export type MetadataOperationEvent = typeof MetadataOperationEvent.Type;
const preferredFileUri = (existing: Option.Option<URI>, candidate: Option.Option<URI>): Option.Option<URI> => {
  const first = Option.getOrUndefined(existing);
  const next = Option.getOrUndefined(candidate);
  return !first
    ? candidate
    : !next || !first.path.endsWith('-meta.xml') || next.path.endsWith('-meta.xml')
      ? existing
      : candidate;
};
export const metadataChangeFileUris = (change: MetadataChangeEvent): readonly URI[] => [
  ...(change.fileUris ?? []),
  ...Option.toArray(change.fileUri)
];
/** Collapse source/meta and bundle file responses to one change per metadata identity. */
export const dedupeMetadataChanges = (changes: readonly MetadataChangeEvent[]): readonly MetadataChangeEvent[] => [
  ...changes
    .reduce((result, change) => {
      const key = `${change.metadataType}\0${change.fullName}`;
      const previous = result.get(key);
      return result.set(
        key,
        previous
          ? {
              ...previous,
              fileUri: preferredFileUri(previous.fileUri, change.fileUri),
              fileUris: [
                ...new Map(
                  [...metadataChangeFileUris(previous), ...metadataChangeFileUris(change)].map(uri => [
                    uri.toString(),
                    uri
                  ])
                ).values()
              ]
            }
          : { ...change, fileUris: [...metadataChangeFileUris(change)] }
      );
    }, new Map<string, MetadataChangeEvent>())
    .values()
];
export class MetadataChangeNotificationService extends Context.Service<
  MetadataChangeNotificationService,
  {
    readonly pubsub: PubSub.PubSub<MetadataOperationEvent>;
    readonly publishOperation: (event: MetadataOperationEvent) => Effect.Effect<void>;
    readonly dedupeWorkspaceEvents: (events: readonly FileChangeEvent[]) => Effect.Effect<readonly FileChangeEvent[]>;
  }
>()('@salesforce/vscode-services-v2/MetadataChangeNotificationService') {}
