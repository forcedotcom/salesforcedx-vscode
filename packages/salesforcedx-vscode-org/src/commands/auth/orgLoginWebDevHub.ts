/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { nls } from '../../messages';
import { promptForAlias } from './authParamsGatherer';
import { executeOrgLoginWeb } from './orgLoginWebExec';

/**
 * Effect command for `sf.org.login.web.dev.hub`: prompt for an alias, then run
 * `sf org login web --alias <alias> --set-default-dev-hub` (interactive browser auth).
 *
 * Shares the executeOrgLoginWeb executor with `sf.org.login.web` (same CLI, only the flags differ):
 * verification-code fork, cancellable progress, port-1717 conflict handling, and config refresh.
 *
 * Telemetry: the root span name `sf.org.login.web.dev.hub` IS the telemetry event name (set by
 * registerCommandWithRuntime); this intentionally renames the old `org_login_web_dev_hub` key — same
 * migration orgOpen made. No manual logMetric.
 */
export const orgLoginWebDevHubCommand = Effect.fn('orgLoginWebDevHubCommand')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;

  // precondition: getSfProject sets the sf:project_opened context and fails with a typed
  // FailedToResolveSfProjectError (rendered by ErrorHandlerService) when there's no project.
  yield* api.services.ProjectService.getSfProject();

  const alias = yield* promptForAlias();

  // quote alias so spaces/special chars don't split the shell command; validateAliasInput (in
  // promptForAlias) already blocked shell metacharacters. simpleExec injects SF_JSON_TO_STDOUT +
  // FORCE_COLOR=0 for the `sf ` prefix.
  const command = `sf org login web --alias "${alias}" --set-default-dev-hub`;

  yield* executeOrgLoginWeb({ command, progressMessage: nls.localize('org_login_web_dev_hub_progress') });
});
