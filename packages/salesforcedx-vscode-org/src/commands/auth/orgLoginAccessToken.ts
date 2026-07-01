/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { identity } from 'effect/Function';
import { ConfigRefreshError, updateConfigAndStateAggregators } from '../../util/orgUtil';
import { gatherAccessTokenParams } from './authParamsGatherer';

/** authorize an org from a session ID. Token rides `SF_ACCESS_TOKEN` env (never argv/span/history). */
export const orgLoginAccessTokenCommand = Effect.fn('orgLoginAccessTokenCommand')(function* () {
  const { instanceUrl, alias, accessToken } = yield* gatherAccessTokenParams();

  const api = yield* (yield* ExtensionProviderService).getServicesApi;

  // precondition: getSfProject sets the sf:project_opened context and fails with a typed
  // FailedToResolveSfProjectError (rendered by ErrorHandlerService) when there's no project.
  // a project is required so the authorized org can become its default (--set-default below).
  yield* api.services.ProjectService.getSfProject();

  // args regex-validated at the prompt (reject shell metachars) AND double-quoted → exec injection-safe
  const output = yield* (yield* api.services.TerminalService).simpleExec({
    command: `sf org login access-token --instance-url "${instanceUrl}" --alias "${alias}" --set-default --no-prompt`,
    parse: identity,
    env: { SF_ACCESS_TOKEN: accessToken }
  });

  const channel = yield* api.services.ChannelService;
  yield* channel.appendToChannel(output);
  yield* channel.showChannel;

  yield* Effect.annotateCurrentSpan('instanceUrl', instanceUrl);
  yield* Effect.tryPromise({
    try: () => updateConfigAndStateAggregators(),
    catch: e => new ConfigRefreshError({ message: e instanceof Error ? e.message : String(e) })
  });
});
