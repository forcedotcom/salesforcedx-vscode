/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import {
  ACCESS_TOKEN_KEY,
  CODE_BUILDER_WEB_SECTION,
  INSTANCE_URL_KEY,
  RETRIEVE_ON_LOAD_KEY,
  API_VERSION_KEY
} from '../constants';
import { ConnectionService } from '../core/connectionService';
import { retrieveOnLoadEffect } from '../core/retrieveOnLoad';
import { ChannelService } from './channelService';

/** Watches settings changes and triggers appropriate effects */
export const watchSettingsService = Effect.fn('watchSettingsService')(function* () {
  console.log('watchSettingsService starting');

  const channelService = yield* ChannelService;

  yield* Effect.fork(
    Stream.async<vscode.ConfigurationChangeEvent>(emit => {
      const disposable = vscode.workspace.onDidChangeConfiguration(event => {
        if (authSettings.some(s => event.affectsConfiguration(s))) {
          void emit.single(event);
        }
      });
      return Effect.sync(() => disposable.dispose());
    }).pipe(
      Stream.debounce(Duration.millis(100)),
      Stream.tap(() => channelService.appendToChannel('ConfigChanged: Web Auth')),
      Stream.runForEach(() => ConnectionService.getConnection().pipe(Effect.catchAll(() => Effect.void)))
    )
  );

  yield* Stream.async<vscode.ConfigurationChangeEvent>(emit => {
    const disposable = vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration(`${CODE_BUILDER_WEB_SECTION}.${RETRIEVE_ON_LOAD_KEY}`)) {
        void emit.single(event);
      }
    });
    return Effect.sync(() => disposable.dispose());
  }).pipe(
    Stream.debounce(Duration.millis(100)),
    Stream.tap(() => channelService.appendToChannel(`ConfigChanged: ${RETRIEVE_ON_LOAD_KEY}`)),
    Stream.runForEach(() => retrieveOnLoadEffect())
  );
  console.log('watchSettingsService started');
});

const authSettings = [INSTANCE_URL_KEY, ACCESS_TOKEN_KEY, API_VERSION_KEY].map(
  key => `${CODE_BUILDER_WEB_SECTION}.${key}`
);
