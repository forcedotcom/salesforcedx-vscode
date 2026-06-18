/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { PackageInstallRequest as ToolingPackageInstallRequest } from '@salesforce/types/tooling';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schedule from 'effect/Schedule';
import * as Schema from 'effect/Schema';
import * as Str from 'effect/String';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { messages } from '../messages/i18n';
import { type CommandKey, getProgressLocation, showSuccessNotification } from '../utils/notificationMode';

const COMMAND: CommandKey = messages.package_install_text;

const PKG_ID_PREFIX = '04t';

// Live tooling API returns Status as uppercase (e.g. 'SUCCESS'); @salesforce/types' enum casing is wrong.
// Verified against live record 0HfE2000005KJObKAO; matches @salesforce/packaging which polls on ['SUCCESS','ERROR'].
type RuntimeInstallStatus = 'IN_PROGRESS' | 'SUCCESS' | 'ERROR' | 'CANCELED' | 'UNKNOWN';
type PackageInstallRequest = Omit<ToolingPackageInstallRequest, 'Status'> & { Status?: RuntimeInstallStatus };

const isValidPackageId = (value: string): boolean =>
  (value.length === 15 || value.length === 18) && value.startsWith(PKG_ID_PREFIX) && /^[A-Za-z0-9]+$/.test(value);

class PackageInstallFailedError extends Schema.TaggedError<PackageInstallFailedError>()('PackageInstallFailedError', {
  message: Schema.String
}) {}

const gatherPackageId = Effect.fn('packageInstall.gatherPackageId')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const result = yield* Effect.promise(() =>
    vscode.window.showInputBox({
      prompt: nls.localize('package_install_id_prompt'),
      placeHolder: nls.localize('package_install_id_placeholder'),
      ignoreFocusOut: true,
      validateInput: value =>
        value === '' || isValidPackageId(value) ? null : nls.localize('package_install_id_validation')
    })
  );
  return yield* promptService.considerUndefinedAsCancellation(result);
});

const gatherInstallationKey = Effect.fn('packageInstall.gatherInstallationKey')(function* () {
  const result = yield* Effect.promise(() =>
    vscode.window.showInputBox({
      prompt: nls.localize('package_install_key_prompt'),
      password: true,
      ignoreFocusOut: true
    })
  );
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  if (result === undefined) {
    return yield* new api.services.UserCancellationError();
  }
  return result.length === 0 ? Option.none<string>() : Option.some(result);
});

const gatherPollChoice = Effect.fn('packageInstall.gatherPollChoice')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const yes = nls.localize('package_install_poll_yes');
  const no = nls.localize('package_install_poll_no');
  const choice = yield* Effect.promise(() =>
    vscode.window.showQuickPick([yes, no], {
      placeHolder: nls.localize('package_install_poll_prompt'),
      ignoreFocusOut: true
    })
  ).pipe(Effect.flatMap(promptService.considerUndefinedAsCancellation));
  return choice === yes;
});

const verifyPackageAvailable = Effect.fn('packageInstall.verifyPackageAvailable')(function* (packageId: string) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const conn = yield* api.services.ConnectionService.getConnection();
  const result = yield* Effect.tryPromise({
    try: () => conn.tooling.query<{ Id: string }>(`SELECT Id FROM SubscriberPackageVersion WHERE Id ='${packageId}'`),
    catch: e => new PackageInstallFailedError({ message: e instanceof Error ? e.message : String(e) })
  });
  if (result.records.length === 0) {
    return yield* new PackageInstallFailedError({
      message: nls.localize('package_install_not_found', packageId)
    });
  }
  return packageId;
});

const submitInstallRequest = Effect.fn('packageInstall.submitInstallRequest')(function* (params: {
  readonly packageId: string;
  readonly installationKey: Option.Option<string>;
}) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const conn = yield* api.services.ConnectionService.getConnection();
  const body = {
    SubscriberPackageVersionKey: params.packageId,
    ApexCompileType: 'all',
    EnableRss: false,
    NameConflictResolution: 'Block',
    PackageInstallSource: 'U',
    SecurityType: 'None',
    UpgradeType: 'mixed-mode',
    ...Option.match(params.installationKey, {
      onNone: () => ({}),
      onSome: (key: string) => ({ Password: key })
    })
  };
  const result = yield* Effect.tryPromise({
    try: () => conn.tooling.create('PackageInstallRequest', body),
    catch: e => new PackageInstallFailedError({ message: e instanceof Error ? e.message : String(e) })
  });
  const single = Array.isArray(result) ? result[0] : result;
  if (!single?.success) {
    return yield* new PackageInstallFailedError({
      message: `Submit failed: ${JSON.stringify(single?.errors ?? [])}`
    });
  }
  return single.id;
});

const fetchInstallStatus = Effect.fn('packageInstall.fetchInstallStatus')(function* (requestId: string) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const conn = yield* api.services.ConnectionService.getConnection();
  const result = yield* Effect.tryPromise({
    try: () =>
      conn.tooling.query<PackageInstallRequest>(
        `SELECT Id, Status, Errors FROM PackageInstallRequest WHERE Id = '${requestId}'`
      ),
    catch: e => new PackageInstallFailedError({ message: e instanceof Error ? e.message : String(e) })
  }).pipe(
    Effect.retry({
      schedule: Schedule.exponential(Duration.seconds(1), 2.0).pipe(
        Schedule.either(Schedule.spaced(Duration.seconds(30)))
      ),
      times: 5
    })
  );
  const record = result.records[0];
  if (!record) {
    return yield* new PackageInstallFailedError({ message: `Request ${requestId} not found` });
  }
  return record;
});

const extractErrors = (record: PackageInstallRequest): string => {
  const errorMessages = (record.Errors?.errors ?? []).map(e => e.message).filter(Str.isNonEmpty);
  const detail = errorMessages.length === 0 ? 'Unknown error' : errorMessages.join('; ');
  return nls.localize('package_install_failed_message', detail);
};

const isTerminalStatus = (status: PackageInstallRequest['Status']): boolean =>
  status === 'SUCCESS' || status === 'ERROR' || status === 'CANCELED';

const pollSchedule = Schedule.recurUntil((r: PackageInstallRequest) => isTerminalStatus(r.Status)).pipe(
  Schedule.addDelay(() => Duration.seconds(30))
);

const pollUntilComplete = Effect.fn('packageInstall.pollUntilComplete')(function* (requestId: string) {
  const finalRecord = yield* Effect.repeat(fetchInstallStatus(requestId), pollSchedule);
  return finalRecord.Status === 'SUCCESS'
    ? finalRecord
    : yield* new PackageInstallFailedError({ message: extractErrors(finalRecord) });
});

export const packageInstallCommand = Effect.fn('packageInstallCommand')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;

  const packageId = yield* gatherPackageId().pipe(
    Effect.flatMap(id =>
      verifyPackageAvailable(id).pipe(
        promptService.withProgress(nls.localize('package_install_verifying_progress', id), getProgressLocation(COMMAND))
      )
    ),
    Effect.tap(id => Effect.annotateCurrentSpan('packageId', id))
  );
  const installationKey = yield* gatherInstallationKey().pipe(
    Effect.tap(key => Effect.annotateCurrentSpan('hasInstallationKey', Option.isSome(key)))
  );
  const shouldPoll = yield* gatherPollChoice().pipe(
    Effect.tap(choice => Effect.annotateCurrentSpan('shouldPoll', choice))
  );

  const requestId = yield* submitInstallRequest({ packageId, installationKey });

  if (!shouldPoll) {
    yield* Effect.sync(() =>
      showSuccessNotification(COMMAND, nls.localize('package_install_submitted_message', requestId), true)
    );
    return;
  }

  yield* pollUntilComplete(requestId).pipe(
    promptService.withCancellableProgress(
      nls.localize('package_install_polling_progress', packageId),
      getProgressLocation(COMMAND)
    ),
    Effect.tap(() =>
      Effect.sync(() => showSuccessNotification(COMMAND, nls.localize('package_install_succeeded_message', packageId)))
    ),
    // custom message to make it clear how cancellation works
    Effect.tapErrorTag('UserCancellationError', () =>
      Effect.sync(() =>
        vscode.window.showInformationMessage(nls.localize('package_install_cancelled_message', requestId))
      )
    )
  );
});
