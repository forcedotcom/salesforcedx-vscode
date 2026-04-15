/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as PubSub from 'effect/PubSub';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { CORE_CONFIG_SECTION, CORE_EXTENSION_ID, EXTENSION_NAME } from '../constants';

const USE_METADATA_EXTENSION_COMMANDS_KEY = 'useMetadataExtensionCommands';
const SHOW_SHARED_COMMANDS_CONTEXT = `${EXTENSION_NAME}.showSharedCommands`;

export const getShowSharedCommands = (): boolean =>
  !vscode.extensions.getExtension(CORE_EXTENSION_ID) ||
  vscode.workspace.getConfiguration(CORE_CONFIG_SECTION).get<boolean>(USE_METADATA_EXTENSION_COMMANDS_KEY, false);

const updateShowSharedCommandsContext = () =>
  Effect.promise(() =>
    vscode.commands.executeCommand('setContext', SHOW_SHARED_COMMANDS_CONTEXT, getShowSharedCommands())
  );

/** Watches for useMetadataExtensionCommands setting changes and updates context */
export const watchUseMetadataExtensionCommands = () =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const channelService = yield* api.services.ChannelService;

    const pubsub = yield* PubSub.sliding<vscode.ConfigurationChangeEvent>(100);
    const disposable = vscode.workspace.onDidChangeConfiguration(event => {
      Effect.runSync(PubSub.publish(pubsub, event));
    });

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        disposable?.dispose();
      })
    );

    yield* Stream.fromPubSub(pubsub).pipe(
      Stream.filter(event =>
        event.affectsConfiguration(`${CORE_CONFIG_SECTION}.${USE_METADATA_EXTENSION_COMMANDS_KEY}`)
      ),
      Stream.debounce(Duration.millis(100)),
      Stream.tap(() => channelService.appendToChannel(`ConfigChanged: ${USE_METADATA_EXTENSION_COMMANDS_KEY}`)),
      Stream.runForEach(() => updateShowSharedCommandsContext())
    );
  }).pipe(Effect.withSpan('watchUseMetadataExtensionCommands'));
