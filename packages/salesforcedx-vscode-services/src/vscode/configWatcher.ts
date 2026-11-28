/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ChannelService, SettingsChangePubSub } from '@salesforce/vscode-services/v2';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import { CODE_BUILDER_WEB_SECTION, RETRIEVE_ON_LOAD_KEY } from '../constants';
import { retrieveOnLoadEffect } from '../core/retrieveOnLoad';

/** ConnectionWatcherLayer already owns auth changes; this watcher handles only retrieve-on-load settings. */
export const watchRetrieveOnLoadSetting = Effect.fn('watchRetrieveOnLoadSetting')(function* () {
  const [settingsChangePubSub, channelService] = yield* Effect.all([SettingsChangePubSub, ChannelService], {
    concurrency: 'unbounded'
  });

  // watch retrieveOnLoad setting
  yield* Stream.fromPubSub(settingsChangePubSub).pipe(
    Stream.filter(event => event.affectsConfiguration(`${CODE_BUILDER_WEB_SECTION}.${RETRIEVE_ON_LOAD_KEY}`)),
    Stream.debounce(Duration.millis(100)),
    Stream.tap(() => channelService.appendToChannel(`ConfigChanged: ${RETRIEVE_ON_LOAD_KEY}`)),
    Stream.runForEach(() => retrieveOnLoadEffect())
  );
});
