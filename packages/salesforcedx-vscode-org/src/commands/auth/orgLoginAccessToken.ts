/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { updateConfigAndStateAggregators } from '../../util/orgUtil';
import { gatherAccessTokenParams } from './authParamsGatherer';

/**
 * Effect command for `sf.org.login.access.token`: authorize an org from a session ID.
 *
 * Prompts (instanceUrl/alias/accessToken) via the PromptService-backed gatherer, then delegates auth to
 * `ConnectionService.loginWithAccessToken` (create → save → alias/default). ErrorHandlerService already
 * appends each error's friendly message to the channel and toasts it for every auth failure. The
 * `BadOAuthTokenError` branch adds one thing on top of that: it reveals the channel panel so the bad-session
 * message is visible without re-failing differently. Other auth failures (create/save/alias) propagate
 * untouched (append + toast, no reveal).
 */
export const orgLoginAccessToken = Effect.fn('orgLoginAccessToken')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;

  // precondition: getSfProject sets sf:project_opened and fails with a typed error (rendered by
  // ErrorHandlerService) when there's no project — matches orgOpenCommand.
  yield* api.services.ProjectService.getSfProject();

  const { instanceUrl, accessToken, alias } = yield* gatherAccessTokenParams();

  yield* api.services.ConnectionService.loginWithAccessToken({
    instanceUrl,
    accessToken,
    alias,
    setDefault: true
  }).pipe(
    // reveal the channel panel (ErrorHandlerService already appends e.message + toasts it), then re-fail
    Effect.catchTag('BadOAuthTokenError', e =>
      api.services.ChannelService.pipe(
        Effect.flatMap(channel => channel.showChannel),
        Effect.andThen(Effect.fail(e))
      )
    )
  );

  yield* Effect.promise(() => updateConfigAndStateAggregators());
});
