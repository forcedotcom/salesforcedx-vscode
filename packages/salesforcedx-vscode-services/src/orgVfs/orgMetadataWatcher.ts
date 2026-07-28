/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as PubSub from 'effect/PubSub';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type { URI } from 'vscode-uri';
import { getDefaultOrgRef } from '../core/defaultOrgRef';
import { FileChangePubSub } from '../vscode/fileChangePubSub';
import { orgDataOwnerRoot } from './orgDataUris';
import { OrgMetadataChangePubSub } from './orgMetadataChangePubSub';
import { OrgMetadataResolver } from './orgMetadataResolver';

export const watchOrgMetadataResolver = Effect.fn('watchOrgMetadataResolver')(function* (
  notifyChanged: (uri: URI) => void
) {
  const [resolver, fileChanges, metadataChanges, defaultOrgRef] = yield* Effect.all([
    OrgMetadataResolver,
    FileChangePubSub,
    OrgMetadataChangePubSub,
    getDefaultOrgRef()
  ]);

  yield* Stream.merge(
    Stream.fromPubSub(fileChanges).pipe(Stream.map(() => undefined)),
    defaultOrgRef.changes.pipe(Stream.map(() => undefined))
  ).pipe(
    Stream.runForEach(() =>
      Effect.gen(function* () {
        yield* resolver.invalidate();
        const { orgId } = yield* SubscriptionRef.get(defaultOrgRef);
        if (orgId) {
          const uri = orgDataOwnerRoot({ orgKey: orgId, owner: 'org-metadata' });
          yield* Effect.all([Effect.sync(() => notifyChanged(uri)), PubSub.publish(metadataChanges, uri)], {
            discard: true
          });
        }
      })
    )
  );
});
