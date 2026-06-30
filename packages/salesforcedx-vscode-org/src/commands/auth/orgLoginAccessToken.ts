/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { identity } from 'effect/Function';
import { updateConfigAndStateAggregators } from '../../util/orgUtil';
import { gatherAccessTokenParams } from './authParamsGatherer';

/**
 * Effect command for `sf.org.login.access.token`: authorize an org from a session ID.
 *
 * Gathers instanceUrl/alias/token, then shells `sf org login access-token --instance-url "<url>"
 * --alias "<alias>" --set-default --no-prompt`. The token never touches argv/span/history — it rides
 * the `SF_ACCESS_TOKEN` env var, which plugin-auth reads pre-prompt (`@salesforce/core` recognizes it),
 * making the CLI headless. Both interpolated args are regex-validated at the prompt to reject shell
 * metachars (alias via isAlphaNumSpaceString, instanceUrl via validateUrl) AND double-quoted, so the
 * exec string is injection-safe. `--set-default` matches the prior LibraryCommandletExecutor behavior
 * (which set the org as default); a project is required so the org can be the project's default.
 *
 * Cancellation (gatherer ESC) surfaces as UserCancellationError and is swallowed by registerCommand;
 * a CLI failure surfaces as TerminalServiceError → ErrorHandlerService toast with the CLI's own message.
 */
export const orgLoginAccessTokenCommand = Effect.fn('orgLoginAccessTokenCommand')(function* () {
  const { instanceUrl, alias, accessToken } = yield* gatherAccessTokenParams();

  const api = yield* (yield* ExtensionProviderService).getServicesApi;

  // precondition: getSfProject sets the sf:project_opened context and fails with a typed
  // FailedToResolveSfProjectError (rendered by ErrorHandlerService) when there's no project.
  // a project is required so the authorized org can become its default (--set-default below).
  yield* api.services.ProjectService.getSfProject();

  const terminalService = yield* api.services.TerminalService;
  const output = yield* terminalService.simpleExec({
    command: `sf org login access-token --instance-url "${instanceUrl}" --alias "${alias}" --set-default --no-prompt`,
    parse: identity,
    env: { SF_ACCESS_TOKEN: accessToken }
  });

  const channel = yield* api.services.ChannelService;
  yield* channel.appendToChannel(output);
  yield* channel.showChannel;

  yield* Effect.log('org login access-token authorized', { instanceUrl, alias });
  yield* Effect.tryPromise(() => updateConfigAndStateAggregators());
});
