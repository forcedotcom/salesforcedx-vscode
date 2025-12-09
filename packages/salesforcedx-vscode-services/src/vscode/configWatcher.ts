/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Scope from 'effect/Scope';
import * as Stream from 'effect/Stream';
import {
  ACCESS_TOKEN_KEY,
  CODE_BUILDER_WEB_SECTION,
  INSTANCE_URL_KEY,
  RETRIEVE_ON_LOAD_KEY,
  API_VERSION_KEY
} from '../constants';
import { ConfigService } from '../core/configService';
import { ConnectionService } from '../core/connectionService';
import { MetadataRegistryService } from '../core/metadataRegistryService';
import { MetadataRetrieveService } from '../core/metadataRetrieveService';
import { ProjectService } from '../core/projectService';
import { retrieveOnLoadEffect } from '../core/retrieveOnLoad';
import { SourceTrackingService } from '../core/sourceTrackingService';
import { ChannelService } from './channelService';
import { SettingsService } from './settingsService';
import { SettingsWatcherService } from './settingsWatcherService';
import { WorkspaceService } from './workspaceService';

/** Watches settings changes and triggers appropriate effects */
export const watchSettingsService = (): Effect.Effect<
  void,
  Error,
  | SettingsService
  | SettingsWatcherService
  | ConnectionService
  | ConfigService
  | WorkspaceService
  | Scope.CloseableScope
  | MetadataRetrieveService
  | ProjectService
  | MetadataRegistryService
  | SourceTrackingService
  | ChannelService
  | Scope.CloseableScope
> =>
  Effect.gen(function* () {
    console.log('watchSettingsService starting');

    const [settingsWatcherService, connectionService, channelService] = yield* Effect.all(
      [SettingsWatcherService, ConnectionService, ChannelService],
      {
        concurrency: 'unbounded'
      }
    );

    // watches auth settings
    yield* Effect.fork(
      Stream.fromPubSub(settingsWatcherService.pubsub).pipe(
        Stream.filter(event => authSettings.some(s => event.affectsConfiguration(s))),
        Stream.debounce(Duration.millis(100)),
        Stream.tap(() => channelService.appendToChannel('ConfigChaged: Web Auth')),
        Stream.runForEach(() => connectionService.getConnection.pipe(Effect.catchAll(() => Effect.void))) // it's possible for the connection to fail and that's ok.  Some other event will try to get a connection and display a real error
      )
    );

    // watch retrieveOnLoad setting
    yield* Stream.fromPubSub(settingsWatcherService.pubsub).pipe(
      Stream.filter(event => event.affectsConfiguration(`${CODE_BUILDER_WEB_SECTION}.${RETRIEVE_ON_LOAD_KEY}`)),
      Stream.debounce(Duration.millis(100)),
      Stream.tap(() => channelService.appendToChannel(`ConfigChanged: ${RETRIEVE_ON_LOAD_KEY}`)),
      Stream.runForEach(() => retrieveOnLoadEffect())
    );
    console.log('watchSettingsService started');
  }).pipe(Effect.withSpan('watchSettingsService'));

const authSettings = [INSTANCE_URL_KEY, ACCESS_TOKEN_KEY, API_VERSION_KEY].map(
  key => `${CODE_BUILDER_WEB_SECTION}.${key}`
);
