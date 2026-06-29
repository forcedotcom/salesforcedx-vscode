/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { identity } from 'effect/Function';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { channelService } from '../channels';
import { nls } from '../messages';
import { gather, OrgToDelete } from '../parameterGatherers/selectDeletableOrg';
import { updateConfigAndStateAggregators } from '../util/orgUtil';

/** sf org delete can take longer than the default 30s simpleExec timeout. */
const DELETE_TIMEOUT = Duration.seconds(120);

class OrgNotDeletableError extends Schema.TaggedError<OrgNotDeletableError>()('OrgNotDeletableError', {
  message: Schema.String
}) {}

/** @ExportTaggedError */
export class OrgDeleteFailedError extends Schema.TaggedError<OrgDeleteFailedError>()('OrgDeleteFailedError', {
  message: Schema.String
}) {}

/**
 * Effect command for `sf.org.delete.default`: confirm, then delete the default org.
 * Picks `org:delete:sandbox` for sandbox defaults and `org:delete:scratch` otherwise
 * (the prior executor hardcoded scratch, which failed for sandbox defaults).
 */
export const orgDeleteDefaultCommand = Effect.fn('orgDeleteDefaultCommand')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  yield* promptService.confirmOrThrow({
    message: nls.localize('parameter_gatherer_placeholder_delete_default_org'),
    confirmLabel: nls.localize('org_delete_default_text')
  });

  const orgInfo = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());
  // Defensive guard: the UI when-clause (sf:default_org_deletable) hides this command for
  // non-scratch/non-sandbox orgs, but it remains callable via executeCommand. Without this
  // check a production default org would fall through to `org delete scratch`.
  if (orgInfo.isScratch !== true && orgInfo.isSandbox !== true) {
    return yield* new OrgNotDeletableError({ message: nls.localize('org_delete_default_not_deletable') });
  }
  const deleteSubcommand = orgInfo.isSandbox === true ? 'org delete sandbox' : 'org delete scratch';

  // pass --target-org so the delete resolves the default org by username rather than depending on
  // the extension-host cwd (simpleExec runs without a workspace cwd, unlike the picker-based runDeleteCli)
  const targetOrgFlag = orgInfo.username ? ` --target-org ${orgInfo.username}` : '';
  const terminalService = yield* api.services.TerminalService;
  // wrap in a cancellable progress: clicking Cancel interrupts this fiber, which aborts the
  // runtime AbortSignal simpleExec threads into exec, killing the long-running sf child.
  const output = yield* terminalService
    .simpleExec({
      command: `sf ${deleteSubcommand}${targetOrgFlag} --no-prompt`,
      parse: identity,
      timeout: DELETE_TIMEOUT
    })
    .pipe(promptService.withCancellableProgress(nls.localize('org_delete_default_progress')));

  const channel = yield* api.services.ChannelService;
  yield* channel.appendToChannel(output);
  yield* Effect.sync(() => {
    channelService.showChannelOutput();
  });

  yield* Effect.promise(() => updateConfigAndStateAggregators());
});

/** Display label for an org's type, used in user-facing channel/notification text. */
const orgTypeLabel = (orgType: OrgToDelete['orgType']): string => (orgType === 'scratch' ? 'scratch org' : 'sandbox');

/**
 * Effect command for `sf.org.delete.username`: pick deletable orgs, confirm, then delete each via
 * `sf org delete scratch|sandbox`. The CLI removes the auth file + aliases and unsets config itself,
 * so no separate cleanup is needed. Uses `Effect.partition` to delete every org and accumulate per-org
 * `TerminalServiceError`s without short-circuiting, then surfaces a partial failure at the end so the
 * user gets an error notification.
 */
export const orgDeleteUsernameCommand = Effect.fn('orgDeleteUsernameCommand')(function* () {
  const { orgs } = yield* gather();
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channel = yield* api.services.ChannelService;
  // services are stateless and constant across orgs: resolve once, capture by closure in deleteOne
  const promptService = yield* api.services.PromptService;
  const terminalService = yield* api.services.TerminalService;

  /** Runs `sf org delete scratch|sandbox --target-org <username> --no-prompt` for a single org, tagging the
   * org onto the success so the post-loop channel writes can name it. A `TerminalServiceError` (non-zero exit)
   * stays a typed failure: `Effect.partition` recovers it into the failures bucket per org WITHOUT
   * short-circuiting, so one failed org does not abort the rest. */
  const deleteOne = Effect.fn('orgDeleteUsername.deleteOne')(
    function* (org: OrgToDelete) {
      const output = yield* terminalService.simpleExec({
        command: `sf org delete ${org.orgType} --target-org ${org.username} --no-prompt`,
        parse: identity,
        timeout: DELETE_TIMEOUT
      });
      return { org, output };
    },
    // tag the failing org onto the error so the failures bucket can name it (partition only keeps the error channel)
    (effect, org) => effect.pipe(Effect.mapError(() => org))
  );

  // One cancellable progress around the WHOLE loop: clicking Cancel interrupts this fiber, which aborts the
  // runtime AbortSignal simpleExec threads into exec (killing the running sf child) and stops the loop. The
  // interrupt is NOT a typed failure, so `Effect.partition`'s per-element `Effect.either` does not capture it;
  // it propagates out as a `UserCancellationError` that the command boundary swallows (user cancelled).
  const [failed, successes] = yield* Effect.partition(orgs, deleteOne, { concurrency: 1 }).pipe(
    promptService.withCancellableProgress(nls.localize('org_delete_username_text'))
  );

  yield* Effect.forEach(successes, ({ output }) => channel.appendToChannel(output), { discard: true });
  yield* Effect.forEach(
    failed,
    org => channel.appendToChannel(nls.localize('org_delete_failed_for_org', org.username, orgTypeLabel(org.orgType))),
    { discard: true }
  );

  yield* channel.showChannel;

  // unconditional, after the loop: reflect whatever was actually deleted in the picker/cache even on partial failure
  yield* Effect.promise(() => updateConfigAndStateAggregators());

  if (failed.length > 0) {
    return yield* new OrgDeleteFailedError({
      message: nls.localize('org_delete_failed_summary', failed.map(org => org.username).join(', '))
    });
  }
});
