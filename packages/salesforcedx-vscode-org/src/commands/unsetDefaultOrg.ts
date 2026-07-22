/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { nls } from '../messages';

/**
 * Effect command for `sf.unset.default.org`: clears the current target-org from local config and
 * reactively updates the status bar. The `sf:has_target_org` context key clears automatically,
 * hiding this command from the palette post-execution.
 */
export const unsetDefaultOrgCommand = Effect.fn('unsetDefaultOrgCommand')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  yield* api.services.ConfigService.unsetTargetOrg();
  yield* Effect.promise(() => vscode.window.showInformationMessage(nls.localize('unset_default_org_success'))).pipe(
    Effect.ignore
  );
});
