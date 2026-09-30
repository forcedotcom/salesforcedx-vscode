/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { nls } from '../messages';
import {
  displayRemainingOrgs,
  findRemovableOrgs,
  removeExpiredAndDeletedOrgs,
  updateConfigAndStateAggregatorsEffect
} from '../util/orgUtil';
import { type SuccessOnlyCommandKey } from '../utils/notificationMode';

const COMMAND: SuccessOnlyCommandKey = 'SFDX: Remove Deleted and Expired Orgs';

/** @ExportTaggedError */
export class OrgListCleanError extends Schema.TaggedError<OrgListCleanError>()('OrgListCleanError', {
  message: Schema.String
}) {}

/**
 * Effect command for `sf.org.list.clean` ("SFDX: Remove Deleted and Expired Orgs"): scan for
 * expired/deleted org auths; if none, toast and stop (no pointless confirm). Otherwise modal-confirm,
 * remove the auths, toast which orgs were removed, flush aggregator caches, then display the remaining-orgs table.
 */
export const orgListCleanCommand = Effect.fn('orgListCleanCommand')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channel = yield* api.services.ChannelService;

  const removable = yield* findRemovableOrgs().pipe(
    Effect.catchTag(
      'FailedToListAuthorizationsError',
      error => new OrgListCleanError({ message: nls.localize('org_list_clean_general_error', error.message) })
    )
  );

  const notificationMode = yield* api.services.NotificationModeService;

  // Nothing to remove: tell the user instead of asking them to confirm a no-op.
  if (removable.length === 0) {
    yield* channel.appendToChannel(nls.localize('org_list_clean_no_orgs_message'));
    yield* notificationMode.showSuccessNotification(COMMAND, nls.localize('org_list_clean_no_orgs_message'), true);
    return;
  }

  const promptService = yield* api.services.PromptService;
  yield* promptService.confirmOrThrow({
    message: nls.localize('parameter_gatherer_placeholder_org_list_clean'),
    confirmLabel: nls.localize('org_list_clean_confirm_label')
  });

  const removedOrgs = yield* removeExpiredAndDeletedOrgs(removable).pipe(
    Effect.catchTag(
      'AuthRemoverCreateError',
      error => new OrgListCleanError({ message: nls.localize('org_list_clean_general_error', error.message) })
    )
  );

  const successMessage = nls.localize('org_list_clean_success_message', removedOrgs.length, removedOrgs.join(', '));
  yield* channel.appendToChannel(successMessage);

  // Flush ConfigAggregator + StateAggregator so the org picker doesn't show just-removed orgs,
  // and so the table below reflects post-flush state.
  yield* updateConfigAndStateAggregatorsEffect().pipe(
    Effect.catchTag(
      'AggregatorReloadError',
      error => new OrgListCleanError({ message: nls.localize('org_list_clean_general_error', error.message) })
    )
  );

  yield* displayRemainingOrgs();

  yield* notificationMode.showSuccessNotification(COMMAND, successMessage, true);
});
