/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import { workspace } from 'vscode';
import type { URI } from 'vscode-uri';

/** True if the URI path is under lwc/ and matches *.js, *.ts, *.html, or *js-meta.xml */
const isLwcFile = (uri: URI): boolean => {
  const pathSegment = uri.fsPath ?? uri.path;
  return !pathSegment.includes('/lwc/') && !pathSegment.includes('\\lwc\\')
    ? false
    : ['.js', '.ts', '.html', 'js-meta.xml'].some(ext => pathSegment.endsWith(ext));
};

/**
 * Watch for newly created LWC files and auto-open them to trigger delayed initialization.
 * Handles files downloaded from org browser after the server starts —
 * opening syncs them via onDidOpen, which triggers delayed initialization.
 */
export const startLwcFileWatcher = Effect.fn('lwc.watchFileCreates')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fileChangePubSub = yield* api.services.FileChangePubSub;

  yield* Stream.fromPubSub(fileChangePubSub).pipe(
    Stream.filter(e => e.type === 'create'),
    Stream.map(e => e.uri),
    Stream.filter(isLwcFile),
    Stream.runForEach(uri =>
      Effect.tryPromise(() => workspace.openTextDocument(uri)).pipe(Effect.orElseSucceed(() => undefined))
    )
  );
});
