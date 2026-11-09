/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getMessageFromError, ExtensionProviderService, SalesforceIdSchema } from '@salesforce/effect-ext-utils';
import type { PackageInstallRequest as ToolingPackageInstallRequest } from '@salesforce/types/tooling';
import * as Arr from 'effect/Array';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import { isNotUndefined, isUndefined } from 'effect/Predicate';
import * as Schedule from 'effect/Schedule';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as Str from 'effect/String';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { messages } from '../messages/i18n';
import { type ProgressAndSuccessCommandKey } from '../utils/notificationMode';

const COMMAND: ProgressAndSuccessCommandKey = messages.package_install_text;

const PackageIdSchema = SalesforceIdSchema.check(Schema.isPattern(/^04t/));

// Live tooling API returns Status as uppercase (e.g. 'SUCCESS'); @salesforce/types' enum casing is wrong.
// Verified against live record 0HfE2000005KJObKAO; matches @salesforce/packaging which polls on ['SUCCESS','ERROR'].
type RuntimeInstallStatus = 'IN_PROGRESS' | 'SUCCESS' | 'ERROR' | 'CANCELED' | 'UNKNOWN';
type PackageInstallRequest = Pick<ToolingPackageInstallRequest, 'Id'> & {
  Status?: RuntimeInstallStatus;
  Errors?: { readonly errors?: readonly { readonly message?: string | undefined }[] | undefined } | null | undefined;
};

const PackageInstallErrorMessages = Schema.Struct({ message: Schema.optional(Schema.String) }).pipe(
  Schema.Array,
  Schema.optional
);

const PackageInstallRequestRow = Schema.Struct({
  Id: Schema.String,
  Status: Schema.optional(Schema.Literals(['IN_PROGRESS', 'SUCCESS', 'ERROR', 'CANCELED', 'UNKNOWN'])),
  Errors: Schema.Struct({ errors: PackageInstallErrorMessages }).pipe(Schema.NullOr, Schema.optional)
});

export const decodePackageInstallPage = (input: unknown) =>
  Schema.decodeUnknownEffect(
    Schema.Struct({ totalSize: Schema.Number, records: Schema.Array(PackageInstallRequestRow) })
  )(input);

class PackageInstallFailedError extends Schema.TaggedError<PackageInstallFailedError>()('PackageInstallFailedError', {
  message: Schema.String
}) {}

const gatherPackageId = Effect.fn('packageInstall.gatherPackageId')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.v2.services.PromptService;
  const result = yield* Effect.promise(() =>
    vscode.window.showInputBox({
      prompt: nls.localize('package_install_id_prompt'),
      placeHolder: nls.localize('package_install_id_placeholder'),
      ignoreFocusOut: true,
      validateInput: value =>
        value === '' || Schema.is(PackageIdSchema)(value) ? undefined : nls.localize('package_install_id_validation')
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
  if (isUndefined(result)) {
    return yield* new api.v2.services.UserCancellationError({ message: 'User cancelled' });
  }
  return result.length === 0 ? Option.none<string>() : Option.some(result);
});

const gatherPollChoice = Effect.fn('packageInstall.gatherPollChoice')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.v2.services.PromptService;
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
  const result = yield* api.v2.services.QueryService.use(service =>
    service.query({ soql: `SELECT Id FROM SubscriberPackageVersion WHERE Id ='${packageId}'`, tooling: true }, input =>
      Schema.decodeUnknownEffect(
        Schema.Struct({ totalSize: Schema.Number, records: Schema.Array(Schema.Struct({ Id: Schema.String })) })
      )(input)
    )
  );
  if (result.totalSize === 0) {
    return yield* new PackageInstallFailedError({ message: nls.localize('package_install_not_found', packageId) });
  }
  return packageId;
});

const submitInstallRequest = Effect.fn('packageInstall.submitInstallRequest')(function* (params: {
  readonly packageId: string;
  readonly installationKey: Option.Option<string>;
}) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const conn = yield* api.v2.services.ConnectionService.use(service => service.getConnection());
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
  return yield* Effect.tryPromise({
    try: () => conn.tooling.create('PackageInstallRequest', body),
    catch: e => new PackageInstallFailedError({ message: getMessageFromError(e) })
  }).pipe(
    Effect.map(result => (Array.isArray(result) ? result[0] : result)),
    Effect.filterOrFail(
      single => single?.success === true,
      single => new PackageInstallFailedError({ message: `Submit failed: ${JSON.stringify(single?.errors ?? [])}` })
    ),
    Effect.map(single => single.id)
  );
});

const fetchInstallStatus = Effect.fn('packageInstall.fetchInstallStatus')(function* (requestId: string) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const query = yield* api.v2.services.QueryService.use(service =>
    service.query(
      { soql: `SELECT Id, Status, Errors FROM PackageInstallRequest WHERE Id = '${requestId}'`, tooling: true },
      decodePackageInstallPage
    )
  );
  const records = yield* Stream.runCollect(query.records);
  return yield* Option.match(Arr.head(records), {
    onNone: () => Effect.fail(new PackageInstallFailedError({ message: `Request ${requestId} not found` })),
    onSome: Effect.succeed
  });
});

const extractErrors = (record: PackageInstallRequest): string => {
  const errorMessages = (record.Errors?.errors ?? [])
    .map(e => e.message)
    .filter(isNotUndefined)
    .filter(Str.isNonEmpty);
  const detail = errorMessages.length === 0 ? 'Unknown error' : errorMessages.join('; ');
  return nls.localize('package_install_failed_message', detail);
};

const isTerminalStatus = (status: PackageInstallRequest['Status']): boolean =>
  status === 'SUCCESS' || status === 'ERROR' || status === 'CANCELED';

const pollUntilComplete = Effect.fn('packageInstall.pollUntilComplete')(function* (requestId: string) {
  const finalRecord = yield* Effect.repeat(fetchInstallStatus(requestId), {
    schedule: Schedule.spaced(Duration.seconds(30)),
    until: (record: PackageInstallRequest) => isTerminalStatus(record.Status)
  });
  return finalRecord.Status === 'SUCCESS'
    ? finalRecord
    : yield* new PackageInstallFailedError({ message: extractErrors(finalRecord) });
});

export const packageInstallCommand = Effect.fn('packageInstallCommand')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.v2.services.PromptService;
  const notificationMode = yield* api.v2.services.NotificationModeService;

  const verifyProgressLocation = yield* notificationMode.getProgressLocation(COMMAND);
  const packageId = yield* gatherPackageId().pipe(
    Effect.flatMap(id =>
      verifyPackageAvailable(id).pipe(
        promptService.withProgress(nls.localize('package_install_verifying_progress', id), verifyProgressLocation)
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
    yield* notificationMode.showSuccessNotification(
      COMMAND,
      nls.localize('package_install_submitted_message', requestId),
      true
    );
    return;
  }

  yield* pollUntilComplete(requestId).pipe(
    promptService.withCancellableProgress(
      nls.localize('package_install_polling_progress', packageId),
      yield* notificationMode.getProgressLocation(COMMAND)
    ),
    Effect.tap(() =>
      notificationMode.showSuccessNotification(COMMAND, nls.localize('package_install_succeeded_message', packageId))
    ),
    // custom message to make it clear how cancellation works; forceShow so it's never suppressed
    Effect.tapErrorTag('UserCancellationError', () =>
      notificationMode.showSuccessNotification(
        COMMAND,
        nls.localize('package_install_cancelled_message', requestId),
        true
      )
    )
  );
});
