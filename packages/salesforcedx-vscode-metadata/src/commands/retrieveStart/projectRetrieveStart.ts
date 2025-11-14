/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { AllServicesLayer, ExtensionProviderService } from '../../services/extensionProvider';

/** Retrieve remote changes from the default org (placeholder) */
export const projectRetrieveStart = async (): Promise<void> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const channelService = yield* api.services.ChannelService;

      const errorMsg = 'Retrieve remote changes is not yet implemented';
      yield* Effect.all(
        [channelService.appendToChannel(errorMsg), Effect.promise(() => vscode.window.showErrorMessage(errorMsg))],
        { concurrency: 'unbounded' }
      );
    }).pipe(Effect.withSpan('projectRetrieveStart'), Effect.provide(AllServicesLayer))
  );
