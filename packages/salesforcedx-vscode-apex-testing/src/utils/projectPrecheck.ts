/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { nls } from '../messages';
import { notificationService } from './notificationHelpers';

/**
 * Inline replacement for the deleted sfProjectPreconditionChecker (which ran Effect.runPromise internally).
 * If the workspace is not a Salesforce project, shows an error and fails with UserCancellationError so the
 * command swallows it cleanly via registerCommandWithRuntime.
 */
export const ensureSalesforceProject = Effect.fn('ensureSalesforceProject')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const isProject = yield* api.services.ProjectService.isSalesforceProject();
  if (!isProject) {
    notificationService.showErrorMessage(nls.localize('predicates_no_salesforce_project_found_text'));
    return yield* new api.services.UserCancellationError();
  }
});
