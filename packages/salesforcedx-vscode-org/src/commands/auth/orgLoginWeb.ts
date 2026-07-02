/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { nls } from '../../messages';
import { gatherAuthParams } from './authParamsGatherer';
import { executeOrgLoginWeb } from './orgLoginWebExec';

/**
 * Effect command for `sf.org.login.web`: gather alias + login URL, then run `sf org login web`.
 *
 * Replaces the old SfCommandlet/CliCommandExecutor executor. The command string is built from the
 * gathered alias + instance URL; the shared executeOrgLoginWeb runs it (simpleExec injects
 * SF_JSON_TO_STDOUT + FORCE_COLOR=0 for the `sf ` prefix), handling verification code, cancellable
 * progress, port-conflict, and config refresh.
 */
export const orgLoginWebCommand = Effect.fn('orgLoginWebCommand')(function* (
  instanceUrl?: string,
  reauthAliasOrUsername?: string
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;

  // precondition: getSfProject sets the sf:project_opened context and fails with a typed
  // FailedToResolveSfProjectError (rendered by ErrorHandlerService) when there's no project.
  yield* api.services.ProjectService.getSfProject();

  const { alias, loginUrl } = yield* gatherAuthParams({ instanceUrl, reauthAliasOrUsername });

  // quote alias + url so spaces/special chars in the alias don't split the shell command. Note: double
  // quotes do NOT neutralize $, backticks, or an embedded " under /bin/sh -c; real-world risk is low
  // (alias is locally user-typed, loginUrl is validateUrl-checked) but this is not full shell escaping.
  const command = `sf org login web --alias "${alias}" --instance-url "${loginUrl}" --set-default --json`;

  yield* executeOrgLoginWeb({ command, progressMessage: nls.localize('org_login_web_progress') });
});
