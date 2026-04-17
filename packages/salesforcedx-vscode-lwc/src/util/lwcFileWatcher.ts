/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getServicesApi } from '@salesforce/effect-ext-utils';
import { Effect } from 'effect';
import * as Layer from 'effect/Layer';
import * as Stream from 'effect/Stream';
import { workspace } from 'vscode';

/** True if the URI path is under lwc/ and matches *.js, *.ts, *.html, or *js-meta.xml */
const isLwcFile = (uri: { path: string; fsPath?: string }): boolean => {
  const pathSegment = uri.fsPath ?? uri.path;
  if (!pathSegment.includes('/lwc/') && !pathSegment.includes('\\lwc\\')) {
    return false;
  }
  return (
    pathSegment.endsWith('.js') ||
    pathSegment.endsWith('.ts') ||
    pathSegment.endsWith('.html') ||
    pathSegment.endsWith('js-meta.xml')
  );
};

/**
 * Start LWC file watcher using FileWatcherService from salesforcedx-vscode-services.
 */
export const startLwcFileWatcherViaServices = (): void => {
  const apiResult = Effect.runSync(getServicesApi.pipe(Effect.either));
  if (apiResult._tag === 'Left') {
    throw new Error('Failed to get services API');
  }
  const api = apiResult.right;
  const layer = Layer.mergeAll(api.services.ChannelServiceLayer('LWC'), api.services.FileChangePubSub.Default);
  const subscriptionEffect = Effect.gen(function* () {
    const fileChangePubSub = yield* api.services.FileChangePubSub;
    yield* Effect.forkDaemon(
      Stream.fromPubSub(fileChangePubSub).pipe(
        Stream.filter(e => e.type === 'create' && isLwcFile(e.uri)),
        Stream.runForEach(e =>
          Effect.tryPromise(() => workspace.openTextDocument(e.uri)).pipe(Effect.orElseSucceed(() => undefined))
        )
      )
    );
    return yield* Effect.never;
  });
  try {
    Effect.runSync(Effect.forkDaemon(Effect.scoped(Effect.provide(subscriptionEffect, layer))));
  } catch {
    throw new Error('Failed to start LWC file watcher');
  }
};
