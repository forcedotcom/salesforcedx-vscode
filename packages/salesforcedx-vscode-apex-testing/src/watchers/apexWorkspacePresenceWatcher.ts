/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import { getTestController } from '../views/testController';

const isApexPresenceChange = (event: {
  readonly type: 'create' | 'change' | 'delete';
  readonly uri: { readonly path: string };
}): boolean => (event.type === 'create' || event.type === 'delete') && event.uri.path.toLowerCase().endsWith('.cls');

/**
 * Rebuilds TestItems when an Apex class enters or leaves the workspace.
 *
 * TestItem.uri is immutable, so resolver invalidation alone cannot repoint an existing item between its
 * canonical org-metadata URI and workspace file URI. A debounced refresh recreates the affected tree state
 * after source topology changes while ignoring ordinary file edits.
 */
export const setupApexWorkspacePresenceWatcher = Effect.fn('apex-testing.watchApexWorkspacePresence')(function* (
  testController: ReturnType<typeof getTestController>
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fileChanges = yield* api.services.FileChangePubSub;

  yield* Stream.fromPubSub(fileChanges).pipe(
    Stream.filter(isApexPresenceChange),
    Stream.debounce(Duration.millis(250)),
    Stream.runForEach(event =>
      Effect.promise(() => testController.refresh()).pipe(
        Effect.withSpan('ApexWorkspacePresenceWatcher.refresh', {
          attributes: {
            changeType: event.type,
            uri: event.uri.toString()
          }
        })
      )
    )
  );
});
