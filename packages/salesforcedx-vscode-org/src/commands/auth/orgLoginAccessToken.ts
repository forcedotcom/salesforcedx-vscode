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
 * `ConnectionService.loginWithAccessToken` (create → save → alias/default). On `BadOAuthTokenError` it
 * reveals the channel and re-fails the ORIGINAL error so ErrorHandlerService appends the friendly,
 * services-localized message to the channel AND toasts it (preserving the old executor's UX). Other
 * auth failures (create/save/alias) propagate untouched to the registerCommand-layer ErrorHandlerService.
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
    Effect.catchTag('BadOAuthTokenError', e =>
      Effect.gen(function* () {
        // reveal the channel, then re-fail the original error so ErrorHandlerService appends e.message
        // (the friendly, services-localized text) to the channel and toasts it.
        const channel = yield* api.services.ChannelService;
        yield* channel.showChannel;
        return yield* e;
      })
    )
  );

  yield* Effect.promise(() => updateConfigAndStateAggregators());
});
